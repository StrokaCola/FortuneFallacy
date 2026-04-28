import { Component, useEffect, useState, type ReactNode } from 'react';
import { getFlags, setFlag } from './flags';
import { tabs } from './tabs';

class TabErrorBoundary extends Component<
  { children: ReactNode; tabId: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { tabId: string }) {
    if (prev.tabId !== this.props.tabId && this.state.error) {
      this.setState({ error: null });
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="text-red-300 text-[11px]">
          tab "{this.props.tabId}" threw: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function DevConsole() {
  const [open, setOpen] = useState(false);
  const initialTab = getFlags().devConsoleTab;
  const initial = tabs.find((t) => t.id === initialTab)?.id ?? tabs[0].id;
  const [activeId, setActiveId] = useState<string>(initial);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '`') return;
      if (isTypingTarget(document.activeElement)) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setActive = (id: string) => {
    setActiveId(id);
    setFlag('devConsoleTab', id);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute top-2 right-2 px-3 py-1 bg-cosmos-800/80 ring-1 ring-cosmos-300/30
                   rounded text-xs font-mono text-cosmos-50 hover:bg-cosmos-700/80 pointer-events-auto">
        debug
      </button>
    );
  }

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div className="absolute top-2 right-2 w-[420px] max-h-[80vh] flex flex-col
                    bg-cosmos-900/95 ring-1 ring-cosmos-300/30 rounded-lg
                    text-xs font-mono text-cosmos-50 backdrop-blur pointer-events-auto">
      <div className="flex gap-2 p-2 border-b border-cosmos-300/20 items-center">
        <span className="font-bold flex-1">dev console</span>
        <span className="text-cosmos-300 text-[10px]">` to toggle</span>
        <button
          onClick={() => setOpen(false)}
          className="px-2 py-1 bg-cosmos-700 rounded"
        >
          ×
        </button>
      </div>
      <div className="flex border-b border-cosmos-300/20">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`flex-1 py-1 ${activeId === t.id ? 'bg-cosmos-700' : 'hover:bg-cosmos-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="overflow-auto p-2 flex-1">
        <TabErrorBoundary tabId={active.id}>
          {active.render()}
        </TabErrorBoundary>
      </div>
    </div>
  );
}
