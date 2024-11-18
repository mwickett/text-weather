import fetch from 'node-fetch';

const W3W_API_URL = 'https://api.what3words.com/v3';

export async function processLocation(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input: Location must be provided as text');
  }

  // Check if input is coordinates
  const coordsRegex = /^(-?\d+\.?\d*),(-?\d+\.?\d*)$/;
  const coordsMatch = input.match(coordsRegex);

  if (coordsMatch) {
    const lat = parseFloat(coordsMatch[1]);
    const lng = parseFloat(coordsMatch[2]);

    // Validate coordinate ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error('Invalid coordinates: Values out of range');
    }

    return {
      lat,
      lng
    };
  }

  // Check if input is What3Words
  // Remove leading slashes and trim whitespace
  const cleanedInput = input.replace(/^\/+/, '').trim();
  const w3wRegex = /^(\w+)\.(\w+)\.(\w+)$/;
  if (w3wRegex.test(cleanedInput)) {
    try {
      // Add timeout to What3Words API call using AbortController
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `${W3W_API_URL}/convert-to-coordinates?words=${cleanedInput}&key=${process.env.WHAT3WORDS_API_KEY}`,
        { signal: controller.signal }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'What3Words API error');
      }

      const data = await response.json();

      if (!data?.coordinates?.lat || !data?.coordinates?.lng) {
        throw new Error('Invalid response from What3Words API');
      }

      return {
        lat: data.coordinates.lat,
        lng: data.coordinates.lng
      };
    } catch (error) {
      console.error('Error converting What3Words:', error);
      if (error.name === 'AbortError') {
        throw new Error('Location service timeout - please try again');
      } else {
        throw new Error('Invalid What3Words location - please check and try again');
      }
    }
  }

  throw new Error('Invalid location format - please use coordinates (e.g., 51.5074,-0.1278) or What3Words (e.g., ///filled.count.soap or filled.count.soap)');
}
