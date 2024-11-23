import { WeatherProvider, StandardizedForecast, WeatherServiceError } from '../types/weather.js';

export class WeatherServiceManager {
  private readonly providers: WeatherProvider[];
  private activeProvider: WeatherProvider;

  constructor(providers: WeatherProvider[]) {
    if (providers.length === 0) {
      throw new Error('At least one weather provider must be configured');
    }
    this.providers = providers;
    this.activeProvider = providers[0];
  }

  async getForecast(lat: number, lng: number): Promise<string> {
    const errors: Error[] = [];

    // Try active provider first
    try {
      const forecast = await this.activeProvider.getForecast(lat, lng);
      return this.formatForecast(forecast);
    } catch (error) {
      errors.push(error as Error);
      console.error(`Active provider ${this.activeProvider.getName()} failed:`, error);
    }

    // Try other providers if active provider fails
    for (const provider of this.providers) {
      if (provider === this.activeProvider) continue;

      try {
        if (await provider.isAvailable()) {
          const forecast = await provider.getForecast(lat, lng);
          this.activeProvider = provider; // Switch to working provider
          console.log(`Switched to backup provider: ${provider.getName()}`);
          return this.formatForecast(forecast);
        }
      } catch (error) {
        errors.push(error as Error);
        console.error(`Backup provider ${provider.getName()} failed:`, error);
        continue;
      }
    }

    // If we get here, all providers failed
    console.error('All weather providers failed');
    const errorMessages = errors.map(e => 
      e instanceof WeatherServiceError ? 
        `${e.provider}: ${e.message}` : 
        e.message
    ).join('; ');
    
    throw new Error(`Unable to fetch weather data: ${errorMessages}`);
  }

  private formatForecast(forecast: StandardizedForecast): string {
    const { location, current, hourly, summary } = forecast;

    // Format immediate conditions
    const immediate = [
      `${current.temp}°C ${current.description}`,
      `Feels like ${current.feelsLike}°C`,
      `Humidity: ${current.humidity}%`
    ].join('\n');

    // Format upcoming hours
    const upcoming = hourly.map(hour => {
      const time = new Date(hour.timestamp * 1000).toLocaleTimeString('en-US', {
        hour: 'numeric',
        hour12: true
      });
      return `${time}: ${hour.temp}°C ${hour.description}`;
    }).join('\n');

    // Format summary
    const summaryText = [
      `High: ${summary.high}°C Low: ${summary.low}°C`,
      `Predominantly ${summary.predominantCondition}`
    ].join('\n');

    // Combine all sections
    return `Weather forecast for ${location}:

Right now:
${immediate}

Next few hours:
${upcoming}

12-hour outlook:
${summaryText}`;
  }

  getActiveProvider(): WeatherProvider {
    return this.activeProvider;
  }

  getAllProviders(): WeatherProvider[] {
    return [...this.providers];
  }
}
