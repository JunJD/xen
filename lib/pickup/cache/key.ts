import { sha256 } from 'js-sha256';

export function buildCacheKey(sourceHash: string, modelKey: string) {
  return sha256(`${modelKey}|${sourceHash}`);
}
