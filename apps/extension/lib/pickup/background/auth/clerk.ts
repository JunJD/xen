import { createClerkClient } from '@clerk/chrome-extension/background';
import {
  requireClerkPublishableKey,
  requireClerkSyncHost,
} from '@/lib/auth/clerk';

type BackgroundAuthStatus = {
  enabled: boolean;
  authenticated: boolean;
  userId: string | null;
};
type ClerkBackgroundClient = Awaited<ReturnType<typeof createClerkClient>>;
let clerkClientPromise: Promise<ClerkBackgroundClient> | null = null;

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = `${base64}${'='.repeat(padLength)}`;
  return atob(padded);
}

function readUserIdFromJwt(token: string): string {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('Invalid Clerk session token format.');
  }
  const payload = JSON.parse(decodeBase64Url(parts[1])) as { sub?: unknown };
  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw new Error('Clerk session token is missing user id.');
  }
  return payload.sub;
}

async function getClerkClient(): Promise<ClerkBackgroundClient> {
  if (!clerkClientPromise) {
    const publishableKey = requireClerkPublishableKey();
    const syncHost = requireClerkSyncHost();
    clerkClientPromise = createClerkClient({
      publishableKey,
      syncHost,
    });
  }
  return await clerkClientPromise;
}

export async function getBackgroundSessionToken(): Promise<string | null> {
  const clerk = await getClerkClient();
  return await clerk.session?.getToken() ?? null;
}

export async function getBackgroundAuthStatus(): Promise<BackgroundAuthStatus> {
  requireClerkPublishableKey();
  requireClerkSyncHost();
  const token = await getBackgroundSessionToken();
  if (!token) {
    return { enabled: true, authenticated: false, userId: null };
  }

  return {
    enabled: true,
    authenticated: true,
    userId: readUserIdFromJwt(token),
  };
}

export async function signOutBackgroundSession(): Promise<boolean> {
  const clerk = await getClerkClient();
  if (typeof clerk.signOut !== 'function') {
    throw new Error('Clerk signOut is unavailable in background client.');
  }
  await clerk.signOut();
  return true;
}
