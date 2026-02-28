import { useEffect, useState, type ChangeEvent } from 'react';
import {
  ArrowLeftRight,
  Bell,
  BookOpen,
  LoaderCircle,
  MoreVertical,
  Settings,
  Star,
} from 'lucide-react';
import { PickupTokens } from '@/components/PickupTokens';
import type { PickupModelStatus, TranslateProvider } from '@/lib/pickup/messages';
import { sendMessage, MESSAGE_TYPES } from '@/lib/pickup/messaging';
import { DEFAULT_TRANSLATE_PROVIDER, TRANSLATE_PROVIDERS, TRANSLATE_PROVIDER_LABELS } from '@/lib/pickup/translate/options';

const INITIAL_MODEL_STATUS: PickupModelStatus = {
  status: 'idle',
  error: null,
  startedAt: null,
  readyAt: null,
  progress: 0,
  stage: '等待初始化',
};

async function openOptionsPage() {
  try {
    const response = await sendMessage(MESSAGE_TYPES.openOptions);
    if (response?.ok) {
      return;
    }
  } catch {
    // Ignore and fallback.
  }
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create && chrome.runtime?.getURL) {
      await chrome.tabs.create({ url: chrome.runtime.getURL('options.html#general') });
      return;
    }
  } catch {
    // Ignore and fallback to location-based navigation.
  }
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      await chrome.runtime.openOptionsPage();
      return;
    }
  } catch {
    // Ignore.
  }
}

function App() {
  const [isLoggedIn] = useState(true);
  const [notificationCount, setNotificationCount] = useState(2);
  const [modelStatus, setModelStatus] = useState<PickupModelStatus>(INITIAL_MODEL_STATUS);
  const [translateProvider, setTranslateProvider] = useState<TranslateProvider>(DEFAULT_TRANSLATE_PROVIDER);

  useEffect(() => {
    let disposed = false;
    let timerId: number | undefined;

    const scheduleNext = (delay: number) => {
      timerId = window.setTimeout(() => {
        void pollStatus();
      }, delay);
    };

    const pollStatus = async () => {
      try {
        const response = await sendMessage(MESSAGE_TYPES.modelStatus);
        if (disposed) {
          return;
        }

        const nextStatus = response?.status ?? INITIAL_MODEL_STATUS;
        setModelStatus(nextStatus);

        if (nextStatus.status === 'idle' || nextStatus.status === 'error') {
          void sendMessage(MESSAGE_TYPES.modelWarmup).catch(() => undefined);
        }

        if (nextStatus.status !== 'ready') {
          scheduleNext(700);
        }
      }
      catch {
        if (!disposed) {
          scheduleNext(1200);
        }
      }
    };

    void sendMessage(MESSAGE_TYPES.modelWarmup).catch(() => undefined);
    void pollStatus();

    return () => {
      disposed = true;
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const loadProvider = async () => {
      try {
        const response = await sendMessage(MESSAGE_TYPES.translateProviderGet);
        if (!disposed && response?.provider) {
          setTranslateProvider(response.provider);
        }
      }
      catch {
        // Ignore provider load errors and keep default.
      }
    };
    void loadProvider();
    return () => {
      disposed = true;
    };
  }, []);

  const handleProviderChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const nextProvider = event.target.value as TranslateProvider;
    setTranslateProvider(nextProvider);
    try {
      await sendMessage(MESSAGE_TYPES.translateProviderSet, { provider: nextProvider });
    }
    catch {
      // Ignore provider update errors.
    }
  };

  if (modelStatus.status !== 'ready') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background-tertiary">
        <div className="flex w-[360px] flex-col items-center gap-3 rounded border border-border-primary bg-background-quaternary p-6 text-center">
          <LoaderCircle className="h-6 w-6 animate-spin text-icon-primary" />
          <p className="text-sm text-black">模型正在初始化，请稍候...</p>
          <p className="text-xs text-text-tertiary">当前状态: {modelStatus.status}</p>
          <p className="text-xs text-text-tertiary">{modelStatus.stage}</p>
          <div className="h-2 w-full overflow-hidden rounded bg-background-secondary">
            <div
              className="h-full bg-action-primary transition-all duration-300"
              style={{ width: `${modelStatus.progress}%` }}
            />
          </div>
          <p className="text-xs text-black">{modelStatus.progress}%</p>
          {modelStatus.error && (
            <p className="text-xs text-status-warning">重试中: {modelStatus.error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-background-tertiary">
      <div className="flex  w-[360px] flex-col bg-background-quaternary">
        <div className="flex items-center justify-between border-b border-border-primary bg-background-quaternary p-4">
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-action-primary text-xs text-white">
                  ZH
                </div>
                <span className="text-sm text-black">张华</span>
              </>
            ) : (
              <button className="rounded bg-action-primary px-3 py-1.5 text-xs text-white transition-colors hover:bg-action-active">
                登录
              </button>
            )}
          </div>

          <div className="relative">
            <button
              className="relative rounded p-1.5 transition-colors hover:bg-background-secondary"
              onClick={() => setNotificationCount(0)}
            >
              <Bell className="h-4 w-4 text-icon-primary" />
              {notificationCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-status-failure text-[10px] text-white">
                  {notificationCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-3">
          <div className="flex items-center justify-between rounded border border-border-primary bg-background-secondary p-3">
            <span className="text-xs text-text-tertiary">翻译语言</span>
            <div className="flex items-center gap-2 text-xs text-black">
              <span>EN</span>
              <ArrowLeftRight className="h-3 w-3 text-icon-primary" />
              <span>中文</span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between rounded border border-border-primary bg-background-secondary p-3">
            <span className="text-xs text-text-tertiary">翻译服务</span>
            <select
              className="rounded border border-border-primary bg-background-quaternary px-2 py-1 text-xs text-black outline-none focus:border-action-primary"
              value={translateProvider}
              onChange={handleProviderChange}
            >
              {TRANSLATE_PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>
                  {TRANSLATE_PROVIDER_LABELS[provider]}
                </option>
              ))}
            </select>
          </div>

          <PickupTokens />
        </div>

        <div className="border-t border-border-primary bg-background-quaternary p-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                className="flex items-center gap-1.5 rounded bg-action-secondary px-3 py-1.5 text-xs text-black transition-colors hover:bg-text-quaternary"
                onClick={() => void openOptionsPage()}
              >
                <Settings className="h-3.5 w-3.5 text-icon-primary" />
                <span>设置</span>
              </button>
              <button className="flex items-center gap-1.5 rounded bg-action-secondary px-3 py-1.5 text-xs text-black transition-colors hover:bg-text-quaternary">
                <BookOpen className="h-3.5 w-3.5 text-icon-primary" />
                <span>历史</span>
              </button>
              <button className="flex items-center gap-1.5 rounded bg-action-secondary px-3 py-1.5 text-xs text-black transition-colors hover:bg-text-quaternary">
                <Star className="h-3.5 w-3.5 text-icon-primary" />
                <span>收藏</span>
              </button>
            </div>

            <button className="rounded p-1.5 transition-colors hover:bg-background-secondary">
              <MoreVertical className="h-4 w-4 text-icon-primary" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
