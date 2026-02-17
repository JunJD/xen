import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { TranslateProviderAdapter } from '../types';

type OpenAITranslateProviderOptions = {
  id?: 'llm';
  label?: string;
  model: string;
  targetLangName: string;
  resolveApiKey: () => Promise<string>;
};

export function createOpenAITranslateProvider(
  options: OpenAITranslateProviderOptions,
): TranslateProviderAdapter {
  const {
    id = 'llm',
    label = 'OpenAI Translate',
    model,
    targetLangName,
    resolveApiKey,
  } = options;

  return {
    id,
    label,
    async translate(request) {
      const apiKey = await resolveApiKey();
      if (!apiKey) {
        throw new Error('LLM translate requires an API key.');
      }

      const openai = createOpenAI({ apiKey });
      const promptTarget = request.targetLangName ?? targetLangName;
      const { text } = await generateText({
        model: openai(model),
        system: 'You are a translation engine. Translate accurately and return only the translation.',
        prompt: `Translate the following text into ${promptTarget}.\n\n${request.text}`,
        temperature: 0,
      });

      return { provider: id, text: text.trim() };
    },
  };
}
