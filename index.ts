import { config } from 'dotenv';
import { generateText } from 'ai';

// AI Gateway reads AI_GATEWAY_API_KEY from the environment.
config({ path: '.env.local', quiet: true });

const { text } = await generateText({
  model: 'moonshotai/kimi-k3',
  prompt: 'Invent a new holiday and describe its traditions.',
});

console.log(text);
