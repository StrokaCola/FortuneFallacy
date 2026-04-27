import * as Tone from 'tone';

export type Bus = {
  input: Tone.Gain;
  eq: Tone.EQ3;
  comp: Tone.Compressor;
  plateSend: Tone.Gain;
  hallSend: Tone.Gain;
  delaySend: Tone.Gain;
  output: Tone.Gain;
};

export type Buses = {
  perc: Bus;
  mag: Bus;
  impact: Bus;
  ui: Bus;
  plate: Tone.Reverb;
  hall: Tone.Reverb;
  delay: Tone.PingPongDelay;
  master: Tone.Gain;
  sidechainKey: Tone.Gain;
  postKey: Tone.Gain;
};

type BusSpec = {
  hp: number;
  midDb: number;
  midFreq: number;
  highDb: number;
  highFreq: number;
  compThreshDb: number;
  compRatio: number;
  plate: number;
  hall: number;
  delay: number;
};

const SPECS: Record<'perc' | 'mag' | 'impact' | 'ui', BusSpec> = {
  perc:   { hp: 80,  midDb: -2, midFreq: 350,  highDb: 3, highFreq: 5000, compThreshDb: -14, compRatio: 4, plate: 0.10, hall: 0.05, delay: 0.05 },
  mag:    { hp: 200, midDb:  0, midFreq: 700,  highDb: 3, highFreq: 3000, compThreshDb: -16, compRatio: 3, plate: 0.25, hall: 0.15, delay: 0.10 },
  impact: { hp: 0,   midDb:  0, midFreq: 600,  highDb: 0, highFreq: 5000, compThreshDb: -12, compRatio: 6, plate: 0.10, hall: 0.35, delay: 0.20 },
  ui:     { hp: 400, midDb:  0, midFreq: 1500, highDb: 0, highFreq: 6000, compThreshDb: -18, compRatio: 3, plate: 0.15, hall: 0.0,  delay: 0.05 },
};

function makeBus(spec: BusSpec, plate: Tone.Reverb, hall: Tone.Reverb, delay: Tone.PingPongDelay, postKey: Tone.Gain): Bus {
  const input = new Tone.Gain(1);
  const eq = new Tone.EQ3(0, spec.midDb, spec.highDb);
  eq.lowFrequency.value = spec.hp;
  eq.highFrequency.value = spec.highFreq;
  const comp = new Tone.Compressor(spec.compThreshDb, spec.compRatio);

  const plateSend = new Tone.Gain(spec.plate);
  const hallSend = new Tone.Gain(spec.hall);
  const delaySend = new Tone.Gain(spec.delay);
  const output = new Tone.Gain(1);

  input.connect(eq);
  eq.connect(comp);
  comp.connect(output);
  comp.connect(plateSend);
  comp.connect(hallSend);
  comp.connect(delaySend);
  plateSend.connect(plate);
  hallSend.connect(hall);
  delaySend.connect(delay);
  output.connect(postKey);

  return { input, eq, comp, plateSend, hallSend, delaySend, output };
}

export async function buildBuses(): Promise<Buses> {
  const master = new Tone.Gain(0.7);

  const sidechainKey = new Tone.Gain(1);
  const postKey = new Tone.Gain(1);
  postKey.connect(sidechainKey);
  sidechainKey.connect(master);

  const limiter = new Tone.Limiter(-1);
  master.connect(limiter);
  limiter.toDestination();

  const plate = new Tone.Reverb({ decay: 0.8, wet: 1.0 });
  const hall = new Tone.Reverb({ decay: 2.4, wet: 1.0 });
  // generate() can fail in jsdom (no real OfflineAudioContext); swallow there.
  // In a real browser, the impulse response is rendered before audio plays.
  try { await plate.generate(); } catch { /* jsdom fallback */ }
  try { await hall.generate(); } catch { /* jsdom fallback */ }
  const delay = new Tone.PingPongDelay({ delayTime: '8n', feedback: 0.3, wet: 1.0 });

  plate.connect(postKey);
  hall.connect(postKey);
  delay.connect(postKey);

  const perc   = makeBus(SPECS.perc,   plate, hall, delay, postKey);
  const mag    = makeBus(SPECS.mag,    plate, hall, delay, postKey);
  const impact = makeBus(SPECS.impact, plate, hall, delay, postKey);
  const ui     = makeBus(SPECS.ui,     plate, hall, delay, postKey);

  return { perc, mag, impact, ui, plate, hall, delay, master, sidechainKey, postKey };
}

export function triggerDuck(buses: Buses, dB: number, attackMs: number, releaseMs: number): void {
  const ctx = Tone.getContext().rawContext as unknown as AudioContext;
  const now = ctx.currentTime;
  const attackS = attackMs / 1000;
  const releaseS = releaseMs / 1000;
  const target = Math.pow(10, -Math.abs(dB) / 20);
  const param = buses.sidechainKey.gain;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(target, now + attackS);
  param.linearRampToValueAtTime(1, now + attackS + releaseS);
}
