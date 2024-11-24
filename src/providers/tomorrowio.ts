import fetch, { AbortError } from 'node-fetch';
import {
  WeatherProvider,
  StandardizedForecast,
  WeatherProviderTimeoutError,
  WeatherProviderResponseError,
  WeatherServiceError
} from '../types/weather.js';

interface TomorrowIOResponse {
  timelines: {
    hourly: Array<{
      time: string;
      values: {
        temperature: number;
        temperatureApparent: number;
        humidity: number;
        weatherCode: number;
      };
    }>;
  };
  location: {
    lat: number;
    lon: number;
  };
}

interface GeocodingResponse {
  address: {
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    state?: string;
    country?: string;
  };
}

export class TomorrowIOProvider implements WeatherProvider {
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly fields = ['temperature', 'temperatureApparent', 'humidity', 'weatherCode'];

  constructor(apiKey: string, timeout: number = 5000) {
    this.apiKey = apiKey;
    this.timeout = timeout;
  }

  getName(): string {
    return 'Tomorrow.io';
  }

  private buildUrl(lat: number, lng: number, params: Record<string, string> = {}): string {
    const baseUrl = 'https://api.tomorrow.io/v4/weather/forecast';
    const defaultParams = {
      location: `${lat},${lng}`,
      fields: this.fields.join(','),
      apikey: this.apiKey,
      ...params
    };

    const queryString = Object.entries(defaultParams)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    return `${baseUrl}?${queryString}`;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const url = this.buildUrl(0, 0);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      return response.ok;
    } catch {
      return false;
    }
  }

  private async getLocationName(lat: number, lng: number): Promise<string> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'text-weather-service/1.0'
        }
      });

      if (!response.ok) {
        return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
      }

      const data = await response.json() as GeocodingResponse;
      const address = data.address;
      
      // Try to get the most specific location name
      const locationName = address.city || address.town || address.village || address.suburb;
      if (locationName) {
        if (address.state && address.country === 'United States') {
          return `${locationName}, ${address.state}`;
        }
        return locationName;
      }

      return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
    } catch (error) {
      console.error('Error getting location name:', error);
      return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
    }
  }

  async getForecast(lat: number, lng: number): Promise<StandardizedForecast> {
    try {
      const url = this.buildUrl(lat, lng, {
        units: 'metric',
        timesteps: '1h'
      });
      console.log('Tomorrow.io API URL:', url);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { message?: string };
        console.error('Tomorrow.io API error:', errorData);
        throw new WeatherProviderResponseError(
          this.getName(),
          response.status,
          errorData.message || response.statusText
        );
      }

      const data = await response.json() as TomorrowIOResponse;

      // Validate required data
      if (!data.timelines?.hourly?.length) {
        console.error('Tomorrow.io invalid response format:', data);
        throw new WeatherProviderResponseError(
          this.getName(),
          500,
          'Invalid response format from weather service'
        );
      }

      const next12Hours = data.timelines.hourly.slice(0, 4);
      const locationName = await this.getLocationName(lat, lng);

      return {
        location: locationName,
        current: {
          temp: Math.round(next12Hours[0].values.temperature),
          feelsLike: Math.round(next12Hours[0].values.temperatureApparent),
          humidity: Math.round(next12Hours[0].values.humidity),
          description: this.getWeatherDescription(next12Hours[0].values.weatherCode)
        },
        hourly: next12Hours.slice(1, 4).map(item => ({
          timestamp: new Date(item.time).getTime() / 1000,
          temp: Math.round(item.values.temperature),
          description: this.getWeatherDescription(item.values.weatherCode)
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
      console.error('Tomorrow.io unexpected error:', error);
      throw new WeatherServiceError(
        'Unable to fetch weather data - please try again',
        this.getName()
      );
    }
  }

  private calculateSummary(forecasts: TomorrowIOResponse['timelines']['hourly']): StandardizedForecast['summary'] {
    const temps = forecasts.map(f => f.values.temperature);
    const high = Math.round(Math.max(...temps));
    const low = Math.round(Math.min(...temps));
    
    // Get the most common weather condition
    const conditions = forecasts.map(f => this.getWeatherDescription(f.values.weatherCode));
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

  private getWeatherDescription(code: number): string {
    // Tomorrow.io weather codes mapping to descriptions
    const weatherCodes: { [key: number]: string } = {
      0: 'Unknown',
      1000: 'Clear',
      1100: 'Mostly Clear',
      1101: 'Partly Cloudy',
      1102: 'Mostly Cloudy',
      1001: 'Cloudy',
      2000: 'Fog',
      2100: 'Light Fog',
      4000: 'Drizzle',
      4001: 'Rain',
      4200: 'Light Rain',
      4201: 'Heavy Rain',
      5000: 'Snow',
      5001: 'Flurries',
      5100: 'Light Snow',
      5101: 'Heavy Snow',
      6000: 'Freezing Drizzle',
      6001: 'Freezing Rain',
      6200: 'Light Freezing Rain',
      6201: 'Heavy Freezing Rain',
      7000: 'Ice Pellets',
      7101: 'Heavy Ice Pellets',
      7102: 'Light Ice Pellets',
      8000: 'Thunderstorm'
    };

    return weatherCodes[code] || 'Unknown';
  }
}
