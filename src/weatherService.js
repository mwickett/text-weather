import fetch from 'node-fetch';

export async function getWeatherForecast(lat, lng) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`;

  try {
    // Add timeout to fetch request
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, {
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Weather service error: ${response.status} - ${errorData.message || response.statusText}`
      );
    }

    const data = await response.json();

    // Validate required data
    if (!data.list || !data.city) {
      throw new Error('Invalid response format from weather service');
    }

    // Get next 12 hours forecast
    const next12Hours = data.list.slice(0, 4);
    const location = data.city.name;

    // Input validation for temperature values
    const forecast = next12Hours.map(item => {
      if (!item.dt || !item.main?.temp || !item.weather?.[0]?.description) {
        throw new Error('Missing required forecast data');
      }

      const time = new Date(item.dt * 1000).toLocaleTimeString('en-US', { 
        hour: 'numeric',
        hour12: true 
      });
      const temp = Math.round(item.main.temp);
      const desc = item.weather[0].description;
      return `${time}: ${temp}°C, ${desc}`;
    }).join('\n');

    return `Weather forecast for ${location}:\n${forecast}`;
  } catch (error) {
    console.error('Weather API error:', error);
    
    // Provide more specific error messages based on error type
    if (error.name === 'AbortError') {
      throw new Error('Weather service timeout - please try again');
    } else if (error.message.includes('Invalid response format')) {
      throw new Error('Unable to process weather data - please try again later');
    } else {
      throw new Error('Unable to fetch weather data - please try again');
    }
  }
}
