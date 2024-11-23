import express, { Request, Response, NextFunction } from 'express';
import twilio from 'twilio';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { processLocation } from './services/locationProcessor';
import { WeatherServiceManager } from './services/weatherManager';
import { OpenWeatherMapProvider } from './providers/openweathermap';
import { LocationProcessingError } from './types/location';
import { WeatherServiceError } from './types/weather';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'OPENWEATHER_API_KEY',
  'WHAT3WORDS_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize weather service
const weatherManager = new WeatherServiceManager([
  new OpenWeatherMapProvider(process.env.OPENWEATHER_API_KEY)
]);

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Initialize Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Types for request bodies
interface TwilioMessageBody {
  Body: string;
  From: string;
}

interface SimulatedMessageBody {
  Body: string;
  From: string;
}

// Rate limiting based on sender's phone number
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each phone number to 100 requests per windowMs
  message: 'Too many requests from this number, please try again later.',
  keyGenerator: (req) => {
    return (req.body as TwilioMessageBody)?.From || 'unknown';
  },
  validate: { trustProxy: false }
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fallback webhook logging route
app.post('/webhook-log', (req: Request, res: Response): void => {
  console.log('=== Incoming Webhook Request ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('===========================');
  res.status(200).end();
});

// Request validation middleware
const validateSmsRequest = [
  body('Body').trim().notEmpty().withMessage('Message body cannot be empty'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const body = req.body as TwilioMessageBody;
      try {
        await sendMessage(body.From, 'Invalid request. Please send a location.');
        res.status(200).end();
      } catch (error) {
        next(error);
      }
      return;
    }
    console.log(`Received message from ${(req.body as TwilioMessageBody).From}: ${(req.body as TwilioMessageBody).Body}`);
    next();
  }
];

// Helper function to send SMS messages
async function sendMessage(to: string, body: string): Promise<void> {
  console.log(`Sending message to ${to}: ${body}`);
  await client.messages.create({
    body: body,
    to: to,
    from: process.env.TWILIO_PHONE_NUMBER
  });
}

// Development endpoint to simulate incoming SMS
app.post('/dev/simulate-text',
  [
    body('Body').trim().notEmpty().withMessage('Message body is required'),
    body('From').trim().notEmpty().withMessage('From number is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const body = req.body as SimulatedMessageBody;
    console.log('=== Simulated Text Message ===');
    console.log('From:', body.From);
    console.log('Message:', body.Body);
    console.log('===========================');

    try {
      const coordinates = await processLocation(body.Body);
      if (!coordinates) {
        const response = 'Please send a valid What3Words location (e.g., "///filled.count.soap" or "filled.count.soap") or coordinates (e.g., "51.5074,-0.1278")';
        console.log('Response:', response);
        res.json({ success: true, message: response });
        return;
      }

      const forecast = await weatherManager.getForecast(coordinates.lat, coordinates.lng);
      console.log('Response:', forecast);
      res.json({ success: true, message: forecast });
    } catch (error) {
      console.error('Error processing request:', error);
      let errorMessage = 'Sorry, there was an error processing your request. Please try again.';
      
      if (error instanceof LocationProcessingError) {
        errorMessage = error.message;
      } else if (error instanceof WeatherServiceError) {
        errorMessage = 'Unable to fetch weather data at this time. Please try again later.';
      }
      
      res.status(500).json({ success: false, message: errorMessage });
    }
});

// SMS endpoint with Twilio validation and request validation
app.post('/sms',
  twilio.webhook({
    validate: false,
    protocol: 'https',
    host: process.env.WEBHOOK_DOMAIN
  }),
  limiter,
  validateSmsRequest,
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body as TwilioMessageBody;
    const messageBody = body.Body.trim();
    const from = body.From;

    // Set timeout for the entire request
    const timeout = setTimeout(async () => {
      if (!res.headersSent) {
        try {
          await sendMessage(from, 'Request timed out. Please try again.');
          res.status(200).end();
        } catch (error) {
          console.error('Error sending timeout message:', error);
          res.status(500).end();
        }
      }
    }, 10000); // 10 second timeout

    try {
      const coordinates = await processLocation(messageBody);
      if (!coordinates) {
        await sendMessage(from, 'Please send a valid What3Words location (e.g., "///filled.count.soap" or "filled.count.soap") or coordinates (e.g., "51.5074,-0.1278")');
        res.status(200).end();
        return;
      }

      const forecast = await weatherManager.getForecast(coordinates.lat, coordinates.lng);
      await sendMessage(from, forecast);
      clearTimeout(timeout);
      res.status(200).end();
    } catch (error) {
      console.error('Error processing request:', error);
      
      let errorMessage = 'Sorry, there was an error processing your request. Please try again.';
      
      if (error instanceof LocationProcessingError) {
        errorMessage = error.message;
      } else if (error instanceof WeatherServiceError) {
        errorMessage = 'Unable to fetch weather data at this time. Please try again later.';
      }
      
      if (!res.headersSent) {
        try {
          await sendMessage(from, errorMessage);
          res.status(200).end();
        } catch (sendError) {
          console.error('Error sending error message:', sendError);
          res.status(500).end();
        }
      }
    } finally {
      clearTimeout(timeout);
    }
});

// Error handling middleware
app.use(async (err: Error, req: Request, res: Response, _next: NextFunction): Promise<void> => {
  console.error(err.stack);
  const body = req.body as TwilioMessageBody;
  if (!res.headersSent && body?.From) {
    try {
      await sendMessage(body.From, 'An unexpected error occurred. Please try again later.');
      res.status(200).end();
    } catch (error) {
      console.error('Error sending error message:', error);
      res.status(500).end();
    }
  } else if (!res.headersSent) {
    res.status(500).end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at <domain>:${PORT}/health`);
});
