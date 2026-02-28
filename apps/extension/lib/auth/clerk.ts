import { sendMessage, MESSAGE_TYPES } from '@/lib/pickup/messaging';

function normalizeEnvValue(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeHostUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    return url.origin;
  } catch {
    return '';
  }
}

export function getClerkPublishableKey(): string {
  return normalizeEnvValue(
    import.meta.env.WXT_CLERK_PUBLISHABLE_KEY
      || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  );
}

export function requireClerkPublishableKey(): string {
  const key = getClerkPublishableKey();
  if (!key) {
    throw new Error('Missing WXT_CLERK_PUBLISHABLE_KEY. Auth requires a Clerk publishable key.');
  }
  return key;
}

export function getClerkSyncHost(): string {
  return normalizeHostUrl(
    import.meta.env.WXT_CLERK_SYNC_HOST
      || import.meta.env.VITE_CLERK_SYNC_HOST
      || '',
  );
}

export function requireClerkSyncHost(): string {
  const syncHost = getClerkSyncHost();
  if (!syncHost) {
    throw new Error('Missing WXT_CLERK_SYNC_HOST. Auth requires your web sign-in host.');
  }
  return syncHost;
}

export type AuthMode = 'sign-in' | 'sign-up';

export function buildWebAuthUrl(mode: AuthMode): string {
  const syncHost = requireClerkSyncHost();
  const path = mode === 'sign-up' ? '/sign-up' : '/sign-in';
  return new URL(path, `${syncHost}/`).toString();
}

export async function openAuthWindow(mode: AuthMode): Promise<void> {
  const response = await sendMessage(MESSAGE_TYPES.authOpen, { mode });
  if (!response?.ok || typeof response.tabId !== 'number') {
    throw new Error('Failed to open Clerk auth tab.');
  }
}
