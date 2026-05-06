import { useEffect, type RefObject } from 'react';

// Focus the first interactive element inside `container` when `active`
// goes true, then trap Tab within it. On unmount or when `active` flips
// false, restore focus to whatever element was focused before activation.
//
// Usage: a `<div ref={ref} role="dialog" aria-modal="true">` calls this
// hook in its render so screen readers and keyboard users stay inside.
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);

    // Initial focus: prefer [data-autofocus], otherwise first focusable.
    const initial = root.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0];
    initial?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const cur = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (cur === first || !root.contains(cur)) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else {
        if (cur === last) {
          e.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    };

    root.addEventListener('keydown', onKeyDown);
    return () => {
      root.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [ref, active]);
}
