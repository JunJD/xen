import { useState } from 'react';
import {
  ArrowLeftRight,
  Bell,
  BookOpen,
  MoreVertical,
  Settings,
  Star,
} from 'lucide-react';
import { GrammarTokens } from '@/components/GrammarTokens';

function App() {
  const [isLoggedIn] = useState(true);
  const [notificationCount, setNotificationCount] = useState(2);

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

          <GrammarTokens />

        </div>

        <div className="border-t border-border-primary bg-background-quaternary p-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button className="flex items-center gap-1.5 rounded bg-action-secondary px-3 py-1.5 text-xs text-black transition-colors hover:bg-text-quaternary">
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
