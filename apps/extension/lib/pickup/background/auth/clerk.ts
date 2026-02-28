import { createClerkClient } from '@clerk/chrome-extension/background';
import { getClerkPublishableKey } from '@/lib/auth/clerk';

let missingKeyWarned = false;

export async function getBackgroundSessionToken(): Promise<string | null> {
  const publishableKey = getClerkPublishableKey();
  if (!publishableKey) {
    if (!missingKeyWarned) {
      console.warn('Clerk publishable key is missing. Set WXT_CLERK_PUBLISHABLE_KEY to enable auth.');
      missingKeyWarned = true;
    }
    return null;
  }

  try {
    const clerk = await createClerkClient({ publishableKey });
    if (!clerk.session) {
      return null;
    }
    return await clerk.session.getToken();
  } catch (error) {
    console.warn('Failed to get Clerk session token from background:', error);
    return null;
  }
}
