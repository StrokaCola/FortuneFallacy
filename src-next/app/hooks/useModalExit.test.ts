import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalExit } from './useModalExit';

describe('useModalExit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.classList.remove('reduce-motion');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders + non-exiting when open is true', () => {
    const { result } = renderHook(() => useModalExit(true, 100));
    expect(result.current.rendered).toBe(true);
    expect(result.current.exiting).toBe(false);
  });

  it('does not render when open starts false', () => {
    const { result } = renderHook(() => useModalExit(false, 100));
    expect(result.current.rendered).toBe(false);
    expect(result.current.exiting).toBe(false);
  });

  it('keeps rendering during the exit fade then unmounts', () => {
    const { result, rerender } = renderHook(({ open }) => useModalExit(open, 100), {
      initialProps: { open: true },
    });
    expect(result.current.rendered).toBe(true);

    rerender({ open: false });
    expect(result.current.rendered).toBe(true);
    expect(result.current.exiting).toBe(true);

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.rendered).toBe(false);
    expect(result.current.exiting).toBe(false);
  });

  it('cancels the exit timer when reopened mid-fade', () => {
    const { result, rerender } = renderHook(({ open }) => useModalExit(open, 100), {
      initialProps: { open: true },
    });
    rerender({ open: false });
    expect(result.current.exiting).toBe(true);

    act(() => { vi.advanceTimersByTime(50); });
    rerender({ open: true });
    expect(result.current.rendered).toBe(true);
    expect(result.current.exiting).toBe(false);

    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.rendered).toBe(true);
  });

  it('unmounts immediately under reduce-motion', () => {
    document.documentElement.classList.add('reduce-motion');
    const { result, rerender } = renderHook(({ open }) => useModalExit(open, 100), {
      initialProps: { open: true },
    });
    rerender({ open: false });
    expect(result.current.rendered).toBe(false);
  });
});
