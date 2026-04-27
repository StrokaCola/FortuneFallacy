import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { store } from '../../state/store';
import { bus } from '../../events/bus';
import { createCosmicEnv } from './MaterialEnv';

const DIE_SIZE = 0.85;
const DICE_GAP = 1.3;
const ACTIVE_Y = 0;
const HOLD_Y = 2.6;
const HOLD_SCALE = 0.78;

const FACE_ROT: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [0, 0, -Math.PI / 2],
  3: [-Math.PI / 2, 0, 0],
  4: [Math.PI / 2, 0, 0],
  5: [0, 0, Math.PI / 2],
  6: [Math.PI, 0, 0],
};

type StyleKey = 'celestial' | 'obsidian' | 'ember' | 'ivory' | 'glass';

const STYLES: Record<StyleKey, {
  body: number; edge: number; pip: number; emissive: number;
  eIntensity: number; metal: number; rough: number;
}> = {
  celestial: { body: 0x1c1245, edge: 0x9577ff, pip: 0xdcd4ff, emissive: 0x7be3ff, eIntensity: 0.25, metal: 0.15, rough: 0.45 },
  obsidian:  { body: 0x0a0814, edge: 0xf5c451, pip: 0xf5c451, emissive: 0xf5c451, eIntensity: 0.18, metal: 0.55, rough: 0.30 },
  ember:     { body: 0xc93a18, edge: 0xff8a5e, pip: 0xfff7e8, emissive: 0xff7847, eIntensity: 0.35, metal: 0.20, rough: 0.45 },
  ivory:     { body: 0xeadcb6, edge: 0xffffff, pip: 0x1c1245, emissive: 0x000000, eIntensity: 0.0,  metal: 0.0,  rough: 0.55 },
  glass:     { body: 0x162844, edge: 0x7be3ff, pip: 0xf3f0ff, emissive: 0x7be3ff, eIntensity: 0.45, metal: 0.10, rough: 0.20 },
};

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-0.25, -0.25], [0.25, 0.25]],
  3: [[-0.25, -0.25], [0, 0], [0.25, 0.25]],
  4: [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]],
  5: [[-0.25, -0.25], [0.25, -0.25], [0, 0], [-0.25, 0.25], [0.25, 0.25]],
  6: [[-0.25, -0.30], [0.25, -0.30], [-0.25, 0], [0.25, 0], [-0.25, 0.30], [0.25, 0.30]],
};

const FACE_DEFS = [
  { val: 1, axis: 'z' as const, sign:  1 },
  { val: 6, axis: 'z' as const, sign: -1 },
  { val: 2, axis: 'x' as const, sign:  1 },
  { val: 5, axis: 'x' as const, sign: -1 },
  { val: 3, axis: 'y' as const, sign:  1 },
  { val: 4, axis: 'y' as const, sign: -1 },
];

function buildDie(size: number, styleKey: StyleKey): THREE.Group {
  const S = STYLES[styleKey];
  const group = new THREE.Group();
  group.name = `FortuneFallacyDie_${styleKey}`;

  const bodyGeo = new RoundedBoxGeometry(size, size, size, 4, size * 0.08);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: S.body,
    metalness: Math.max(0.4, S.metal),
    roughness: Math.max(0.18, Math.min(0.6, S.rough)),
    emissive: S.emissive,
    emissiveIntensity: S.eIntensity * 0.4,
    envMapIntensity: 0.85,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(size * 1.001, size * 1.001, size * 1.001));
  const edgeMat = new THREE.LineBasicMaterial({ color: S.edge, transparent: true, opacity: 0.35 });
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);
  group.add(edges);

  const pipMat = new THREE.MeshStandardMaterial({
    color: S.pip,
    metalness: 0.6,
    roughness: 0.2,
    emissive: S.emissive,
    emissiveIntensity: S.eIntensity,
    envMapIntensity: 1.1,
  });
  const wellMat = new THREE.MeshStandardMaterial({
    color: 0x000000, metalness: 0, roughness: 1, transparent: true, opacity: 0.55,
  });

  const half = size / 2;
  const pipR = size * 0.05;
  const indent = size * 0.025;

  FACE_DEFS.forEach(({ val, axis, sign }) => {
    const positions = PIPS[val]!;
    positions.forEach(([u, v]) => {
      const offset = -indent;
      const pos = new THREE.Vector3();
      if (axis === 'z') pos.set(u * size, v * size, sign * (half + offset));
      else if (axis === 'x') pos.set(sign * (half + offset), v * size, -u * size * sign);
      else pos.set(u * size, sign * (half + offset), -v * size * sign);

      const pip = new THREE.Mesh(new THREE.SphereGeometry(pipR, 16, 12), pipMat);
      pip.position.copy(pos);
      group.add(pip);

      const well = new THREE.Mesh(new THREE.SphereGeometry(pipR * 1.4, 12, 10), wellMat);
      const back = new THREE.Vector3(
        axis === 'x' ? sign : 0,
        axis === 'y' ? sign : 0,
        axis === 'z' ? sign : 0,
      );
      well.position.copy(pos).addScaledVector(back, -indent * 0.5);
      group.add(well);
    });
  });

  return group;
}

