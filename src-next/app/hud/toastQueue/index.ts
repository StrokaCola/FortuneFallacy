// Public surface of the toast queue. Anywhere in the app that wants
// to fire a notification imports `pushToast` from here; the host is
// mounted once at the App root.

export { pushToast, toastQueue, createQueue, type QueueHandle } from './queue';
export { useToastQueue, useToastTicker } from './useToastQueue';
export { ToastHost } from './ToastHost';
export type {
  ToastDescriptor,
  ToastPriority,
  QueueState,
  VisibleToast,
} from './types';
export { QUEUE_LIMITS } from './types';
