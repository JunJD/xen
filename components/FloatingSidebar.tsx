import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import {
  PICKUP_CONTROL_ACTION_QUERY,
  PICKUP_CONTROL_ACTION_TOGGLE,
  PICKUP_CONTROL_EVENT,
  PICKUP_STATE_EVENT,
  type PickupControlDetail,
  type PickupStateDetail,
} from '@/lib/pickup/content/control-events';

export function FloatingSidebar() {
  const [pickupActive, setPickupActive] = useState(true);

  useEffect(() => {
    const handleState = (event: Event) => {
      const customEvent = event as CustomEvent<PickupStateDetail>;
      if (typeof customEvent.detail?.active === 'boolean') {
        setPickupActive(customEvent.detail.active);
      }
    };

    window.addEventListener(PICKUP_STATE_EVENT, handleState as EventListener);
    const queryDetail: PickupControlDetail = { action: PICKUP_CONTROL_ACTION_QUERY };
    window.dispatchEvent(new CustomEvent(PICKUP_CONTROL_EVENT, { detail: queryDetail }));

    return () => {
      window.removeEventListener(PICKUP_STATE_EVENT, handleState as EventListener);
    };
  }, []);

  const handleTogglePickup = () => {
    const detail: PickupControlDetail = { action: PICKUP_CONTROL_ACTION_TOGGLE };
    window.dispatchEvent(new CustomEvent(PICKUP_CONTROL_EVENT, { detail }));
  };

  return (
    <div className="fixed right-6 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 font-mono text-black">
      <button
        type="button"
        aria-label={pickupActive ? '还原原文' : '开始处理'}
        title={pickupActive ? '点击还原原文' : '点击开始处理'}
        onClick={handleTogglePickup}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border-primary bg-background-quaternary shadow-sm transition-colors hover:bg-background-secondary"
      >
        {pickupActive && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-background-quaternary bg-[#415ccc]"
          />
        )}
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-full ${pickupActive ? 'bg-action-primary' : 'bg-gray-400'}`}
        >
          <span className="text-[10px] text-white">A</span>
        </div>
      </button>

      <button className="flex h-12 w-12 items-center justify-center rounded-xl border border-border-primary bg-background-quaternary shadow-md transition-colors hover:bg-background-secondary">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-black"
        >
          <path d="M12 2L2 7L12 12L22 7L12 2Z" />
          <path d="M2 17L12 22L22 17" />
          <path d="M2 12L12 17L22 12" />
        </svg>
      </button>

      <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border-primary bg-background-quaternary shadow-sm transition-colors hover:bg-background-secondary">
        <Settings className="h-4 w-4 text-icon-primary" />
      </button>
    </div>
  );
}
