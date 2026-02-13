import { defineBackground } from '#imports';
import { setupPickupBackground } from '@/lib/pickup/background/pickup-background';

export default defineBackground(() => {
  setupPickupBackground();
});
