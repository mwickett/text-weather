import fetch from 'node-fetch';

const W3W_API_URL = 'https://api.what3words.com/v3';

function parseCoordinate(coord, isLatitude = true) {
  // Remove any parentheses and trim whitespace
  coord = coord.replace(/[()]/g, '').trim();

  // Handle cardinal directions
  let multiplier = 1;
  if (coord.toUpperCase().endsWith('S') || coord.toUpperCase().endsWith('W')) {
    multiplier = -1;
    coord = coord.slice(0, -1);
  } else if (coord.toUpperCase().endsWith('N') || coord.toUpperCase().endsWith('E')) {
    coord = coord.slice(0, -1);
  }

  // Remove degree symbols and trim
  coord = coord.replace(/°/g, '').trim();

  // Parse the coordinate as a float
  const value = parseFloat(coord) * multiplier;

  // Validate the range
  if (isLatitude && (value < -90 || value > 90)) {
    throw new Error('Invalid latitude: Must be between -90 and 90 degrees');
  } else if (!isLatitude && (value < -180 || value > 180)) {
    throw new Error('Invalid longitude: Must be between -180 and 180 degrees');
  }

  return value;
}

export async function processLocation(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input: Location must be provided as text');
  }

  // Check if input is coordinates
  // Match various coordinate formats with flexible spacing and optional symbols
  const coordsRegex = /^[(\s]*(-?\d+\.?\d*°?[NSns]?)[,\s]+(-?\d+\.?\d*°?[EWew]?)[)\s]*$/;
  const coordsMatch = input.match(coordsRegex);

  if (coordsMatch) {
    try {
      const lat = parseCoordinate(coordsMatch[1], true);
      const lng = parseCoordinate(coordsMatch[2], false);

      return { lat, lng };
    } catch (error) {
      throw new Error(`Invalid coordinates: ${error.message}`);
    }
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

  throw new Error('Invalid location format. Please use either:\n' +
    '- Coordinates: 51.5074,-0.1278 or 51.5074N, 0.1278W\n' +
    '- What3Words: ///filled.count.soap or filled.count.soap');
}
