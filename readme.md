# Text Weather Service

A TypeScript-based SMS weather service that provides weather forecasts via text message. Uses What3Words for location input and supports multiple weather providers (OpenWeatherMap and Tomorrow.io).

## Features

- SMS-based weather forecasts
- What3Words location support
- Coordinate-based location support
- Multiple weather provider support:
  - OpenWeatherMap
  - Tomorrow.io
- Configurable provider priority
- Automatic failover between providers
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
# Required
OPENWEATHER_API_KEY=your_key_here
TOMORROWIO_API_KEY=your_key_here
WHAT3WORDS_API_KEY=your_key_here
TWILIO_ACCOUNT_SID=your_sid_here
TWILIO_AUTH_TOKEN=your_token_here
TWILIO_PHONE_NUMBER=your_number_here

# Optional
WEATHER_PROVIDER_PRIORITY=OpenWeatherMap,Tomorrow.io  # Comma-separated list of providers in priority order
WEBHOOK_DOMAIN=your_domain_here
PORT=3000
```

## Weather Provider Configuration

The service supports multiple weather providers with configurable priority:

- Default priority: Providers are used in the order they are initialized
- Custom priority: Set `WEATHER_PROVIDER_PRIORITY` environment variable with a comma-separated list of provider names
  - Example: `WEATHER_PROVIDER_PRIORITY=Tomorrow.io,OpenWeatherMap`
  - Any providers not listed will be added to the end of the priority list
  - Invalid provider names are ignored

The service will try providers in priority order and use the first available one. If a provider fails, it automatically fails over to the next provider in the priority list.

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
- Configurable provider priority
- Failover support
- Easy addition of new providers
- Standardized weather data format

Current weather providers:
- OpenWeatherMap: Supports global weather forecasts
- Tomorrow.io: Alternative provider with detailed weather data

## License

Private - All rights reserved
