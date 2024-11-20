import express from 'express';
import twilio from 'twilio';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { processLocation } from './locationProcessor.js';
import { getWeatherForecast } from './weatherService.js';

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Add JSON parsing for dev endpoint

// Initialize Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Rate limiting based on sender's phone number
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each phone number to 100 requests per windowMs
  message: 'Too many requests from this number, please try again later.',
  keyGenerator: (req) => {
    // Use the sender's phone number as the rate limit key
    // This will only be present after Twilio validation
    return req.body?.From || 'unknown';
  },
  // Skip the IP validation since we're using Twilio's cryptographic validation
  validate: { trustProxy: false }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fallback webhook logging route - captures all incoming requests
app.post('/webhook-log', (req, res) => {
  console.log('=== Incoming Webhook Request ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('===========================');
  res.status(200).end(); // Always return 200 to acknowledge receipt
});

// Development only middleware
const developmentOnly = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
};

// Request validation middleware
const validateSmsRequest = [
  body('Body').trim().notEmpty().withMessage('Message body cannot be empty'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      sendMessage(req.body.From, 'Invalid request. Please send a location.')
        .then(() => res.status(200).end())
        .catch(next);
      return;
    }
    console.log(`Received message from ${req.body.From}: ${req.body.Body}`);
    next();
  }
];

// Helper function to send SMS messages
async function sendMessage(to, body) {
  console.log(`Sending message to ${to}: ${body}`);
  return client.messages.create({
    body: body,
    to: to,
    from: process.env.TWILIO_PHONE_NUMBER
  });
}

// Development endpoint to simulate incoming SMS
app.post('/dev/simulate-text',
  developmentOnly,
  express.json(),
  [
    body('Body').trim().notEmpty().withMessage('Message body is required'),
    body('From').trim().notEmpty().withMessage('From number is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    console.log('=== Simulated Text Message ===');
    console.log('From:', req.body.From);
    console.log('Message:', req.body.Body);
    console.log('===========================');

    const messageBody = req.body.Body.trim();
    const from = req.body.From;

    try {
      const coordinates = await processLocation(messageBody);
      if (!coordinates) {
        const response = 'Please send a valid What3Words location (e.g., "///filled.count.soap" or "filled.count.soap") or coordinates (e.g., "51.5074,-0.1278")';
        console.log('Response:', response);
        return res.json({ success: true, message: response });
      }

      const forecast = await getWeatherForecast(coordinates.lat, coordinates.lng);
      console.log('Response:', forecast);
      res.json({ success: true, message: forecast });
    } catch (error) {
      console.error('Error processing request:', error);
      let errorMessage = 'Sorry, there was an error processing your request. Please try again.';
      if (error.message.includes('Weather service error')) {
        errorMessage = 'Unable to fetch weather data at this time. Please try again later.';
      } else if (error.message.includes('What3Words')) {
        errorMessage = 'Invalid location format. Please check your input and try again.';
      }
      res.status(500).json({ success: false, message: errorMessage });
    }
});

// SMS endpoint with Twilio validation and request validation
app.post('/sms', 
  // Configure webhook validation with the full URL
  twilio.webhook({ 
    validate: true,
    protocol: 'https',
    host: process.env.WEBHOOK_DOMAIN // e.g., "261e-74-14-14-222.ngrok-free.app"
  }), 
  limiter, 
  validateSmsRequest, 
  async (req, res) => {
    const messageBody = req.body.Body.trim();
    const from = req.body.From;

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

      const forecast = await getWeatherForecast(coordinates.lat, coordinates.lng);
      await sendMessage(from, forecast);
      clearTimeout(timeout);
      res.status(200).end();
    } catch (error) {
      console.error('Error processing request:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Sorry, there was an error processing your request. Please try again.';
      if (error.message.includes('Weather service error')) {
        errorMessage = 'Unable to fetch weather data at this time. Please try again later.';
      } else if (error.message.includes('What3Words')) {
        errorMessage = 'Invalid location format. Please check your input and try again.';
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
app.use(async (err, req, res, next) => {
  console.error(err.stack);
  if (!res.headersSent && req.body?.From) {
    try {
      await sendMessage(req.body.From, 'An unexpected error occurred. Please try again later.');
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
