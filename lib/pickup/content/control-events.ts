import type { PickupRenderMode } from './render-mode';

export const PICKUP_CONTROL_EVENT = 'xen:pickup-control';
export const PICKUP_STATE_EVENT = 'xen:pickup-state';

export const PICKUP_CONTROL_ACTION_TOGGLE = 'toggle';
export const PICKUP_CONTROL_ACTION_START = 'start';
export const PICKUP_CONTROL_ACTION_STOP = 'stop';
export const PICKUP_CONTROL_ACTION_QUERY = 'query';
export const PICKUP_CONTROL_ACTION_TOGGLE_MODE = 'toggle_mode';
export const PICKUP_CONTROL_ACTION_SET_MODE = 'set_mode';

export type PickupControlAction =
  | typeof PICKUP_CONTROL_ACTION_TOGGLE
  | typeof PICKUP_CONTROL_ACTION_START
  | typeof PICKUP_CONTROL_ACTION_STOP
  | typeof PICKUP_CONTROL_ACTION_QUERY
  | typeof PICKUP_CONTROL_ACTION_TOGGLE_MODE
  | typeof PICKUP_CONTROL_ACTION_SET_MODE;

export type PickupControlDetail = {
  action: PickupControlAction;
  mode?: PickupRenderMode;
};

export type PickupStateDetail = {
  active: boolean;
  mode: PickupRenderMode;
};
