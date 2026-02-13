import { defineContentScript } from '#imports';
import { createPickupRunner } from '@/lib/pickup/content/runner';

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_idle',
  main() {
    const runner = createPickupRunner();
    runner.start();
  },
});
