import { createToaster } from '@/components/panelui/toast';

/**
 * The app's one toast manager, handed to PanelUI's `Toast.Provider` in
 * components/providers.tsx, so a toast can be raised from anywhere: event
 * handlers, contexts, data helpers.
 */
export const toaster = createToaster();

const show = (type: 'success' | 'info' | 'warning' | 'destructive') => (title: string) =>
  toaster.add({ title, type });

/** `toast.success('Gespeichert.')` and the like: a short message that leaves on its own. */
export const toast = {
  success: show('success'),
  info: show('info'),
  warning: show('warning'),
  danger: show('destructive'),
};
