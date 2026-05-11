import { Component, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Z } from '../hud/zLayers';

// Diagnostic overlay for the deployed build. Catches:
//   1. React render errors via componentDidCatch (would otherwise unmount the
//      whole tree because App has no error boundary).
//   2. Uncaught window errors via window.onerror.
//   3. Unhandled promise rejections via window.onunhandledrejection.
// Renders the captured info as a fixed-position overlay PORTALED to
// document.body so it escapes the CSS scale on `#stage-root` and stays
// readable on a phone. Tap "copy" to put the text on the clipboard.

type Capture = { kind: 'render' | 'error' | 'rejection'; message: string; stack: string };

type State = { captures: Capture[]; hasRenderError: boolean };

export class DiagnosticOverlay extends Component<{ children?: ReactNode }, State> {
  override state: State = { captures: [], hasRenderError: false };

  private onError = (ev: ErrorEvent) => {
    const message = ev.message || String(ev.error?.message ?? ev.error ?? 'unknown error');
    const stack = String(ev.error?.stack ?? `${ev.filename ?? ''}:${ev.lineno ?? ''}:${ev.colno ?? ''}`);
    this.push({ kind: 'error', message, stack });
  };

  private onRejection = (ev: PromiseRejectionEvent) => {
    const reason = ev.reason as unknown;
    const r = reason as { message?: unknown; stack?: unknown } | null;
    const message = String((r && r.message) ?? reason ?? 'unhandled rejection');
    const stack = String((r && r.stack) ?? '');
    this.push({ kind: 'rejection', message, stack });
  };

  override componentDidMount() {
    window.addEventListener('error', this.onError);
    window.addEventListener('unhandledrejection', this.onRejection);
  }

  override componentWillUnmount() {
    window.removeEventListener('error', this.onError);
    window.removeEventListener('unhandledrejection', this.onRejection);
  }

  override componentDidCatch(error: Error, info: { componentStack?: string }) {
    this.push({
      kind: 'render',
      message: error.message || String(error),
      stack: `${error.stack ?? ''}\n--- component stack ---${info.componentStack ?? ''}`,
    });
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasRenderError: true };
  }

  private push(c: Capture) {
    this.setState((s) => ({ captures: [...s.captures, c].slice(-5) }));
    try { console.error(`[diagnostic-overlay] ${c.kind}:`, c.message, c.stack); } catch { /* noop */ }
  }

  private clear = () => this.setState({ captures: [], hasRenderError: false });

  private copy = async () => {
    const text = this.state.captures
      .map((c) => `[${c.kind}] ${c.message}\n${c.stack}`)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers without clipboard API.
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
  };

  override render() {
    const { captures, hasRenderError } = this.state;
    return (
      <>
        {!hasRenderError && this.props.children}
        {captures.length > 0 && createPortal(
          <div
            style={{
              position: 'fixed',
              left: 0, right: 0, bottom: 0,
              zIndex: Z.overlay,
              maxHeight: '50vh',
              background: 'rgba(20,0,0,0.95)',
              color: '#ffd6d6',
              border: '2px solid #ff4d4d',
              padding: '10px 12px 14px',
              font: '12px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace',
              overflowY: 'auto',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ color: '#ff8888' }}>
                Diagnostic overlay — {captures.length} event{captures.length === 1 ? '' : 's'}
              </strong>
              <span style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={this.copy}
                  style={{
                    background: '#ff4d4d', color: '#1a0000', border: 'none',
                    padding: '4px 10px', fontSize: 12, fontWeight: 700, borderRadius: 4,
                  }}
                >
                  copy
                </button>
                <button
                  onClick={this.clear}
                  style={{
                    background: 'transparent', color: '#ffd6d6', border: '1px solid #ff8888',
                    padding: '4px 10px', fontSize: 12, borderRadius: 4,
                  }}
                >
                  clear
                </button>
              </span>
            </div>
            {captures.map((c, i) => (
              <div key={i} style={{ marginBottom: 8, paddingBottom: 6, borderBottom: '1px dashed #803030' }}>
                <div style={{ color: '#ffeeee' }}>
                  [{c.kind}] {c.message}
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '4px 0 0', color: '#ffaaaa' }}>
                  {c.stack}
                </pre>
              </div>
            ))}
          </div>,
          document.body,
        )}
      </>
    );
  }
}
