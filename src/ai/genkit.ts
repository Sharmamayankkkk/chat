
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import * as next from '@genkit-ai/next';

export const ai = genkit({
    plugins: [
        googleAI(),
        next.plugin(),
    ],
    logLevel: 'debug',
    enableTracingAndMetrics: true,
});
