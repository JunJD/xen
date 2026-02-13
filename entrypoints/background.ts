import { defineBackground } from '#imports';
import Dexie, { type Table } from 'dexie';
import { sha256 } from 'js-sha256';
import type { PickupAnnotation, PickupParagraph, PickupToken } from '@/lib/pickup/messages';
import { onMessage } from '@/lib/pickup/messaging';

const TAGS = ['S', 'V', 'O', 'Attr', 'Adv', 'C', 'PP', 'Clause', 'Conj'];

type PickupCacheEntry = {
  hash: string;
  tokens: PickupToken[];
  updatedAt: number;
};

class PickupCacheDB extends Dexie {
  annotations!: Table<PickupCacheEntry, string>;

  constructor() {
    super('xenPickupCache');
    this.version(1).stores({
      annotations: '&hash, updatedAt',
    });
  }
}

const db = new PickupCacheDB();

function buildTokens(text: string): PickupToken[] {
  const words = text.split(/\s+/).filter(Boolean);
  return words.map((word, index) => {
    const typeId = (index % TAGS.length) + 1;
    return {
      text: word,
      tag: TAGS[typeId - 1],
      typeId,
    };
  });
}

async function getCachedTokens(hash: string) {
  try {
    return await db.annotations.get(hash);
  }
  catch {
    return null;
  }
}

async function setCachedTokens(hash: string, tokens: PickupToken[]) {
  try {
    await db.annotations.put({
      hash,
      tokens,
      updatedAt: Date.now(),
    });
  }
  catch {
    return;
  }
}

export default defineBackground(() => {
  onMessage('pickupAnnotate', async (message) => {
    const paragraphs = (message.data?.paragraphs ?? []) as PickupParagraph[];
    const annotations: PickupAnnotation[] = [];

    for (const paragraph of paragraphs) {
      const hash = paragraph.hash ?? sha256(paragraph.text);
      const cached = await getCachedTokens(hash);
      if (cached?.tokens) {
        annotations.push({ id: paragraph.id, tokens: cached.tokens });
        continue;
      }
      const tokens = buildTokens(paragraph.text);
      annotations.push({ id: paragraph.id, tokens });
      await setCachedTokens(hash, tokens);
    }

    return { annotations };
  });
});
