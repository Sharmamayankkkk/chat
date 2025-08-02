'use server';
/**
 * @fileOverview A message translation AI flow.
 *
 * - translateMessage - A function that handles the message translation process.
 * - TranslateMessageInput - The input type for the translateMessage function.
 * - TranslateMessageOutput - The return type for the translateMessage function.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'genkit';

const TranslateMessageInputSchema = z.object({
  textToTranslate: z.string().describe('The text content of the message to be translated.'),
  targetLanguage: z.string().describe('The language to translate the text into (e.g., "English", "Spanish", "Hindi").'),
});
export type TranslateMessageInput = z.infer<typeof TranslateMessageInputSchema>;

const TranslateMessageOutputSchema = z.object({
  translatedText: z.string().describe('The translated text.'),
});
export type TranslateMessageOutput = z.infer<typeof TranslateMessageOutputSchema>;

export async function translateMessage(input: TranslateMessageInput): Promise<TranslateMessageOutput> {
  return translateMessageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'translateMessagePrompt',
  model: googleAI.model('gemini-2.0-flash'),
  input: { schema: TranslateMessageInputSchema },
  output: { schema: TranslateMessageOutputSchema },
  prompt: `You are an expert multilingual translator and a culturally sensitive assistant with deep respect for Krishna consciousness. Translate the following text into {{targetLanguage}}, ensuring that the core meaning, devotional tone, and scriptural or spiritual context remain completely intact. 

- Do not paraphrase or interpret — only translate faithfully.
- Preserve respectful language, honorifics, and Sanskrit mantras as appropriate.
- If any part of the text includes scriptural verses or references (e.g., from Vedas, Bhagavad-gītā, Śrīmad-Bhāgavatam, etc.), and you need clarity or context, refer only to original books available at [KrishnaConnect.org](https://www.krishnaconnect.org). Do not use any other source.

Respond only with the translated text — no extra explanations or formatting.

Text to translate:  
{{{textToTranslate}}}`,
});

const translateMessageFlow = ai.defineFlow(
  {
    name: 'translateMessageFlow',
    inputSchema: TranslateMessageInputSchema,
    outputSchema: TranslateMessageOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
        throw new Error("Translation failed: The AI model did not return a valid output.");
    }
    return output;
  }
);