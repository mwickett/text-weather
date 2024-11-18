import { What3WordsService } from '@what3words/api';

const what3words = new What3WordsService({
  apiKey: process.env.WHAT3WORDS_API_KEY
});

export async function processLocation(input) {
  // Check if input is coordinates
  const coordsRegex = /^(-?\d+\.?\d*),(-?\d+\.?\d*)$/;
  const coordsMatch = input.match(coordsRegex);

  if (coordsMatch) {
    return {
      lat: parseFloat(coordsMatch[1]),
      lng: parseFloat(coordsMatch[2])
    };
  }

  // Check if input is What3Words
  const w3wRegex = /^(\w+)\.(\w+)\.(\w+)$/;
  if (w3wRegex.test(input)) {
    try {
      const response = await what3words.convertToCoordinates(input);
      return {
        lat: response.coordinates.lat,
        lng: response.coordinates.lng
      };
    } catch (error) {
      console.error('Error converting What3Words:', error);
      return null;
    }
  }

  return null;
}