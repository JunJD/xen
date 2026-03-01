type ModeStateConfig<T> = {
  globalKey: string;
  storageKey: string;
  datasetKey: string;
  defaultValue: T;
  normalize: (value: unknown) => T | null;
  serialize?: (value: T) => string;
  toDatasetValue?: (value: T) => string;
};

type GlobalScope = typeof globalThis & Record<string, unknown>;

function resolveSerializer<T>(config: ModeStateConfig<T>) {
  return config.serialize ?? ((value: T) => String(value));
}

function resolveDatasetFormatter<T>(config: ModeStateConfig<T>) {
  return config.toDatasetValue ?? ((value: T) => String(value));
}

export function resolveModeState<T>(config: ModeStateConfig<T>): T {
  if (typeof globalThis === 'undefined') {
    return config.defaultValue;
  }

  const scope = globalThis as GlobalScope;
  const globalValue = config.normalize(scope[config.globalKey]);
  if (globalValue !== null) {
    return globalValue;
  }

  try {
    const stored = window.localStorage?.getItem(config.storageKey);
    const storageValue = config.normalize(stored);
    if (storageValue !== null) {
      return storageValue;
    }
  } catch {
    // Ignore storage access issues in restricted contexts.
  }

  return config.defaultValue;
}

export function getStoredModeState<T>(config: ModeStateConfig<T>): T | null {
  if (typeof globalThis === 'undefined') {
    return null;
  }

  try {
    const stored = window.localStorage?.getItem(config.storageKey);
    return config.normalize(stored);
  } catch {
    // Ignore storage access issues in restricted contexts.
  }

  return null;
}

export function persistModeState<T>(config: ModeStateConfig<T>, value: T) {
  if (typeof globalThis === 'undefined') {
    return;
  }

  const scope = globalThis as GlobalScope;
  scope[config.globalKey] = value;

  try {
    const serialize = resolveSerializer(config);
    window.localStorage?.setItem(config.storageKey, serialize(value));
  } catch {
    // Ignore storage access issues in restricted contexts.
  }
}

export function applyModeState<T>(config: ModeStateConfig<T>, value: T) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  if (!root) {
    return;
  }

  const toDatasetValue = resolveDatasetFormatter(config);
  const datasetValue = toDatasetValue(value);
  if (root.dataset[config.datasetKey] !== datasetValue) {
    root.dataset[config.datasetKey] = datasetValue;
  }
}

export function initModeState<T>(config: ModeStateConfig<T>): T {
  const value = resolveModeState(config);
  applyModeState(config, value);
  return value;
}
