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

// Initialize Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Request validation middleware
const validateSmsRequest = [
  body('Body').trim().notEmpty().withMessage('Message body cannot be empty'),
  (req, res, next) => {
    const errors = validationResult(req);
    console.log(req.body.From)
    if (!errors.isEmpty()) {
      sendMessage(req.body.From, 'Invalid request. Please send a location.')
        .then(() => res.status(200).end())
        .catch(next);
      return;
    }
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

// SMS endpoint with Twilio validation and request validation
app.post('/sms', twilio.webhook({ validate: false }), validateSmsRequest, async (req, res) => {
  const messageBody = req.body.Body.trim();
  const from = req.body.From;

  console.log(from)

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
  console.log(`Health check available at http://localhost:${PORT}/health`);
});