type DieAnim = {
  group: THREE.Group;
  homePos: THREE.Vector3;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  startScale: number;
  targetScale: number;
  startQuat: THREE.Quaternion;
  targetQuat: THREE.Quaternion;
  t0: number;
  duration: number;
  rolling: boolean;            // true while tumble in progress
  rollAxis: THREE.Vector3;
  rollSpeed: number;            // radians per second total
  bouncePeak: number;           // max y displacement during roll
  locked: boolean;
  playback: { frames: import('../../events/types').DieFrame[]; startedAt: number; stepMs: number } | null;
};

export class Dice3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private dice: DieAnim[] = [];
  private holdShelf: THREE.Mesh | null = null;
  private rafHandle: number | null = null;
  private unsubscribers: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setSize(960, 540, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene = new THREE.Scene();
    try {
      this.scene.environment = createCosmicEnv(this.renderer);
    } catch (e) {
      console.warn('[Dice3D] env map init failed:', e);
    }
    const ortho = 4;
    this.camera = new THREE.OrthographicCamera(-ortho * 1.78, ortho * 1.78, ortho, -ortho, 0.1, 100);
    this.camera.position.set(0, 6, 5);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0x9577ff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(4, 8, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x7be3ff, 1.4, 24);
    rim.position.set(-3, 2, -4);
    this.scene.add(rim);
    const fill = new THREE.PointLight(0xff7847, 0.6, 20);
    fill.position.set(3, -1, 4);
    this.scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.ShadowMaterial({ opacity: 0.4 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -DIE_SIZE / 2 - 0.01;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Hold shelf — visual indicator for held dice area
    const shelfGeo = new THREE.PlaneGeometry(7.5, 1.4);
    const shelfMat = new THREE.MeshBasicMaterial({
      color: 0x7be3ff, transparent: true, opacity: 0.06,
    });
    this.holdShelf = new THREE.Mesh(shelfGeo, shelfMat);
    this.holdShelf.rotation.x = -Math.PI / 2;
    this.holdShelf.position.set(0, HOLD_Y - DIE_SIZE / 2 - 0.05, 0);
    this.scene.add(this.holdShelf);

    this.buildDice();

    this.unsubscribers.push(
      store.subscribe((s, prev) => {
        if (s.round.dice !== prev.round.dice) this.syncDice(s.round.dice);
      }),
      bus.on('onSimulationEnd', ({ result }) => this.startPlayback(result.frames, result.finalFaces)),
    );
    this.syncDice(store.getState().round.dice);
    this.start();
  }

  destroy(): void {
    if (this.rafHandle != null) cancelAnimationFrame(this.rafHandle);
    this.unsubscribers.forEach((u) => u());
    this.renderer.dispose();
  }

  private buildDice() {
    const count = 5;
    const startX = -((count - 1) * DICE_GAP) / 2;
    for (let i = 0; i < count; i++) {
      const group = buildDie(DIE_SIZE, 'celestial');
      const home = new THREE.Vector3(startX + i * DICE_GAP, ACTIVE_Y, 0);
      group.position.copy(home);
      this.scene.add(group);
      this.dice.push({
        group,
        homePos: home,
        startPos: home.clone(),
        targetPos: home.clone(),
        startScale: 1,
        targetScale: 1,
        startQuat: new THREE.Quaternion(),
        targetQuat: new THREE.Quaternion(),
        t0: 0,
        duration: 350,
        rolling: false,
        rollAxis: new THREE.Vector3(1, 0, 0),
        rollSpeed: 0,
        bouncePeak: 0,
        locked: false,
        playback: null,
      });
    }
  }

  private holdSlotX(holdIdx: number, total: number): number {
    if (total <= 0) return 0;
    const gap = DICE_GAP * 0.85;
    const startX = -((total - 1) * gap) / 2;
    return startX + holdIdx * gap;
  }

  private syncDice(diceState: { face: number; locked?: boolean }[]) {
    // Compute hold-area indices (sequential among locked dice)
    const lockedIndices: number[] = [];
    diceState.forEach((d, i) => { if (d.locked) lockedIndices.push(i); });
    const holdCount = lockedIndices.length;

    diceState.forEach((d, i) => {
      const die = this.dice[i];
      if (!die) return;

      const wasLocked = die.locked;
      const isLocked = !!d.locked;
      die.locked = isLocked;

      // Position target
      let newTargetPos: THREE.Vector3;
      let newTargetScale: number;
      if (isLocked) {
        const holdIdx = lockedIndices.indexOf(i);
        newTargetPos = new THREE.Vector3(this.holdSlotX(holdIdx, holdCount), HOLD_Y, 0);
        newTargetScale = HOLD_SCALE;
      } else {
        newTargetPos = die.homePos.clone();
        newTargetScale = 1;
      }

      // Reposition all locked dice when count changes
      const positionChanged = !die.targetPos.equals(newTargetPos) || die.targetScale !== newTargetScale;
      const lockChanged = wasLocked !== isLocked;

      if (positionChanged) {
        die.startPos.copy(die.group.position);
        die.targetPos.copy(newTargetPos);
        die.startScale = die.group.scale.x;
        die.targetScale = newTargetScale;
      }

      // Face rotation target (only changes when not currently rolling and face changed)
      if (!die.rolling) {
        const newRot = new THREE.Quaternion();
        newRot.setFromEuler(new THREE.Euler(...FACE_ROT[d.face]!));
        if (!die.targetQuat.equals(newRot) || lockChanged) {
          die.startQuat.copy(die.group.quaternion);
          die.targetQuat.copy(newRot);
        }
      }

      if (positionChanged || lockChanged) {
        die.t0 = performance.now();
        die.duration = 380;
      }
    });
  }

  private kickAll() {
    const now = performance.now();
    this.dice.forEach((d, i) => {
      if (d.locked) return;
      // Random tumble axis + rotational speed
      const ax = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ).normalize();
      d.rollAxis = ax;
      d.rollSpeed = 8 + Math.random() * 6;     // ~8-14 rad/s
      d.bouncePeak = 1.6 + Math.random() * 0.8;
      d.startQuat.copy(d.group.quaternion);
      d.startPos.copy(d.group.position);
      // Stay roughly at home X but drift slightly during roll for liveliness
      d.targetPos.set(d.homePos.x + (Math.random() * 0.4 - 0.2), ACTIVE_Y, Math.random() * 0.4 - 0.2);
      d.targetScale = 1;
      d.startScale = d.group.scale.x;
      d.t0 = now + i * 30;                     // tiny stagger
      d.duration = 1100 + Math.random() * 250; // 1.1-1.35s tumble
      d.rolling = true;
    });
  }

  private startPlayback(frames: import('../../events/types').DieFrame[][] | undefined, finalFaces: number[]): void {
    if (!frames || frames.length === 0) {
      this.kickAll();
      return;
    }
    const now = performance.now();
    const STEP_MS = 1000 / 60;
    this.dice.forEach((d, i) => {
      if (d.locked) return;
      const f = frames[i];
      if (!f || f.length === 0) return;
      d.playback = { frames: f, startedAt: now, stepMs: STEP_MS };
      d.rolling = false;
      const face = finalFaces[i];
      if (face != null) {
        d.targetQuat.setFromEuler(new THREE.Euler(...FACE_ROT[face]!));
      }
    });
  }

  private start() {
    const loop = () => {
      this.rafHandle = requestAnimationFrame(loop);
      const now = performance.now();
      for (const d of this.dice) {
        const elapsed = now - d.t0;
        if (elapsed < 0) {
          // pre-stagger; stay at start
          d.group.position.copy(d.startPos);
          d.group.quaternion.copy(d.startQuat);
          continue;
        }
        const tRaw = Math.min(1, Math.max(0, elapsed / d.duration));

        if (d.playback) {
          const elapsed2 = now - d.playback.startedAt;
          const idx = Math.min(d.playback.frames.length - 1, Math.floor(elapsed2 / d.playback.stepMs));
          const fr = d.playback.frames[idx]!;
          d.group.position.set(fr.px, fr.py, fr.pz);
          d.group.quaternion.set(fr.qx, fr.qy, fr.qz, fr.qw);
          if (idx >= d.playback.frames.length - 1) {
            d.playback = null;
            d.startQuat.copy(d.group.quaternion);
            d.startPos.copy(d.group.position);
            d.targetPos.copy(d.homePos);
            d.targetScale = 1;
            d.startScale = d.group.scale.x;
            d.t0 = now;
            d.duration = 240;
          }
          continue;
        }

        if (d.rolling) {
          // Active tumble: spin around rollAxis at rollSpeed
          const angle = d.rollSpeed * (elapsed / 1000) * (1 - tRaw * 0.6); // slows over time
          const spin = new THREE.Quaternion().setFromAxisAngle(d.rollAxis, angle);
          d.group.quaternion.copy(d.startQuat).multiply(spin);

          // Position lerp + bounce stack (3 bounces decaying)
          const easeT = 1 - Math.pow(1 - tRaw, 2);
          d.group.position.lerpVectors(d.startPos, d.targetPos, easeT);
          const bounceY = d.bouncePeak * Math.abs(Math.sin(tRaw * Math.PI * 3)) * (1 - tRaw);
          d.group.position.y = ACTIVE_Y + bounceY;

          if (tRaw >= 1) {
            d.rolling = false;
            // After tumble, sync orientation to target face on next syncDice tick
            // (faces will be snapped via store update from ROLL_SETTLED)
            d.startQuat.copy(d.group.quaternion);
          }
        } else {
          // Position + scale + face-quat smooth lerp
          const t = 1 - Math.pow(1 - tRaw, 3);
          d.group.position.lerpVectors(d.startPos, d.targetPos, t);
          const sc = d.startScale + (d.targetScale - d.startScale) * t;
          d.group.scale.setScalar(sc);
          d.group.quaternion.slerpQuaternions(d.startQuat, d.targetQuat, t);
        }
      }
      this.renderer.render(this.scene, this.camera);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }
}
