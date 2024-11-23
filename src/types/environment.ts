declare global {
  namespace NodeJS {
    interface ProcessEnv {
      OPENWEATHER_API_KEY: string;
      WHAT3WORDS_API_KEY: string;
      TWILIO_ACCOUNT_SID: string;
      TWILIO_AUTH_TOKEN: string;
      TWILIO_PHONE_NUMBER: string;
      WEBHOOK_DOMAIN?: string;
      PORT?: string;
      NODE_ENV?: 'development' | 'production' | 'test';
    }
  }
}

// This export is necessary to make this a module
export {};
