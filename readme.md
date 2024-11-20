# Text Weather Service

A service that provides weather forecasts via SMS using What3Words locations or coordinates.

## Development

### Local Testing

For local development, you can use the `/dev/simulate-text` endpoint to test the service without needing to configure Twilio webhooks. This endpoint is only available in development mode.

To simulate receiving a text message, send a POST request to `/dev/simulate-text` with a JSON body containing:

- `Body`: The message text (location)
- `From`: The sender's phone number

Example using curl:

```bash
# Test with What3Words
curl -X POST http://localhost:3000/dev/simulate-text \
  -H "Content-Type: application/json" \
  -d '{"Body": "filled.count.soap", "From": "+1234567890"}'

# Test with coordinates
curl -X POST http://localhost:3000/dev/simulate-text \
  -H "Content-Type: application/json" \
  -d '{"Body": "51.5074,-0.1278", "From": "+1234567890"}'
```

The endpoint will return a JSON response with:

- `success`: boolean indicating if the request was processed successfully
- `message`: the message that would have been sent via SMS

### Production Setup

For production, configure your Twilio webhook to point to your deployed `/sms` endpoint. The service expects:

1. Environment variables in `.env`:

   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`
   - `WEBHOOK_DOMAIN`

2. Valid What3Words or coordinate locations in the message body

## API Endpoints

- `POST /sms`: Production endpoint for Twilio webhooks
- `POST /dev/simulate-text`: Development endpoint for testing
- `GET /health`: Health check endpoint
