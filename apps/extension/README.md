# Xen Extension

## Run

```bash
pnpm --filter @xen/extension dev
```

## Clerk Setup

1. Copy `.env.example` to `.env.local` in `apps/extension`.
2. Set `WXT_CLERK_PUBLISHABLE_KEY` from Clerk Dashboard.
3. Set `WXT_CLERK_FRONTEND_API` to your Clerk Frontend API host/url.
4. Ensure Clerk instance `allowed_origins` contains your extension origin:
   `chrome-extension://<your-extension-id>`.

## Notes

- `WXT_CLERK_FRONTEND_API` is Clerk's Frontend API endpoint, not your own backend API.
- Popup uses `ClerkProvider` for sign in/up UI.
- Background exposes `pickupAuthTokenGet` to fetch a Clerk session token for API calls.
