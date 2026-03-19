# Xen Extension

## Run

```bash
pnpm --filter @xen/extension dev
```

## Testing

```bash
pnpm --filter @xen/extension test
```

Acceptance `.feature` coverage uses the lightweight Vitest harness in `tests/acceptance`. See `docs/bdd-acceptance-harness.md`.

## Clerk Setup

1. Copy `.env.example` to `.env.local` in `apps/extension`.
2. Set `WXT_CLERK_PUBLISHABLE_KEY` from Clerk Dashboard.
3. Set `WXT_CLERK_SYNC_HOST` to your website host (for example `https://localhost:3010`).
4. Set `WXT_CLERK_FRONTEND_API` to your Clerk Frontend API host/url.
5. Ensure Clerk instance `allowed_origins` contains your extension origin:
   `chrome-extension://<your-extension-id>`.

## Notes

- `WXT_CLERK_FRONTEND_API` is Clerk's Frontend API endpoint, not your own backend API.
- Popup/options "登录/注册" always open your website `/sign-in` and `/sign-up`.
- 登录完成后，background 会自动关闭该认证页标签。
- Popup auth state comes from background messages (`pickupAuthStatusGet`), avoiding stale UI state.
- Background exposes `pickupAuthTokenGet` to fetch a Clerk session token for API calls.

## OAuth Troubleshooting

If email login works but GitHub/Google does not:

1. In Clerk Dashboard, ensure the Google and GitHub providers are enabled for your instance.
2. In Clerk instance settings, ensure `allowed_origins` includes:
   `chrome-extension://<your-extension-id>`.
3. Reload the extension after any env/manifest changes.
