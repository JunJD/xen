import { defineContentScript } from '#imports';
import {
  PICKUP_CONTROL_ACTION_QUERY,
  PICKUP_CONTROL_ACTION_START,
  PICKUP_CONTROL_ACTION_STOP,
  PICKUP_CONTROL_ACTION_TOGGLE,
  PICKUP_CONTROL_EVENT,
  PICKUP_STATE_EVENT,
  type PickupControlDetail,
  type PickupStateDetail,
} from '@/lib/pickup/content/control-events';
import { createPickupRunner } from '@/lib/pickup/content/runner';

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_idle',
  main() {
    const runner = createPickupRunner();
    runner.start();

    const emitState = () => {
      const detail: PickupStateDetail = { active: runner.isStarted() };
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
      }
    };

    window.addEventListener(PICKUP_CONTROL_EVENT, handleControl as EventListener);
    emitState();
  },
});
