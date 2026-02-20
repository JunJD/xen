import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Xen',
    description: '沉浸式网页翻译与语法/词汇高亮，支持双模式、忽略名单与 LLM 模型。',
    version: '0.1.0',
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
    action: {
      default_title: 'Xen',
      default_popup: 'popup.html',
    },
  },
});
