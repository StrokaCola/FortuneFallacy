import { Component, type ReactNode } from 'react';

// Localised error boundary around the lazy <Forge /> Suspense. Catches
// chunk-load failures before they reach the root DiagnosticOverlay
// (which would unmount the whole app). lazyWithRetry handles the
// transient blip + first-time stale-deploy auto-reload; this boundary
// is what the user actually sees when the loop guard blocks a second
// reload — i.e. the chunk is genuinely unreachable.

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ForgeChunkBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State { return { failed: true }; }

  override componentDidCatch(error: Error) {
    try { console.error('[ForgeChunkBoundary]', error.message); } catch { /* noop */ }
  }

  private reload = () => { window.location.reload(); };

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{
        position: 'absolute', inset: 0,
        display: 'grid', placeItems: 'center', gap: 14,
        pointerEvents: 'auto',
      }}>
        <div className="f-mono uc" style={{
          color: '#7be3ff', letterSpacing: '0.3em', fontSize: 12,
          textShadow: '0 0 12px #7be3ff55',
        }}>
          the forge couldn’t load
        </div>
        <button
          onClick={this.reload}
          style={{
            background: 'radial-gradient(circle, #f5c45122, #ff784733)',
            color: '#ffd9a8', border: '1px solid #ff7847',
            padding: '8px 18px', borderRadius: 4,
            font: '700 12px/1.2 ui-monospace, Menlo, monospace',
            letterSpacing: '0.25em', textTransform: 'uppercase',
            boxShadow: '0 0 18px #ff784744',
            cursor: 'pointer',
          }}
        >
          reload
        </button>
      </div>
    );
  }
}
