# Text Weather Service

A TypeScript-based SMS weather service that provides weather forecasts via text message. Uses What3Words for location input and OpenWeatherMap for weather data.

## Features

- SMS-based weather forecasts
- What3Words location support
- Coordinate-based location support
- Multiple weather provider support (currently OpenWeatherMap)
- TypeScript for type safety
- Express.js web server
- Rate limiting
- Error handling

## Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with the following variables:
```
OPENWEATHER_API_KEY=your_key_here
WHAT3WORDS_API_KEY=your_key_here
TWILIO_ACCOUNT_SID=your_sid_here
TWILIO_AUTH_TOKEN=your_token_here
TWILIO_PHONE_NUMBER=your_number_here
WEBHOOK_DOMAIN=your_domain_here
```

## Development

Run the development server:
```bash
npm run dev
```

The server will start on port 3000 (or the port specified in your PORT environment variable).

## Production

Build the TypeScript code:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /sms` - Twilio webhook endpoint for incoming SMS
- `POST /dev/simulate-text` - Development endpoint to simulate incoming SMS (only available in development)

## Architecture

The service uses an adapter pattern for weather providers, allowing for:
- Multiple weather data sources
- Failover support
- Easy addition of new providers
- Standardized weather data format

## License

Private - All rights reserved
