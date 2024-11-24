import { WeatherProvider, StandardizedForecast, WeatherServiceError } from '../types/weather.js';

export class WeatherServiceManager {
  private readonly providers: Map<string, WeatherProvider>;
  private activeProvider: WeatherProvider;
  private readonly priorityOrder: string[];

  constructor(providers: WeatherProvider[]) {
    if (providers.length === 0) {
      throw new Error('At least one weather provider must be configured');
    }

    // Create a map of providers by name for easy lookup
    this.providers = new Map(
      providers.map(provider => [provider.getName(), provider])
    );

    // Set priority order based on environment variable or default to all providers in given order
    const priorityString = process.env.WEATHER_PROVIDER_PRIORITY;
    if (priorityString) {
      // Filter out any provider names that don't exist in our providers map
      this.priorityOrder = priorityString
        .split(',')
        .map(name => name.trim())
        .filter(name => this.providers.has(name));

      // Add any providers that weren't in the priority string to the end
      const remainingProviders = Array.from(this.providers.keys())
        .filter(name => !this.priorityOrder.includes(name));
      this.priorityOrder.push(...remainingProviders);
    } else {
      // Default to the order providers were passed in
      this.priorityOrder = providers.map(provider => provider.getName());
    }

    // Set initial active provider based on priority
    const firstProvider = this.providers.get(this.priorityOrder[0]);
    if (!firstProvider) {
      throw new Error('No valid weather providers available');
    }
    this.activeProvider = firstProvider;
  }

  async getForecast(lat: number, lng: number, preferredProvider?: string): Promise<string> {
    const errors: Error[] = [];

    // If a preferred provider is specified and exists, try it first
    if (preferredProvider) {
      const provider = this.providers.get(preferredProvider);
      if (provider) {
        try {
          if (await provider.isAvailable()) {
            const forecast = await provider.getForecast(lat, lng);
            this.activeProvider = provider;
            console.log(`Using weather provider: ${provider.getName()}`);
            return this.formatForecast(forecast, provider.getName());
          }
        } catch (error) {
          errors.push(error as Error);
          console.error(`Preferred provider ${provider.getName()} failed:`, error);
        }
      }
    }

    // Try providers in priority order
    for (const providerName of this.priorityOrder) {
      // Skip if this was the preferred provider we already tried
      if (preferredProvider && providerName === preferredProvider) continue;

      const provider = this.providers.get(providerName);
      if (!provider) continue;

      try {
        if (await provider.isAvailable()) {
          const forecast = await provider.getForecast(lat, lng);
          this.activeProvider = provider;
          console.log(`Using weather provider: ${provider.getName()}`);
          return this.formatForecast(forecast, provider.getName());
        }
      } catch (error) {
        errors.push(error as Error);
        console.error(`Provider ${provider.getName()} failed:`, error);
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

  private formatForecast(forecast: StandardizedForecast, providerName: string): string {
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
(via ${providerName})

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
    return this.priorityOrder.map(name => this.providers.get(name)!);
  }

  getPriorityOrder(): string[] {
    return [...this.priorityOrder];
  }

  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }
}
