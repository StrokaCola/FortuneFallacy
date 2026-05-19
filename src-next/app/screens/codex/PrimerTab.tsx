// Plain-language reference for new players, rendered as the first tab
// inside Codex. Search filters across term + definition (~40 entries —
// substring is enough, no fuzzy matching). seeAlso chips scroll the
// linked entry into view inside the same panel.

import { useMemo, useRef, useState } from 'react';
import { PRIMER_CATEGORIES, PRIMER_ENTRIES, type PrimerCategory, type PrimerEntry, lookupPrimerEntry } from '../../../data/primer';

type GroupedEntries = readonly { category: PrimerCategory; label: string; entries: PrimerEntry[] }[];

function group(entries: readonly PrimerEntry[]): GroupedEntries {
  return PRIMER_CATEGORIES.map((c) => ({
    category: c.id,
    label: c.label,
    entries: entries.filter((e) => e.category === c.id),
  })).filter((g) => g.entries.length > 0);
}

export function PrimerTab() {
  const [query, setQuery] = useState('');
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PRIMER_ENTRIES;
    return PRIMER_ENTRIES.filter(
      (e) => e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q),
    );
  }, [query]);

  const grouped = useMemo(() => group(filtered), [filtered]);

  const scrollTo = (id: string) => {
    const node = itemRefs.current[id];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.style.transition = 'background 600ms ease-out';
    node.style.background = 'rgba(245,196,81,0.18)';
    window.setTimeout(() => { node.style.background = 'transparent'; }, 900);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      flex: 1, minHeight: 0,
    }}>
      <div style={{ marginBottom: 10, flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search the primer…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="f-mono ff-input"
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 13,
            letterSpacing: '0.04em',
          }}
        />
      </div>

      <div style={{
        flex: 1, minHeight: 0,
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 14,
        paddingRight: 6,
      }}>
        {grouped.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            color: '#9577ff', fontSize: 12, fontStyle: 'italic',
          }}>
            No primer entries match "{query}".
          </div>
        )}
        {grouped.map((g) => (
          <section key={g.category}>
            <h3 className="f-mono uc" style={{
              fontSize: 10, letterSpacing: '0.36em', color: '#7be3ff',
              margin: '0 0 8px', borderBottom: '1px solid rgba(123,227,255,0.22)',
              paddingBottom: 4,
            }}>
              {g.label}
            </h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {g.entries.map((entry) => (
                <div
                  key={entry.id}
                  ref={(el) => { itemRefs.current[entry.id] = el; }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(149,119,255,0.22)',
                    background: 'rgba(15,9,37,0.6)',
                  }}
                >
                  <div className="f-head" style={{
                    fontSize: 14, color: '#f5c451', marginBottom: 4,
                  }}>
                    {entry.term}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#dcd4ff', lineHeight: 1.55 }}>
                    {entry.definition}
                  </div>
                  {entry.seeAlso && entry.seeAlso.length > 0 && (
                    <div style={{
                      display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8,
                    }}>
                      {entry.seeAlso.map((relId) => {
                        const rel = lookupPrimerEntry(relId);
                        if (!rel) return null;
                        return (
                          <button
                            key={relId}
                            onClick={() => scrollTo(relId)}
                            className="f-mono uc"
                            style={{
                              fontSize: 9, letterSpacing: '0.18em',
                              padding: '3px 8px', borderRadius: 999,
                              background: 'rgba(123,227,255,0.12)',
                              border: '1px solid rgba(123,227,255,0.3)',
                              color: '#7be3ff', cursor: 'pointer',
                            }}
                          >
                            → {rel.term}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
