import { defineConfig } from 'wxt';

function toHostPermission(frontendApi: string): string | null {
  const normalized = frontendApi.trim();
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized.startsWith('http') ? normalized : `https://${normalized}`);
    return `${url.origin}/*`;
  } catch {
    return null;
  }
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ mode }) => {
    const clerkFrontendApi = import.meta.env.WXT_CLERK_FRONTEND_API
      || import.meta.env.VITE_CLERK_FRONTEND_API
      || '';
    const clerkSyncHost = import.meta.env.WXT_CLERK_SYNC_HOST
      || import.meta.env.VITE_CLERK_SYNC_HOST
      || '';
    const clerkHostPermission = toHostPermission(clerkFrontendApi);
    const clerkSyncHostPermission = toHostPermission(clerkSyncHost);

    const hostPermissions = [
      'https://translate.googleapis.com/*',
      'https://api.openai.com/*',
      ...(mode === 'development' ? ['http://localhost/*'] : []),
      ...(clerkSyncHostPermission ? [clerkSyncHostPermission] : []),
      ...(clerkHostPermission ? [clerkHostPermission] : []),
    ];

    return {
      name: 'Xen',
      description: '沉浸式网页翻译与语法/词汇高亮，支持双模式、忽略名单与 LLM 模型。',
      version: '0.1.0',
      permissions: ['offscreen', 'storage', 'cookies'],
      options_ui: {
        page: 'options.html',
        openInTab: true,
      },
      host_permissions: hostPermissions,
      content_security_policy: {
        extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
      },
      web_accessible_resources: [
        {
          resources: ['content-scripts/pickupSidebar.css'],
          use_dynamic_url: true,
          matches: ['*://*/*'],
        },
        {
          resources: ['wxt.svg', 'wxt-light.svg', 'icon/*.png'],
          matches: ['*://*/*'],
        },
      ],
      action: {
        default_title: 'Xen',
        default_popup: 'popup.html',
      },
    };
  },
});
