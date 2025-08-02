
'use server';
/**
 * @fileOverview A message translation AI flow.
 *
 * - translateMessage - A function that handles the message translation process.
 * - TranslateMessageInput - The input type for the translateMessage function.
 * - TranslateMessageOutput - The return type for the translateMessage function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const TranslateMessageInputSchema = z.object({
  textToTranslate: z.string().describe('The text content of the message to be translated.'),
  targetLanguage: z.string().describe('The language to translate the text into (e.g., "English", "Spanish", "Hindi").'),
});
export type TranslateMessageInput = z.infer<typeof TranslateMessageInputSchema>;

export const TranslateMessageOutputSchema = z.object({
  translatedText: z.string().describe('The translated text.'),
});
export type TranslateMessageOutput = z.infer<typeof TranslateMessageOutputSchema>;

export async function translateMessage(input: TranslateMessageInput): Promise<TranslateMessageOutput> {
  return translateMessageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'translateMessagePrompt',
  input: { schema: TranslateMessageInputSchema },
  output: { schema: TranslateMessageOutputSchema },
  prompt: `You are an expert multilingual translator. Translate the following text into {{targetLanguage}}.
Provide only the translated text as your response, with no extra commentary or explanations.

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
