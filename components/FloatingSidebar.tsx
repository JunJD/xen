import { useEffect, useRef, useState } from 'react';
import { Check, Languages, Settings, SquareCode } from 'lucide-react';
import {
  PICKUP_CONTROL_ACTION_QUERY,
  PICKUP_CONTROL_ACTION_TOGGLE_MODE,
  PICKUP_CONTROL_ACTION_TOGGLE,
  PICKUP_CONTROL_EVENT,
  PICKUP_STATE_EVENT,
  type PickupControlDetail,
  type PickupStateDetail,
} from '@/lib/pickup/content/control-events';
import {
  PICKUP_RENDER_MODE_SYNTAX_REBUILD,
  PICKUP_RENDER_MODE_VOCAB_INFUSION,
  type PickupRenderMode,
} from '@/lib/pickup/content/render-mode';

export function FloatingSidebar() {
  const [pickupActive, setPickupActive] = useState(true);
  const [pickupMode, setPickupMode] = useState<PickupRenderMode>(PICKUP_RENDER_MODE_SYNTAX_REBUILD);
  const [dockSide, setDockSide] = useState<'left' | 'right'>('right');
  const [dockPosition, setDockPosition] = useState(0.5);
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const initialClientYRef = useRef<number | null>(null);
  const initialClientXRef = useRef<number | null>(null);
  const initialPositionRef = useRef<number>(0.5);

  useEffect(() => {
    try {
      const stored = window.localStorage?.getItem('xenPickupSidebarDockSide');
      if (stored === 'left' || stored === 'right') {
        setDockSide(stored);
      }
      const storedPosition = window.localStorage?.getItem('xenPickupSidebarPosition');
      if (storedPosition) {
        const parsed = Number.parseFloat(storedPosition);
        if (Number.isFinite(parsed) && parsed > 0 && parsed < 1) {
          setDockPosition(parsed);
          initialPositionRef.current = parsed;
        }
      }
    } catch {
      // Ignore storage access issues in restricted contexts.
    }

    const handleState = (event: Event) => {
      const customEvent = event as CustomEvent<PickupStateDetail>;
      if (typeof customEvent.detail?.active === 'boolean') {
        setPickupActive(customEvent.detail.active);
      }
      if (customEvent.detail?.mode) {
        setPickupMode(customEvent.detail.mode);
      }
    };

    window.addEventListener(PICKUP_STATE_EVENT, handleState as EventListener);
    const queryDetail: PickupControlDetail = { action: PICKUP_CONTROL_ACTION_QUERY };
    window.dispatchEvent(new CustomEvent(PICKUP_CONTROL_EVENT, { detail: queryDetail }));

    return () => {
      window.removeEventListener(PICKUP_STATE_EVENT, handleState as EventListener);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage?.setItem('xenPickupSidebarDockSide', dockSide);
    } catch {
      // Ignore storage access issues in restricted contexts.
    }
  }, [dockSide]);

  useEffect(() => {
    try {
      window.localStorage?.setItem('xenPickupSidebarPosition', dockPosition.toString());
    } catch {
      // Ignore storage access issues in restricted contexts.
    }
  }, [dockPosition]);

  useEffect(() => {
    if (!isDragging && dragPosition !== null) {
      setDockPosition(dragPosition);
      setDragPosition(null);
      initialPositionRef.current = dragPosition;
    }
  }, [dragPosition, isDragging]);

  const handleTogglePickup = () => {
    const detail: PickupControlDetail = { action: PICKUP_CONTROL_ACTION_TOGGLE };
    window.dispatchEvent(new CustomEvent(PICKUP_CONTROL_EVENT, { detail }));
  };

  const handleToggleMode = () => {
    const detail: PickupControlDetail = { action: PICKUP_CONTROL_ACTION_TOGGLE_MODE };
    window.dispatchEvent(new CustomEvent(PICKUP_CONTROL_EVENT, { detail }));
  };

  const isVocabMode = pickupMode === PICKUP_RENDER_MODE_VOCAB_INFUSION;
  const modeLabel = isVocabMode ? '原生语法' : '翻译语法';
  const hiddenTranslate = dockSide === 'right' ? 'translate-x-12' : '-translate-x-12';
  const handleTranslate = dockSide === 'right' ? 'translate-x-5' : '-translate-x-5';
  const alignItems = dockSide === 'right' ? 'items-end' : 'items-start';
  const sidePosition = dockSide === 'right' ? 'right-0' : 'left-0';
  const handleRounded = dockSide === 'right' ? 'rounded-l-full border-r-0' : 'rounded-r-full border-l-0';
  const handlePadding = dockSide === 'right' ? 'pl-1' : 'pr-1';
  const edgeMargin = dockSide === 'right' ? 'mr-2' : 'ml-2';
  const currentPosition = dragPosition ?? dockPosition;

  const handleDragStart = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    initialClientYRef.current = event.clientY;
    initialClientXRef.current = event.clientX;
    initialPositionRef.current = currentPosition;
    let hasMoved = false;

    setIsDragging(true);
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - (initialClientYRef.current ?? moveEvent.clientY);
      const deltaX = moveEvent.clientX - (initialClientXRef.current ?? moveEvent.clientX);
      if (Math.abs(deltaY) > 5 || Math.abs(deltaX) > 5) {
        hasMoved = true;
      }
      if (!hasMoved) {
        return;
      }
      const initialY = initialPositionRef.current * window.innerHeight;
      const maxY = Math.max(100, window.innerHeight - 200);
      const nextY = Math.max(30, Math.min(maxY, initialY + deltaY));
      setDragPosition(nextY / window.innerHeight);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      setIsDragging(false);

      if (!hasMoved) {
        handleTogglePickup();
        return;
      }
      const nextSide = upEvent.clientX < window.innerWidth / 2 ? 'left' : 'right';
      setDockSide(nextSide);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleHandleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTogglePickup();
    }
  };

  return (
    <div
      className={`group fixed z-[2147483647] ${sidePosition}`}
      style={{ top: `${currentPosition * 100}vh` }}
    >
      <div className={`flex flex-col ${alignItems} gap-2 pr-0 pl-0`}>
        <button
          type="button"
          aria-label={`切换模式（当前：${modeLabel}）`}
          title={`点击切换模式（当前：${modeLabel}）`}
          onClick={handleToggleMode}
          className={`relative ${edgeMargin} flex h-10 w-10 items-center justify-center rounded-full border border-border-primary bg-background-quaternary text-text-secondary transition-transform duration-300 hover:bg-background-secondary group-hover:translate-x-0 group-focus-within:translate-x-0 ${hiddenTranslate}`}
        >
          {isVocabMode ? (
            <SquareCode className="h-5 w-5 text-foreground" />
          ) : (
            <Languages className="h-5 w-5 text-foreground" />
          )}
        </button>

        <button
          type="button"
          aria-label="设置"
          title="设置"
          className={`${edgeMargin} flex h-10 w-10 items-center justify-center rounded-full border border-border-primary bg-background-quaternary text-text-secondary transition-transform duration-300 hover:bg-background-secondary group-hover:translate-x-0 group-focus-within:translate-x-0 ${hiddenTranslate}`}
        >
          <Settings className="h-5 w-5 text-icon-primary" />
        </button>

        <button
          type="button"
          aria-label={pickupActive ? '还原原文' : '开始处理'}
          title={pickupActive ? '点击还原原文' : '点击开始处理'}
          onMouseDown={handleDragStart}
          onKeyDown={handleHandleKeyDown}
          className={`relative flex h-10 w-[60px] items-center ${handlePadding} ${handleRounded} border border-border-primary bg-background-quaternary opacity-70 shadow-lg transition-all duration-300 hover:opacity-100 group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:translate-x-0 ${handleTranslate} ${isDragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
        >
          <div
            className={`relative flex h-7 w-7 items-center justify-center rounded-full ${pickupActive ? 'bg-action-primary' : 'bg-gray-400'}`}
          >
            <span className="text-[10px] font-semibold text-white">A</span>
            {pickupActive && (
              <span
                aria-hidden
                className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-action-link text-white"
              >
                <Check className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
