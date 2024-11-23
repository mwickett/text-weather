export interface StandardizedForecast {
  location: string;
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    description: string;
  };
  hourly: Array<{
    timestamp: number;
    temp: number;
    description: string;
  }>;
  summary: {
    high: number;
    low: number;
    predominantCondition: string;
  };
}

export interface WeatherProvider {
  getName(): string;
  getForecast(lat: number, lng: number): Promise<StandardizedForecast>;
  isAvailable(): Promise<boolean>;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

// OpenWeatherMap specific types
export interface OpenWeatherMapResponse {
  list: Array<{
    dt: number;
    main: {
      temp: number;
      feels_like: number;
      humidity: number;
    };
    weather: Array<{
      description: string;
    }>;
  }>;
  city: {
    name: string;
  };
}

// Error types
export class WeatherServiceError extends Error {
  constructor(message: string, public readonly provider: string) {
    super(message);
    this.name = 'WeatherServiceError';
  }
}

export class WeatherProviderTimeoutError extends WeatherServiceError {
  constructor(provider: string) {
    super(`Weather provider timeout - please try again`, provider);
    this.name = 'WeatherProviderTimeoutError';
  }
}

export class WeatherProviderResponseError extends WeatherServiceError {
  constructor(provider: string, status: number, message?: string) {
    super(`Weather provider error: ${status} - ${message || 'Unknown error'}`, provider);
    this.name = 'WeatherProviderResponseError';
  }
}
