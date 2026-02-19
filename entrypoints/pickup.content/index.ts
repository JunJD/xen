import { defineContentScript } from '#imports';
import {
  PICKUP_CONTROL_ACTION_QUERY,
  PICKUP_CONTROL_ACTION_SET_MODE,
  PICKUP_CONTROL_ACTION_START,
  PICKUP_CONTROL_ACTION_STOP,
  PICKUP_CONTROL_ACTION_TOGGLE,
  PICKUP_CONTROL_ACTION_TOGGLE_MODE,
  PICKUP_CONTROL_EVENT,
  PICKUP_STATE_EVENT,
  type PickupControlDetail,
  type PickupStateDetail,
} from '@/lib/pickup/content/control-events';
import { createPickupRunner } from '@/lib/pickup/content/runner';
import {
  applyPickupRenderMode,
  isPickupRenderMode,
  initPickupRenderMode,
  persistPickupRenderMode,
  togglePickupRenderMode,
  type PickupRenderMode,
} from '@/lib/pickup/content/render-mode';
import { applyPickupStyleSettings } from '@/lib/pickup/content/style-settings';
import { DEFAULT_PICKUP_SETTINGS, getPickupSettings, isUrlIgnored } from '@/lib/pickup/settings';

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_idle',
  async main() {
    const settings = await getPickupSettings().catch(() => DEFAULT_PICKUP_SETTINGS);
    if (isUrlIgnored(window.location.href, settings.ignoreList)) {
      return;
    }
    const runner = createPickupRunner();
    let currentMode: PickupRenderMode = initPickupRenderMode();
    if (settings.defaultRenderMode && settings.defaultRenderMode !== currentMode) {
      currentMode = settings.defaultRenderMode;
      persistPickupRenderMode(currentMode);
      applyPickupRenderMode(currentMode);
    }
    applyPickupStyleSettings(settings);
    if (settings.enabled) {
      runner.start();
    }

    const emitState = () => {
      const detail: PickupStateDetail = { active: runner.isStarted(), mode: currentMode };
      window.dispatchEvent(new CustomEvent(PICKUP_STATE_EVENT, { detail }));
    };

    const handleControl = (event: Event) => {
      const customEvent = event as CustomEvent<PickupControlDetail>;
      const action = customEvent.detail?.action;
      if (!action) {
        return;
      }

      if (action === PICKUP_CONTROL_ACTION_QUERY) {
        emitState();
        return;
      }

      if (action === PICKUP_CONTROL_ACTION_START) {
        runner.start();
        emitState();
        return;
      }

      if (action === PICKUP_CONTROL_ACTION_STOP) {
        runner.stop();
        runner.restore();
        emitState();
        return;
      }

      if (action === PICKUP_CONTROL_ACTION_TOGGLE) {
        if (runner.isStarted()) {
          runner.stop();
          runner.restore();
        } else {
          runner.start();
        }
        emitState();
        return;
      }

      if (action === PICKUP_CONTROL_ACTION_SET_MODE) {
        const nextMode = isPickupRenderMode(customEvent.detail?.mode)
          ? customEvent.detail.mode
          : currentMode;
        if (nextMode !== currentMode) {
          currentMode = nextMode;
          persistPickupRenderMode(currentMode);
          applyPickupRenderMode(currentMode);
        }
        emitState();
        return;
      }

      if (action === PICKUP_CONTROL_ACTION_TOGGLE_MODE) {
        currentMode = togglePickupRenderMode(currentMode);
        persistPickupRenderMode(currentMode);
        applyPickupRenderMode(currentMode);
        emitState();
        return;
      }
    };

    window.addEventListener(PICKUP_CONTROL_EVENT, handleControl as EventListener);
    emitState();
  },
});
