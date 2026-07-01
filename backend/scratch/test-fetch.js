import { getYouTubeVideoDetails } from '../services/youtubeService.js';

async function test() {
  console.log('Testing video details retrieval for dQw4w9WgXcQ...');
  const result = await getYouTubeVideoDetails('dQw4w9WgXcQ');
  console.log('Result:', JSON.stringify(result, null, 2));
}

test().catch(console.error);
