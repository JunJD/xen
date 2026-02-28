function normalizeEnvValue(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getClerkPublishableKey(): string {
  return normalizeEnvValue(
    import.meta.env.WXT_CLERK_PUBLISHABLE_KEY
      || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  );
}

export function getClerkFrontendApi(): string {
  return normalizeEnvValue(
    import.meta.env.WXT_CLERK_FRONTEND_API
      || import.meta.env.VITE_CLERK_FRONTEND_API,
  );
}

export function isClerkEnabled(): boolean {
  return getClerkPublishableKey().length > 0;
}

export function getExtensionPopupUrl(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL('popup.html');
  }
  return 'popup.html';
}
