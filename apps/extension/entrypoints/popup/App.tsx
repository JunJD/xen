import { useEffect, useState, type ChangeEvent } from 'react';
import {
  ArrowLeftRight,
  Bell,
  BookOpen,
  LoaderCircle,
  LogOut,
  MoreVertical,
  Settings,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { PickupTokens } from '@/components/PickupTokens';
import { openAuthWindow } from '@/lib/auth/clerk';
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
  const response = await sendMessage(MESSAGE_TYPES.openOptions);
  if (!response?.ok) {
    throw new Error('Failed to open options page.');
  }
}

type PopupAuthStatus = {
  authenticated: boolean;
  userId: string | null;
};

const INITIAL_AUTH_STATUS: PopupAuthStatus = {
  authenticated: false,
  userId: null,
};

function App() {
  const [notificationCount, setNotificationCount] = useState(2);
  const [modelStatus, setModelStatus] = useState<PickupModelStatus>(INITIAL_MODEL_STATUS);
  const [translateProvider, setTranslateProvider] = useState<TranslateProvider>(DEFAULT_TRANSLATE_PROVIDER);
  const [authStatus, setAuthStatus] = useState<PopupAuthStatus>(INITIAL_AUTH_STATUS);
  const [authLoading, setAuthLoading] = useState(true);

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

  useEffect(() => {
    let disposed = false;
    let timerId: number | undefined;

    const refreshAuthStatus = async () => {
      const response = await sendMessage(MESSAGE_TYPES.authStatusGet);
      if (disposed) {
        return;
      }
      setAuthStatus({
        authenticated: Boolean(response?.authenticated),
        userId: typeof response?.userId === 'string' ? response.userId : null,
      });
      setAuthLoading(false);
      timerId = window.setTimeout(() => {
        void refreshAuthStatus();
      }, 2200);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshAuthStatus();
      }
    };

    void refreshAuthStatus();
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
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

  const handleSignOut = async () => {
    if (!authStatus.authenticated) {
      return;
    }
    await sendMessage(MESSAGE_TYPES.authSignOut);
    const next = await sendMessage(MESSAGE_TYPES.authStatusGet);
    setAuthStatus({
      authenticated: Boolean(next?.authenticated),
      userId: typeof next?.userId === 'string' ? next.userId : null,
    });
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
            {authStatus.authenticated ? (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-action-primary text-xs text-white">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-black">已登录</span>
                  <span className="text-[10px] text-text-tertiary">
                    {authStatus.userId ? `ID: ${authStatus.userId.slice(0, 8)}...` : 'Clerk 会话已同步'}
                  </span>
                </div>
                <button
                  className="ml-1 rounded border border-border-primary bg-background-secondary px-2 py-1 text-[10px] text-black transition-colors hover:bg-background-secondary/60"
                  onClick={() => void handleSignOut()}
                >
                  <span className="inline-flex items-center gap-1">
                    <LogOut className="h-3 w-3" />
                    退出
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  className="rounded bg-action-primary px-3 py-1.5 text-xs text-white transition-colors hover:bg-action-active"
                  onClick={() => void openAuthWindow('sign-in')}
                >
                  登录
                </button>
                <button
                  className="rounded border border-border-primary bg-background-quaternary px-3 py-1.5 text-xs text-black transition-colors hover:bg-background-secondary"
                  onClick={() => void openAuthWindow('sign-up')}
                >
                  注册
                </button>
              </div>
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
          {!authStatus.authenticated && !authLoading && (
            <div className="mb-2 rounded border border-border-primary bg-background-secondary px-3 py-2 text-[11px] text-text-tertiary">
              点击登录/注册将打开网站认证页；完成后状态会自动同步到 popup。
            </div>
          )}
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
