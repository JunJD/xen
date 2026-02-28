import { createShadowRootUi, defineContentScript } from '#imports';
import ReactDOM from 'react-dom/client';
import { FloatingSidebar } from '@/components/FloatingSidebar';
import { DEFAULT_PICKUP_SETTINGS, getPickupSettings, isUrlIgnored } from '@/lib/pickup/settings';
import '@/styles/content.css';

export default defineContentScript({
  matches: ['*://*/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const settings = await getPickupSettings().catch(() => DEFAULT_PICKUP_SETTINGS);
    if (!settings.floatingSidebarEnabled) {
      return;
    }
    if (isUrlIgnored(window.location.href, settings.ignoreList)) {
      return;
    }
    const ui = await createShadowRootUi(ctx, {
      name: 'xen-pickup-sidebar',
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      onMount: (container, _shadow, shadowHost) => {
        shadowHost.setAttribute('data-pickup-ui', 'true');
        const wrapper = document.createElement('div');
        wrapper.setAttribute('data-pickup-ui', 'true');
        container.appendChild(wrapper);
        const root = ReactDOM.createRoot(wrapper);
        root.render(<FloatingSidebar />);
        return { root, wrapper };
      },
      onRemove: (elements) => {
        elements?.root.unmount();
        elements?.wrapper.remove();
      },
    });

    ui.mount();
  },
});
