import { defineContentScript } from '#imports';
import {
  PICKUP_CONTROL_ACTION_QUERY,
  PICKUP_CONTROL_ACTION_SET_MODE,
  PICKUP_CONTROL_ACTION_START,
  PICKUP_CONTROL_ACTION_STOP,
  PICKUP_CONTROL_ACTION_TOGGLE,
  PICKUP_CONTROL_ACTION_TOGGLE_MODE,
  PICKUP_CONTROL_ACTION_TOGGLE_TRANSLATION,
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
import {
  applyPickupTranslationPreviewEnabled,
  initPickupTranslationPreviewEnabled,
  persistPickupTranslationPreviewEnabled,
} from '@/lib/pickup/content/translation-preview-mode';
import {
  DEFAULT_PICKUP_SETTINGS,
  PICKUP_SETTINGS_STORAGE_KEY,
  getPickupSettings,
  isUrlIgnored,
  normalizePickupSettings,
  type PickupSettings,
} from '@/lib/pickup/settings';

type StorageChangeRecord = Record<string, { newValue?: unknown }>;
type StorageOnChangedLike = {
  addListener?: (callback: (changes: StorageChangeRecord, areaName?: string) => void) => void;
  removeListener?: (callback: (changes: StorageChangeRecord, areaName?: string) => void) => void;
};

const PAGE_ENABLED_STORAGE_PREFIX = 'xenPickupPageEnabled:';

function getPageEnabledStorageKey() {
  try {
    const parsed = new URL(window.location.href);
    return `${PAGE_ENABLED_STORAGE_PREFIX}${parsed.hostname.toLowerCase()}`;
  } catch {
    return `${PAGE_ENABLED_STORAGE_PREFIX}${window.location.hostname || window.location.href}`;
  }
}

function resolveStoredPageEnabled(defaultValue = true) {
  try {
    const stored = window.localStorage?.getItem(getPageEnabledStorageKey());
    if (stored === 'true') {
      return true;
    }
    if (stored === 'false') {
      return false;
    }
  } catch {
    // Ignore storage access issues in restricted contexts.
  }
  return defaultValue;
}

function persistPageEnabled(enabled: boolean) {
  try {
    window.localStorage?.setItem(getPageEnabledStorageKey(), enabled ? 'true' : 'false');
  } catch {
    // Ignore storage access issues in restricted contexts.
  }
}

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_idle',
  async main() {
    const settings = await getPickupSettings().catch(() => DEFAULT_PICKUP_SETTINGS);
    if (isUrlIgnored(window.location.href, settings.ignoreList)) {
      return;
    }
    let translationEnabled = initPickupTranslationPreviewEnabled();
    let pageEnabled = resolveStoredPageEnabled(true);
    const runner = createPickupRunner({ translationPreviewEnabled: translationEnabled });
    let currentMode: PickupRenderMode = initPickupRenderMode();
    if (settings.defaultRenderMode && settings.defaultRenderMode !== currentMode) {
      currentMode = settings.defaultRenderMode;
      persistPickupRenderMode(currentMode);
      applyPickupRenderMode(currentMode);
    }
    applyPickupStyleSettings(settings);

    const safeStartRunner = () => {
      try {
        runner.start();
      } catch (error) {
        console.error('Pickup runner start failed:', error);
      }
    };

    const safeStopRunner = () => {
      try {
        runner.stop();
        runner.restore();
      } catch (error) {
        console.error('Pickup runner stop failed:', error);
      }
    };

    if (settings.enabled && pageEnabled) {
      safeStartRunner();
    }

    const emitState = () => {
      const detail: PickupStateDetail = {
        active: runner.isStarted(),
        mode: currentMode,
        translationEnabled,
      };
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
        safeStartRunner();
        pageEnabled = true;
        persistPageEnabled(pageEnabled);
        emitState();
        return;
      }

      if (action === PICKUP_CONTROL_ACTION_STOP) {
        safeStopRunner();
        pageEnabled = false;
        persistPageEnabled(pageEnabled);
        emitState();
        return;
      }

      if (action === PICKUP_CONTROL_ACTION_TOGGLE) {
        if (runner.isStarted()) {
          safeStopRunner();
        } else {
          safeStartRunner();
        }
        pageEnabled = runner.isStarted();
        persistPageEnabled(pageEnabled);
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

      if (action === PICKUP_CONTROL_ACTION_TOGGLE_TRANSLATION) {
        translationEnabled = !translationEnabled;
        persistPickupTranslationPreviewEnabled(translationEnabled);
        applyPickupTranslationPreviewEnabled(translationEnabled);
        runner.setTranslationPreviewEnabled(translationEnabled);
        emitState();
      }
    };

    window.addEventListener(PICKUP_CONTROL_EVENT, handleControl as EventListener);

    const storageOnChanged: StorageOnChangedLike | undefined = (typeof chrome !== 'undefined' && chrome.storage?.onChanged)
      ? chrome.storage.onChanged
      : (globalThis as { browser?: { storage?: { onChanged?: StorageOnChangedLike } } })
          .browser?.storage?.onChanged;

    const handleSettingsStorageChanged = (changes: StorageChangeRecord, areaName?: string) => {
      if (areaName && areaName !== 'local') {
        return;
      }
      const change = changes[PICKUP_SETTINGS_STORAGE_KEY];
      if (!change || typeof change !== 'object') {
        return;
      }

      const nextSettings = normalizePickupSettings(change.newValue as Partial<PickupSettings>);
      if (isUrlIgnored(window.location.href, nextSettings.ignoreList)) {
        if (runner.isStarted()) {
          safeStopRunner();
          emitState();
        }
        return;
      }

      applyPickupStyleSettings(nextSettings);

      if (nextSettings.enabled && pageEnabled && !runner.isStarted()) {
        safeStartRunner();
      } else if ((!nextSettings.enabled || !pageEnabled) && runner.isStarted()) {
        safeStopRunner();
      }
      emitState();
    };

    storageOnChanged?.addListener?.(handleSettingsStorageChanged);
    window.addEventListener(
      'pagehide',
      () => storageOnChanged?.removeListener?.(handleSettingsStorageChanged),
      { once: true },
    );

    emitState();
  },
});
