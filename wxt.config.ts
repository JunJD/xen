import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ['offscreen', 'storage', 'tabs'],
    options_ui: {
      page: 'options.html',
      openInTab: true,
    },
    host_permissions: [
      'https://translate.googleapis.com/*',
      'https://api.openai.com/*',
    ],
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
  },
});
