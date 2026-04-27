import { dispatch } from '../../actions/dispatch';
import { useStore } from '../../state/store';
import { selectScore, selectShards } from '../../state/selectors';
import { PortalButton } from '../portal/PortalButton';

export function Win() {
  const score  = useStore(selectScore);
  const shards = useStore(selectShards);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto bg-cosmos-900/85">
      <div className="font-display text-6xl text-gold mb-2 tracking-widest">VICTORY</div>
      <div className="font-head text-cosmos-200 text-lg mb-8">all four antes cleared</div>
      <div className="flex gap-8 mb-10 font-mono text-cosmos-100">
        <div className="text-center">
          <div className="text-3xl text-astral">{score.toLocaleString()}</div>
          <div className="text-xs uppercase opacity-70">final score</div>
        </div>
        <div className="text-center">
          <div className="text-3xl text-gold">◇ {shards}</div>
          <div className="text-xs uppercase opacity-70">shards</div>
        </div>
      </div>
      <div className="flex flex-col gap-3 items-center">
        <button
          onClick={() => dispatch({ type: 'NEW_RUN' })}
          className="px-10 py-3 rounded-xl bg-ember/90 hover:bg-ember text-cosmos-900
                     font-display text-xl ring-2 ring-ember/60">
          new run
        </button>
        <PortalButton label="Travel onward →" />
      </div>
    </div>
  );
}
