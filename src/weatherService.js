import fetch from 'node-fetch';

export async function getWeatherForecast(lat, lng) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error('Weather service error');
    }

    // Get next 12 hours forecast
    const next12Hours = data.list.slice(0, 4);
    const location = data.city.name;

    // Create a simple text forecast
    const forecast = next12Hours.map(item => {
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
    throw new Error('Unable to fetch weather data');
  }
}