import { processLocation } from './locationProcessor.js';

// Test cases with descriptions
const testCases = [
  { input: '51.5074,-0.1278', desc: 'Basic format' },
  { input: '51.5074, -0.1278', desc: 'Spaced format' },
  { input: '51.5074°N, 0.1278°W', desc: 'Degrees format' },
  { input: '(51.5074, -0.1278)', desc: 'Parentheses format' },
  { input: '51.5074N, 0.1278W', desc: 'Cardinal directions' },
  { input: '90, 180', desc: 'Edge case - max values' },
  { input: '-90, -180', desc: 'Edge case - min values' },
  { input: '51.5074°, -0.1278°', desc: 'Degrees without cardinal' },
];

console.log('Testing coordinate parsing improvements...\n');

for (const test of testCases) {
  try {
    const result = await processLocation(test.input);
    console.log(`✅ ${test.desc} [${test.input}]`);
    console.log('   Result:', result, '\n');
  } catch (error) {
    console.log(`❌ ${test.desc} [${test.input}]`);
    console.log('   Error:', error.message, '\n');
  }
}
