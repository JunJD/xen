import { Readability } from '@mozilla/readability';
import { PICKUP_UI_OR_IGNORE_SELECTOR } from './markers';

let cachedArticle: { url: string; text: string } | null = null;

function shouldResetCache() {
  return cachedArticle?.url !== window.location.href;
}

function removeInjectedNodes(documentClone: Document) {
  documentClone.querySelectorAll(PICKUP_UI_OR_IGNORE_SELECTOR).forEach((node) => {
    node.remove();
  });
}

export function getArticleText() {
  if (cachedArticle && !shouldResetCache()) {
    return cachedArticle.text;
  }

  const documentClone = document.cloneNode(true) as Document;
  removeInjectedNodes(documentClone);

  let textContent = '';
  try {
    const article = new Readability(documentClone, { serializer: el => el }).parse();
    textContent = article?.textContent ?? '';
  }
  catch {
    textContent = '';
  }

  if (!textContent) {
    textContent = document.body?.textContent ?? '';
  }

  cachedArticle = {
    url: window.location.href,
    text: textContent,
  };

  return textContent;
}
