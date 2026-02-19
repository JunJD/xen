export const MESSAGE_TYPES = {
  modelWarmup: 'pickupModelWarmup',
  modelStatus: 'pickupModelStatus',
  annotate: 'pickupAnnotate',
  translatePreview: 'pickupTranslatePreview',
  translateProviderGet: 'pickupTranslateProviderGet',
  translateProviderSet: 'pickupTranslateProviderSet',
  openOptions: 'pickupOpenOptions',
} as const;

export const STATUS_ERROR_CODES = {
  offscreenUnavailable: 'offscreen_unavailable',
  warmupUnavailable: 'warmup_status_unavailable',
  modelUnavailable: 'model_status_unavailable',
} as const;

export const CACHE_PRUNE_REASONS = {
  startup: 'startup',
  annotate: 'annotate',
  translate: 'translate',
} as const;
