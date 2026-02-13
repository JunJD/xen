type ChromeRuntimeContextQuery = {
  contextTypes?: string[];
  documentUrls?: string[];
};

type ChromeRuntimeContext = {
  contextType?: string;
  documentUrl?: string;
};

type ChromeRuntimeMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void,
) => boolean | void;

interface ChromeRuntimeLike {
  getURL?: (path: string) => string;
  sendMessage?: <TResponse = unknown>(message: unknown) => Promise<TResponse>;
  getContexts?: (query: ChromeRuntimeContextQuery) => Promise<ChromeRuntimeContext[]>;
  onInstalled?: { addListener: (callback: () => void) => void };
  onStartup?: { addListener: (callback: () => void) => void };
  onMessage?: { addListener: (callback: ChromeRuntimeMessageListener) => void };
  lastError?: { message?: string };
}

interface ChromeOffscreenLike {
  createDocument?: (options: {
    url: string;
    reasons: string[];
    justification: string;
  }) => Promise<void>;
}

type ChromeStorageChange = {
  oldValue?: unknown;
  newValue?: unknown;
};

interface ChromeStorageAreaLike {
  get?: (keys?: string | string[] | Record<string, unknown> | null) => Promise<Record<string, unknown>>;
  set?: (items: Record<string, unknown>) => Promise<void>;
  remove?: (keys: string | string[]) => Promise<void>;
  clear?: () => Promise<void>;
  getBytesInUse?: (keys?: string | string[] | null) => Promise<number>;
}

interface ChromeStorageLike {
  local?: ChromeStorageAreaLike;
  sync?: ChromeStorageAreaLike;
  session?: ChromeStorageAreaLike;
  onChanged?: {
    addListener: (callback: (changes: Record<string, ChromeStorageChange>, areaName: string) => void) => void;
  };
}

type ChromeTab = {
  id?: number;
  url?: string;
  active?: boolean;
  windowId?: number;
  index?: number;
};

type ChromeTabsQueryInfo = {
  active?: boolean;
  currentWindow?: boolean;
  windowId?: number;
  url?: string | string[];
};

interface ChromeTabsLike {
  query?: (queryInfo: ChromeTabsQueryInfo) => Promise<ChromeTab[]>;
  get?: (tabId: number) => Promise<ChromeTab | undefined>;
  create?: (createProperties: { url?: string; active?: boolean; index?: number }) => Promise<ChromeTab>;
  update?: (tabId: number, updateProperties: { url?: string; active?: boolean }) => Promise<ChromeTab>;
  sendMessage?: <TResponse = unknown>(tabId: number, message: unknown) => Promise<TResponse>;
}

type ChromeAlarm = {
  name?: string;
  scheduledTime?: number;
  periodInMinutes?: number;
};

interface ChromeAlarmsLike {
  create?: (name?: string, alarmInfo?: { when?: number; delayInMinutes?: number; periodInMinutes?: number }) => void;
  clear?: (name?: string) => Promise<boolean>;
  clearAll?: () => Promise<boolean>;
  get?: (name: string) => Promise<ChromeAlarm | undefined>;
  getAll?: () => Promise<ChromeAlarm[]>;
  onAlarm?: { addListener: (callback: (alarm: ChromeAlarm) => void) => void };
}

interface ChromeActionLike {
  setBadgeText?: (details: { tabId?: number; text: string }) => Promise<void> | void;
  setBadgeBackgroundColor?: (details: { tabId?: number; color: string | [number, number, number, number] }) => Promise<void> | void;
  setTitle?: (details: { tabId?: number; title: string }) => Promise<void> | void;
  setIcon?: (details: { tabId?: number; path: string | Record<string, string> }) => Promise<void> | void;
}

interface ChromeLike {
  runtime?: ChromeRuntimeLike;
  offscreen?: ChromeOffscreenLike;
  storage?: ChromeStorageLike;
  tabs?: ChromeTabsLike;
  alarms?: ChromeAlarmsLike;
  action?: ChromeActionLike;
}

declare const chrome: ChromeLike | undefined;
