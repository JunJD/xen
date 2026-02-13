import type { PickupAnnotation } from '@/lib/pickup/messages';
import { buildSentenceAstFromTokens } from './adapter';
import { DEFAULT_AST_ADAPTER_ID, persistAstAdapterId, resolveAstAdapterId } from './config';
import type { SentenceAst } from './types';

export type AstAdapterInput = {
  annotation: PickupAnnotation;
  text: string;
};

export type AstAdapter = {
  id: string;
  name: string;
  buildSentenceAst: (input: AstAdapterInput) => SentenceAst;
};

const adapters = new Map<string, AstAdapter>();

const defaultAdapter: AstAdapter = {
  id: DEFAULT_AST_ADAPTER_ID,
  name: 'SpaCy + Rule GrammarPoints',
  buildSentenceAst: ({ annotation, text }) => buildSentenceAstFromTokens(annotation, text),
};

registerAstAdapter(defaultAdapter);

let activeAdapterId = resolveAstAdapterId();

export function registerAstAdapter(adapter: AstAdapter) {
  adapters.set(adapter.id, adapter);
}

export function listAstAdapters() {
  return Array.from(adapters.values());
}

export function setActiveAstAdapter(adapterId: string, options: { persist?: boolean } = {}) {
  if (!adapters.has(adapterId)) {
    return false;
  }
  activeAdapterId = adapterId;
  if (options.persist) {
    persistAstAdapterId(adapterId);
  }
  return true;
}

export function getActiveAstAdapter(): AstAdapter {
  return adapters.get(activeAdapterId) ?? defaultAdapter;
}

export function buildSentenceAst(input: AstAdapterInput): SentenceAst {
  return getActiveAstAdapter().buildSentenceAst(input);
}
