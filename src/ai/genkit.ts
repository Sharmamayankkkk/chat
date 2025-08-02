
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { nextPlugin } from '@genkit-ai/next';

export const ai = genkit({
    plugins: [
        googleAI(),
        nextPlugin(),
    ],
    logLevel: "debug",
    enableTracingAndMetrics: true,
});
