import { useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore } from '../../state/store';
import { selectPlayerName } from '../../state/selectors';

const MAX_LEN = 16;

export function NameEntry() {
  const stored = useStore(selectPlayerName);
  const [name, setName] = useState(stored);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim().slice(0, MAX_LEN);
    const finalName = trimmed.length > 0 ? trimmed : 'Wanderer';
    dispatch({ type: 'SET_PLAYER_NAME', name: finalName });
    dispatch({ type: 'SET_SCREEN', screen: 'constellation_select' });
  };

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto px-6"
      style={{ minHeight: '100dvh' }}
    >
      <div className="w-full max-w-sm flex flex-col items-stretch gap-5">
        <div className="text-center">
          <div
            className="f-mono uc"
            style={{ fontSize: 11, color: '#7be3ff', letterSpacing: '0.6em', marginBottom: 12 }}
          >
            ◇ name yourself ◇
          </div>
          <div
            className="f-display"
            style={{
              fontSize: 56,
              lineHeight: 1,
              color: '#f3f0ff',
              textShadow: '0 0 32px rgba(123,227,255,0.45)',
            }}
          >
            Who Ascends?
          </div>
          <p
            className="f-mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.18em',
              color: '#bba8ff',
              marginTop: 14,
            }}
          >
            your name appears on the global codex.
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            autoCapitalize="words"
            enterKeyHint="go"
            maxLength={MAX_LEN}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Wanderer"
            aria-label="Player name"
            className="f-mono"
            style={{
              fontSize: 16,
              minHeight: 48,
              padding: '0 14px',
              color: '#f3f0ff',
              background: 'rgba(8, 4, 28, 0.7)',
              border: '1px solid rgba(149,119,255,0.45)',
              borderRadius: 10,
              outline: 'none',
              letterSpacing: '0.12em',
              textAlign: 'center',
            }}
          />
          <button
            type="submit"
            className="btn btn-primary mat-interactive"
            style={{ width: '100%', minHeight: 48 }}
          >
            Begin
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}
            className="btn btn-ghost"
            style={{ width: '100%', minHeight: 44 }}
          >
            back
          </button>
        </form>
      </div>
    </div>
  );
}
