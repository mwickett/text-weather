import fetch from 'node-fetch';
import { Coordinates, What3WordsResponse, LocationProcessingError } from '../types/location.js';
import dotenv from 'dotenv';

dotenv.config();

export async function processLocation(input: string): Promise<Coordinates | null> {
  // Clean up input
  const cleanInput = input.trim().toLowerCase();
  
  // Remove leading slashes if present (e.g., ///filled.count.soap -> filled.count.soap)
  const words = cleanInput.replace(/^\/+/, '');

  // Check if input matches coordinates pattern (e.g., "51.5074,-0.1278")
  const coordsMatch = words.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
  if (coordsMatch) {
    const lat = parseFloat(coordsMatch[1]);
    const lng = parseFloat(coordsMatch[2]);
    
    // Validate coordinate ranges
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
    throw new LocationProcessingError('Invalid coordinate values. Latitude must be between -90 and 90, longitude between -180 and 180.');
  }

  // Check if input matches what3words pattern (three words separated by dots)
  const w3wMatch = words.match(/^([a-z]+)\.([a-z]+)\.([a-z]+)$/);
  if (!w3wMatch) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.what3words.com/v3/convert-to-coordinates?words=${words}&key=${process.env.WHAT3WORDS_API_KEY}`
    );

    if (!response.ok) {
      const errorData = await response.json() as { error: { code: string, message: string } };
      throw new LocationProcessingError(
        `What3Words API error: ${errorData.error?.message || response.statusText}`
      );
    }

    const data = await response.json() as What3WordsResponse;

    // Validate the response
    if (!data.coordinates || typeof data.coordinates.lat !== 'number' || typeof data.coordinates.lng !== 'number') {
      throw new LocationProcessingError('Invalid response format from What3Words API');
    }

    return {
      lat: data.coordinates.lat,
      lng: data.coordinates.lng
    };
  } catch (error) {
    if (error instanceof LocationProcessingError) {
      throw error;
    }
    
    // Handle network or other errors
    throw new LocationProcessingError(
      'Unable to process location. Please check your input and try again.'
    );
  }
}
