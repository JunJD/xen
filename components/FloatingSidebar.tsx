import { useEffect, useRef, useState } from 'react';
import { Check, Eye, EyeOff, Languages, Settings, SquareCode } from 'lucide-react';
import {
  PICKUP_CONTROL_ACTION_QUERY,
  PICKUP_CONTROL_ACTION_TOGGLE_MODE,
  PICKUP_CONTROL_ACTION_TOGGLE,
  PICKUP_CONTROL_EVENT,
  PICKUP_STATE_EVENT,
  type PickupControlDetail,
  type PickupStateDetail,
} from '@/lib/pickup/content/control-events';
import { applyPickupStyleSettings } from '@/lib/pickup/content/style-settings';
import {
  PICKUP_RENDER_MODE_SYNTAX_REBUILD,
  PICKUP_RENDER_MODE_VOCAB_INFUSION,
  type PickupRenderMode,
} from '@/lib/pickup/content/render-mode';
import { sendMessage, MESSAGE_TYPES } from '@/lib/pickup/messaging';
import { getPickupSettings, setPickupSettings } from '@/lib/pickup/settings';

export function FloatingSidebar() {
  const [pickupActive, setPickupActive] = useState(true);
  const [pickupMode, setPickupMode] = useState<PickupRenderMode>(PICKUP_RENDER_MODE_SYNTAX_REBUILD);
  const [translationBlurEnabled, setTranslationBlurEnabled] = useState(false);
  const [dockSide, setDockSide] = useState<'left' | 'right'>('right');
  const [dockPosition, setDockPosition] = useState(0.5);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const handleOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerHeightRef = useRef<number>(0);
  const dragSizeRef = useRef<number>(32);
  const initialClientXRef = useRef<number | null>(null);
  const initialClientYRef = useRef<number | null>(null);

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
    let active = true;
    const load = async () => {
      try {
        const settings = await getPickupSettings();
        if (active) {
          setTranslationBlurEnabled(settings.translationBlurEnabled);
        }
      } catch {
        // Ignore load failures.
      }
    };
    void load();
    return () => {
      active = false;
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

  const handleTogglePickup = () => {
    const detail: PickupControlDetail = { action: PICKUP_CONTROL_ACTION_TOGGLE };
    window.dispatchEvent(new CustomEvent(PICKUP_CONTROL_EVENT, { detail }));
  };

  const handleToggleMode = () => {
    const detail: PickupControlDetail = { action: PICKUP_CONTROL_ACTION_TOGGLE_MODE };
    window.dispatchEvent(new CustomEvent(PICKUP_CONTROL_EVENT, { detail }));
  };

  const handleToggleTranslationBlur = () => {
    const nextValue = !translationBlurEnabled;
    setTranslationBlurEnabled(nextValue);
    void setPickupSettings({ translationBlurEnabled: nextValue })
      .then((next) => {
        setTranslationBlurEnabled(next.translationBlurEnabled);
        applyPickupStyleSettings(next);
      })
      .catch(() => {
        setTranslationBlurEnabled(prev => !prev);
      });
  };

  const handleOpenOptions = () => {
    void sendMessage(MESSAGE_TYPES.openOptions)
      .catch(() => undefined);
  };

  const isVocabMode = pickupMode === PICKUP_RENDER_MODE_VOCAB_INFUSION;
  const modeLabel = isVocabMode ? '原生语法' : '翻译语法';
  const blurLabel = translationBlurEnabled ? '已开启' : '已关闭';
  const hiddenTranslate = dockSide === 'right' ? 'translate-x-12' : '-translate-x-12';
  const handleTranslate = dockSide === 'right' ? 'translate-x-5' : '-translate-x-5';
  const alignItems = dockSide === 'right' ? 'items-end' : 'items-start';
  const sidePosition = dockSide === 'right' ? 'right-0' : 'left-0';
  const handleRounded = dockSide === 'right' ? 'rounded-l-full border-r-0' : 'rounded-r-full border-l-0';
  const handlePadding = dockSide === 'right' ? 'pl-1' : 'pr-1';
  const handleJustify = dockSide === 'right' ? 'justify-start' : 'justify-end';
  const edgeMargin = dockSide === 'right' ? 'mr-6' : 'ml-6';
  const revealOnDrag = isDragging ? 'translate-x-0' : '';
  const dragTransition = isDragging ? 'transition-none' : '';
  const pickupIconSrc = (() => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL('wxt.svg');
    }
    return '/wxt.svg';
  })();
  const pickupIcon = (
    <img src={pickupIconSrc} alt="" aria-hidden="true" className="h-6 w-6" />
  );

  const handleDragStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    initialClientYRef.current = event.clientY;
    initialClientXRef.current = event.clientX;
    const containerRect = containerRef.current?.getBoundingClientRect();
    const handleRect = handleRef.current?.getBoundingClientRect();
    const dragSize = handleRect
      ? Math.max(handleRect.width, handleRect.height)
      : dragSizeRef.current;
    dragSizeRef.current = dragSize;
    const dragRadius = dragSize / 2;
    if (containerRect && handleRect) {
      handleOffsetRef.current = {
        x: handleRect.left + handleRect.width / 2 - containerRect.left,
        y: handleRect.top + handleRect.height / 2 - containerRect.top,
      };
      containerHeightRef.current = containerRect.height;
    } else {
      handleOffsetRef.current = { x: dragRadius, y: dragRadius };
      containerHeightRef.current = 120;
    }
    let hasMoved = false;
    let draggingActive = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - (initialClientYRef.current ?? moveEvent.clientY);
      const deltaX = moveEvent.clientX - (initialClientXRef.current ?? moveEvent.clientX);
      if (Math.abs(deltaY) > 5 || Math.abs(deltaX) > 5) {
        hasMoved = true;
      }
      if (!hasMoved) {
        return;
      }
      if (!draggingActive) {
        draggingActive = true;
        setIsDragging(true);
        document.body.style.userSelect = 'none';
      }
      const radius = dragSizeRef.current / 2;
      const nextX = Math.max(radius, Math.min(window.innerWidth - radius, moveEvent.clientX));
      const nextY = Math.max(radius, Math.min(window.innerHeight - radius, moveEvent.clientY));
      setDragPoint({ x: nextX, y: nextY });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (draggingActive) {
        document.body.style.userSelect = '';
      }
      setIsDragging(false);
      setDragPoint(null);

      if (!hasMoved) {
        handleTogglePickup();
        return;
      }
      const nextSide = upEvent.clientX < window.innerWidth / 2 ? 'left' : 'right';
      setDockSide(nextSide);

      const radius = dragSizeRef.current / 2;
      const offsetY = handleOffsetRef.current.y || radius;
      const containerHeight = containerHeightRef.current || 120;
      const maxTop = Math.max(0, window.innerHeight - containerHeight);
      const nextTop = Math.max(0, Math.min(maxTop, upEvent.clientY - offsetY));
      setDockPosition(nextTop / window.innerHeight);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleHandleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTogglePickup();
    }
  };

  if (isDragging && dragPoint) {
    return (
      <div
        className="fixed z-[2147483647] pointer-events-none"
        style={{
          left: `${dragPoint.x}px`,
          top: `${dragPoint.y}px`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div
          className={`relative flex h-8 w-8 items-center justify-center rounded-full ${pickupActive ? 'bg-action-primary' : 'bg-gray-400'}`}
        >
          {pickupIcon}
          {pickupActive && (
            <span
              aria-hidden
              className={`pointer-events-none absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-action-link text-white`}
            >
              <Check className="h-2.5 w-2.5" />
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`group fixed z-[2147483647] ${sidePosition}`}
      style={{ top: `${dockPosition * 100}vh` }}
    >
      <div className={`flex flex-col ${alignItems} gap-2 pr-0 pl-0`}>
        {!isDragging && (
          <button
            type="button"
            aria-label={`切换模式（当前：${modeLabel}）`}
            title={`点击切换模式（当前：${modeLabel}）`}
            onClick={handleToggleMode}
            className={`relative ${edgeMargin} flex h-8 w-8 items-center justify-center rounded-full border border-border-primary bg-background-quaternary text-text-secondary transition-transform duration-300 hover:bg-background-secondary group-hover:translate-x-0 group-focus-within:translate-x-0 ${hiddenTranslate} ${revealOnDrag} ${dragTransition}`}
          >
            {isVocabMode ? (
              <SquareCode className="h-4 w-4 text-foreground" />
            ) : (
              <Languages className="h-4 w-4 text-foreground" />
            )}
          </button>
        )}

        {!isDragging && (
          <button
            type="button"
            aria-label={`译文蒙层（${blurLabel}）`}
            title={`点击切换译文蒙层（${blurLabel}）`}
            onClick={handleToggleTranslationBlur}
            className={`relative ${edgeMargin} flex h-8 w-8 items-center justify-center rounded-full border border-border-primary bg-background-quaternary text-text-secondary transition-transform duration-300 hover:bg-background-secondary group-hover:translate-x-0 group-focus-within:translate-x-0 ${hiddenTranslate} ${revealOnDrag} ${dragTransition}`}
          >
            {translationBlurEnabled ? (
              <EyeOff className="h-4 w-4 text-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-foreground" />
            )}
          </button>
        )}

        {!isDragging && (
          <button
            type="button"
            aria-label="设置"
            title="设置"
            onClick={handleOpenOptions}
            className={`${edgeMargin} flex h-8 w-8 items-center justify-center rounded-full border border-border-primary bg-background-quaternary text-text-secondary transition-transform duration-300 hover:bg-background-secondary group-hover:translate-x-0 group-focus-within:translate-x-0 ${hiddenTranslate} ${revealOnDrag} ${dragTransition}`}
          >
            <Settings className="h-4 w-4 text-icon-primary" />
          </button>
        )}

        <div
          className={`relative flex h-10 w-[60px] items-center ${handleJustify} ${handlePadding} ${handleRounded} border border-border-primary bg-background-quaternary opacity-70 shadow-lg transition-all duration-300 hover:opacity-100 group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:translate-x-0 ${handleTranslate} ${dragTransition}`}
        >
          <div
            ref={handleRef}
            role="button"
            tabIndex={0}
            aria-label={pickupActive ? '还原原文' : '开始处理'}
            title={pickupActive ? '点击还原原文' : '点击开始处理'}
            onMouseDown={handleDragStart}
            onKeyDown={handleHandleKeyDown}
            className={`relative flex h-8 w-8 items-center justify-center rounded-full ${pickupActive ? 'bg-action-primary' : 'bg-gray-400'} ${isDragging ? 'cursor-grabbing' : 'cursor-pointer'} outline-none`}
          >
            {pickupIcon}
            {pickupActive && (
              <span
                aria-hidden
                className="pointer-events-none absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-action-link text-white"
              >
                <Check className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
