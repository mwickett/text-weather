import express from 'express';
import { MessagingResponse } from 'twilio/lib/twiml/MessagingResponse.js';
import dotenv from 'dotenv';
import { processLocation } from './locationProcessor.js';
import { getWeatherForecast } from './weatherService.js';

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: true }));

app.post('/sms', async (req, res) => {
  const twiml = new MessagingResponse();
  const messageBody = req.body.Body.trim();

  try {
    const coordinates = await processLocation(messageBody);
    if (!coordinates) {
      twiml.message('Please send a valid What3Words location (e.g., "filled.count.soap") or coordinates (e.g., "51.5074,-0.1278")');
      res.type('text/xml').send(twiml.toString());
      return;
    }

    const forecast = await getWeatherForecast(coordinates.lat, coordinates.lng);
    twiml.message(forecast);
  } catch (error) {
    console.error('Error processing request:', error);
    twiml.message('Sorry, there was an error processing your request. Please try again.');
  }

  res.type('text/xml').send(twiml.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});