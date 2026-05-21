import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { VoidOnboarding } from './VoidOnboarding';
import { resetStore, store, type GameState } from '../../state/store';

// Force run.mode + meta.onboarding into the shape we need for each
// assertion. We mutate via store.setState directly instead of going
// through actions because the action types under test
// (DISMISS_VOID_ONBOARDING) are exactly what we want to OBSERVE
// firing, not pre-seed.
const seed = (over: (s: GameState) => GameState): void => {
  store.setState((s) => over(s as GameState), true);
};

afterEach(() => {
  cleanup();
  resetStore();
});

beforeEach(() => {
  resetStore();
});

describe('<VoidOnboarding />', () => {
  it('renders nothing when run.mode is not void', () => {
    seed((s) => ({ ...s, run: { ...s.run, mode: 'normal' } }));
    render(<VoidOnboarding />);
    expect(document.querySelector('[data-testid="void-onboarding"]')).toBeFalsy();
  });

  it('renders nothing when seenVoidEasterEgg is already true', () => {
    seed((s) => ({
      ...s,
      run: { ...s.run, mode: 'void' },
      meta: {
        ...s.meta,
        onboarding: { ...s.meta.onboarding, seenVoidEasterEgg: true },
      },
    }));
    render(<VoidOnboarding />);
    expect(document.querySelector('[data-testid="void-onboarding"]')).toBeFalsy();
  });

  it('renders when in void mode and not yet seen', () => {
    seed((s) => ({
      ...s,
      run: { ...s.run, mode: 'void', voidSeed: 0x1a2b3c4d, runAlias: 'Echo 17' },
      meta: {
        ...s.meta,
        onboarding: { ...s.meta.onboarding, seenVoidEasterEgg: false },
      },
    }));
    render(<VoidOnboarding />);
    const modal = document.querySelector('[data-testid="void-onboarding"]');
    expect(modal).toBeTruthy();
    expect(modal?.textContent).toMatch(/you found the void/i);
    expect(modal?.textContent).toMatch(/Echo 17/i);
  });

  it('dispatches DISMISS_VOID_ONBOARDING when "Step Through" is clicked', () => {
    seed((s) => ({
      ...s,
      run: { ...s.run, mode: 'void' },
      meta: {
        ...s.meta,
        onboarding: { ...s.meta.onboarding, seenVoidEasterEgg: false },
      },
    }));
    render(<VoidOnboarding />);
    const modal = document.querySelector('[data-testid="void-onboarding"]')!;
    const btn = Array.from(modal.querySelectorAll('button')).find((b) =>
      /step through/i.test(b.textContent ?? ''),
    )!;
    act(() => {
      fireEvent.click(btn);
    });
    expect(store.getState().meta.onboarding.seenVoidEasterEgg).toBe(true);
  });

  it('dispatches DISMISS_VOID_ONBOARDING when Escape is pressed', () => {
    seed((s) => ({
      ...s,
      run: { ...s.run, mode: 'void' },
      meta: {
        ...s.meta,
        onboarding: { ...s.meta.onboarding, seenVoidEasterEgg: false },
      },
    }));
    render(<VoidOnboarding />);
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(store.getState().meta.onboarding.seenVoidEasterEgg).toBe(true);
  });

  it('dispatches DISMISS_VOID_ONBOARDING when the backdrop is clicked', () => {
    seed((s) => ({
      ...s,
      run: { ...s.run, mode: 'void' },
      meta: {
        ...s.meta,
        onboarding: { ...s.meta.onboarding, seenVoidEasterEgg: false },
      },
    }));
    render(<VoidOnboarding />);
    const backdrop = document.querySelector('[data-testid="void-onboarding"]') as HTMLElement;
    expect(backdrop).toBeTruthy();
    act(() => {
      fireEvent.click(backdrop);
    });
    expect(store.getState().meta.onboarding.seenVoidEasterEgg).toBe(true);
  });
});
