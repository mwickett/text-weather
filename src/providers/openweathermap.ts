import fetch, { AbortError } from 'node-fetch';
import {
  WeatherProvider,
  StandardizedForecast,
  OpenWeatherMapResponse,
  WeatherProviderTimeoutError,
  WeatherProviderResponseError,
  WeatherServiceError
} from '../types/weather.js';

export class OpenWeatherMapProvider implements WeatherProvider {
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(apiKey: string, timeout: number = 5000) {
    this.apiKey = apiKey;
    this.timeout = timeout;
  }

  getName(): string {
    return 'OpenWeatherMap';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=0&lon=0&appid=${this.apiKey}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      return response.ok;
    } catch {
      return false;
    }
  }

  async getForecast(lat: number, lng: number): Promise<StandardizedForecast> {
    try {
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${this.apiKey}&units=metric`;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { message?: string };
        throw new WeatherProviderResponseError(
          this.getName(),
          response.status,
          errorData.message || response.statusText
        );
      }

      const data = await response.json() as OpenWeatherMapResponse;

      // Validate required data
      if (!data.list || !data.city) {
        throw new WeatherProviderResponseError(
          this.getName(),
          500,
          'Invalid response format from weather service'
        );
      }

      const next12Hours = data.list.slice(0, 4);

      return {
        location: data.city.name,
        current: {
          temp: Math.round(next12Hours[0].main.temp),
          feelsLike: Math.round(next12Hours[0].main.feels_like),
          humidity: next12Hours[0].main.humidity,
          description: next12Hours[0].weather[0].description
        },
        hourly: next12Hours.slice(1, 4).map(item => ({
          timestamp: item.dt,
          temp: Math.round(item.main.temp),
          description: item.weather[0].description
        })),
        summary: this.calculateSummary(next12Hours)
      };
    } catch (error) {
      if (error instanceof AbortError) {
        throw new WeatherProviderTimeoutError(this.getName());
      }
      if (error instanceof WeatherServiceError) {
        throw error;
      }
      throw new WeatherServiceError(
        'Unable to fetch weather data - please try again',
        this.getName()
      );
    }
  }

  private calculateSummary(forecasts: OpenWeatherMapResponse['list']): StandardizedForecast['summary'] {
    const temps = forecasts.map(f => f.main.temp);
    const high = Math.round(Math.max(...temps));
    const low = Math.round(Math.min(...temps));
    
    // Get the most common weather condition
    const conditions = forecasts.map(f => f.weather[0].description);
    const predominantCondition = this.mode(conditions);

    return {
      high,
      low,
      predominantCondition
    };
  }

  private mode(array: string[]): string {
    return array.sort((a, b) =>
      array.filter(v => v === a).length - array.filter(v => v === b).length
    ).pop() || '';
  }
}
