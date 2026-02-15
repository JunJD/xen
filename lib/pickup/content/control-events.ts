export const PICKUP_CONTROL_EVENT = 'xen:pickup-control';
export const PICKUP_STATE_EVENT = 'xen:pickup-state';

export const PICKUP_CONTROL_ACTION_TOGGLE = 'toggle';
export const PICKUP_CONTROL_ACTION_START = 'start';
export const PICKUP_CONTROL_ACTION_STOP = 'stop';
export const PICKUP_CONTROL_ACTION_QUERY = 'query';

export type PickupControlAction =
  | typeof PICKUP_CONTROL_ACTION_TOGGLE
  | typeof PICKUP_CONTROL_ACTION_START
  | typeof PICKUP_CONTROL_ACTION_STOP
  | typeof PICKUP_CONTROL_ACTION_QUERY;

export type PickupControlDetail = {
  action: PickupControlAction;
};

export type PickupStateDetail = {
  active: boolean;
};
