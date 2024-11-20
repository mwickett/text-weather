import fetch from 'node-fetch';

export async function getWeatherForecast(lat, lng) {
  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`;
    
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

    const next12Hours = data.list.slice(0, 4);
    const location = data.city.name;

    // Format immediate forecast (current conditions)
    const immediate = formatImmediateForecast(next12Hours[0]);
    
    // Format upcoming hours (next three 3-hour intervals)
    const upcoming = formatUpcomingForecast(next12Hours.slice(1, 4));
    
    // Calculate 12-hour summary
    const summary = calculateSummary(next12Hours);

    return `Weather forecast for ${location}:

Right now:
${immediate}

Next few hours:
${upcoming}

12-hour outlook:
${summary}`;

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

function formatImmediateForecast(data) {
  if (!data.main?.temp || !data.weather?.[0]?.description || !data.main?.feels_like || !data.main?.humidity) {
    throw new Error('Missing required immediate forecast data');
  }

  const temp = Math.round(data.main.temp);
  const feelsLike = Math.round(data.main.feels_like);
  const desc = data.weather[0].description;
  const humidity = data.main.humidity;

  return `${temp}°C ${desc}
Feels like ${feelsLike}°C
Humidity: ${humidity}%`;
}

function formatUpcomingForecast(forecasts) {
  return forecasts.map(item => {
    if (!item.dt || !item.main?.temp || !item.weather?.[0]?.description) {
      throw new Error('Missing required forecast data');
    }

    const time = new Date(item.dt * 1000).toLocaleTimeString('en-US', { 
      hour: 'numeric',
      hour12: true 
    });
    const temp = Math.round(item.main.temp);
    const desc = item.weather[0].description;
    return `${time}: ${temp}°C ${desc}`;
  }).join('\n');
}

function calculateSummary(forecasts) {
  const temps = forecasts.map(f => f.main.temp);
  const high = Math.round(Math.max(...temps));
  const low = Math.round(Math.min(...temps));
  
  // Get the most common weather condition
  const conditions = forecasts.map(f => f.weather[0].description);
  const commonCondition = mode(conditions);

  return `High: ${high}°C Low: ${low}°C
Predominantly ${commonCondition}`;
}

function mode(array) {
  return array.sort((a,b) =>
    array.filter(v => v === a).length - array.filter(v => v === b).length
  ).pop();
}
