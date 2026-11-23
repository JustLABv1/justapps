import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export const APP_LOGO_TRANSITION_NAME = "app-logo";
export const APP_CARD_TRANSITION_NAME = "app-card";

// Max time the old page stays frozen while the destination loads its data.
const MAX_WAIT_MS = 500;

let pendingResolve: (() => void) | null = null;

/** Called by the destination once the shared element is mounted. */
export function resolveViewTransition() {
  pendingResolve?.();
  pendingResolve = null;
}

/**
 * Navigates with a shared-element morph (card -> header, logo -> logo). Falls back to a plain push when the View Transitions API is
 * unavailable or the user prefers reduced motion.
 */
export function navigateWithTransition(
  router: AppRouterInstance,
  href: string,
  shared: { card?: HTMLElement | null; logo?: HTMLElement | null } = {},
) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void> };
  };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || reduced) {
    router.push(href);
    return;
  }

  const { card, logo } = shared;
  if (card) card.style.viewTransitionName = APP_CARD_TRANSITION_NAME;
  if (logo) logo.style.viewTransitionName = APP_LOGO_TRANSITION_NAME;
  const clear = () => {
    if (card) card.style.viewTransitionName = "";
    if (logo) logo.style.viewTransitionName = "";
  };

  try {
    doc
      .startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            const timer = window.setTimeout(resolveViewTransition, MAX_WAIT_MS);
            pendingResolve = () => {
              window.clearTimeout(timer);
              resolve();
            };
            router.push(href);
          }),
      )
      .finished.catch(() => {})
      .finally(clear);
  } catch {
    clear();
    router.push(href);
  }
}
