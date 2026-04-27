import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { store } from '../../state/store';
import { bus } from '../../events/bus';
import { dispatch } from '../../actions/dispatch';
import { createCosmicEnv } from './MaterialEnv';

const DIE_SIZE = 0.85;
const DICE_GAP = 1.7;
// Tray sits in lower portion of stage (design trayCenter y=600 / stage 800).
// World-y shift maps active play down so dice appear inside the curved tray base.
const ACTIVE_Y = -2.5;
// Locked dice lift in place (~12px on screen) — design has translateY(-12px), no scale or z shift.
const HOLD_Y = ACTIVE_Y + 0.4;
const HOLD_Z = 0;
const HOLD_SCALE = 1;

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

type BuiltDie = {
  group: THREE.Group;
  pipMat: THREE.MeshBasicMaterial;
  pipGroup: THREE.Group;
};

function buildDie(size: number, styleKey: StyleKey): BuiltDie {
  const S = STYLES[styleKey];
  const group = new THREE.Group();
  group.name = `FortuneFallacyDie_${styleKey}`;

  const bodyGeo = new RoundedBoxGeometry(size, size, size, 6, size * 0.20);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: S.body,
    metalness: 0.0,
    roughness: 0.22,
    transmission: 0.55,
    thickness: 0.9,
    ior: 1.5,
    attenuationColor: new THREE.Color(S.edge),
    attenuationDistance: 1.2,
    clearcoat: 0.6,
    clearcoatRoughness: 0.15,
    emissive: S.emissive,
    emissiveIntensity: 0.10,
    envMapIntensity: 1.1,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Bevel-rim glow — slightly larger backface-only shell for luminous edges.
  const rimGeo = new RoundedBoxGeometry(size * 1.02, size * 1.02, size * 1.02, 6, size * 0.22);
  const rimMat = new THREE.MeshBasicMaterial({
    color: S.edge,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.30,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  group.add(rim);

  // Pip overlay — drawn on each face surface, hidden by default. Faded in
  // after the die settles (post-physics) so they appear like stars revealing.
  // One material clone per die so opacity is independent.
  const pipMat = new THREE.MeshBasicMaterial({
    color: S.pip,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  });

  const pipGroup = new THREE.Group();
  pipGroup.name = 'pips';
  group.add(pipGroup);

  const half = size / 2;
  const pipR = size * 0.075;
  const surfaceLift = size * 0.005; // sits a hair above the face

  FACE_DEFS.forEach(({ val, axis, sign }) => {
    const positions = PIPS[val]!;
    // Disc oriented along this face's outward normal — flat, drawn-on look.
    const normal = new THREE.Vector3(
      axis === 'x' ? sign : 0,
      axis === 'y' ? sign : 0,
      axis === 'z' ? sign : 0,
    );
    const discQuat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normal,
    );

    positions.forEach(([u, v]) => {
      const depth = sign * (half + surfaceLift);
      const pos = new THREE.Vector3();
      if (axis === 'z') pos.set(u * size, v * size, depth);
      else if (axis === 'x') pos.set(depth, v * size, -u * size * sign);
      else pos.set(u * size, depth, -v * size * sign);

      const pip = new THREE.Mesh(new THREE.CircleGeometry(pipR, 18), pipMat);
      pip.position.copy(pos);
      pip.quaternion.copy(discQuat);
      pipGroup.add(pip);
    });
  });

  return { group, pipMat, pipGroup };
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
  holdBobPhase: number;
  pipMat: THREE.MeshBasicMaterial;
  pipOpacity: number;
  pipTargetOpacity: number;     // 0 hidden, 1 revealed
  pipFadeStart: number;         // ms since perf timer
  pipFadeFromOpacity: number;
  pipFadeDurMs: number;
};

const PIP_FADE_IN_MS = 520;
const PIP_FADE_OUT_MS = 180;
const PIP_REVEAL_DELAY_MS = 80;

function makeRadialGradientTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Dice3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private dice: DieAnim[] = [];
  private holdGlow: THREE.Mesh | null = null;
  private holdLinks: THREE.LineSegments | null = null;
  private holdAnchors: THREE.Points | null = null;
  private holdGradTex: THREE.Texture | null = null;
  private prevHoldCount = -1;
  private rafHandle: number | null = null;
  private unsubscribers: (() => void)[] = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private canvas: HTMLCanvasElement;
  private onPointerDown: ((ev: PointerEvent) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
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
    const ortho = 5;
    this.camera = new THREE.OrthographicCamera(-ortho * 1.78, ortho * 1.78, ortho, -ortho, 0.1, 100);
    this.camera.position.set(0, 11, 2.5);
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
    floor.position.y = ACTIVE_Y - DIE_SIZE / 2 - 0.01;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Constellation hold visuals — glow halo + linking lines + anchor stars.
    this.holdGradTex = makeRadialGradientTexture();
    const glowMat = new THREE.MeshBasicMaterial({
      map: this.holdGradTex,
      color: 0x7be3ff,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.holdGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
    this.holdGlow.rotation.x = -Math.PI / 2;
    this.holdGlow.position.set(0, HOLD_Y - DIE_SIZE / 2 - 0.05, HOLD_Z);
    this.holdGlow.visible = false;
    this.scene.add(this.holdGlow);

    const linkMat = new THREE.LineBasicMaterial({
      color: 0xdcd4ff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.holdLinks = new THREE.LineSegments(new THREE.BufferGeometry(), linkMat);
    this.holdLinks.visible = false;
    this.scene.add(this.holdLinks);

    const anchorMat = new THREE.PointsMaterial({
      color: 0xf3f0ff,
      size: 0.18,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.holdAnchors = new THREE.Points(new THREE.BufferGeometry(), anchorMat);
    this.holdAnchors.visible = false;
    this.scene.add(this.holdAnchors);

    this.buildDice();

    this.unsubscribers.push(
      store.subscribe((s, prev) => {
        if (s.round.dice !== prev.round.dice) this.syncDice(s.round.dice);
      }),
      bus.on('onSimulationEnd', ({ result }) => this.startPlayback(result.frames, result.finalFaces)),
    );
    this.syncDice(store.getState().round.dice);
    this.attachClick();
    this.start();
  }

  private attachClick(): void {
    this.onPointerDown = (ev: PointerEvent) => {
      // Skip if any die is mid-roll/playback — no locking during animation.
      if (this.dice.some((d) => d.playback != null || d.rolling)) return;

      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);

      const groups = this.dice.map((d) => d.group);
      const hits = this.raycaster.intersectObjects(groups, true);
      if (hits.length === 0) return;

      // Find the top-level group ancestor matching one of our dice.
      let obj: THREE.Object3D | null = hits[0]!.object;
      while (obj && !groups.includes(obj as THREE.Group)) obj = obj.parent;
      if (!obj) return;

      const idx = groups.indexOf(obj as THREE.Group);
      if (idx < 0) return;
      dispatch({ type: 'TOGGLE_LOCK', dieIdx: idx });
    };
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
  }

  destroy(): void {
    if (this.rafHandle != null) cancelAnimationFrame(this.rafHandle);
    this.unsubscribers.forEach((u) => u());
    if (this.onPointerDown) this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.dispose();
  }

  private buildDice() {
    const count = 5;
    const startX = -((count - 1) * DICE_GAP) / 2;
    for (let i = 0; i < count; i++) {
      const built = buildDie(DIE_SIZE, 'celestial');
      const home = new THREE.Vector3(startX + i * DICE_GAP, ACTIVE_Y, 0);
      built.group.position.copy(home);
      this.scene.add(built.group);
      this.dice.push({
        group: built.group,
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
        holdBobPhase: Math.random() * Math.PI * 2,
        pipMat: built.pipMat,
        pipOpacity: 0,
        pipTargetOpacity: 0,
        pipFadeStart: 0,
        pipFadeFromOpacity: 0,
        pipFadeDurMs: PIP_FADE_IN_MS,
      });
    }
  }

  private startPipFade(d: DieAnim, target: 0 | 1, delayMs = 0): void {
    if (d.pipTargetOpacity === target && d.pipFadeStart > 0) return;
    d.pipFadeFromOpacity = d.pipOpacity;
    d.pipTargetOpacity = target;
    d.pipFadeStart = performance.now() + delayMs;
    d.pipFadeDurMs = target === 1 ? PIP_FADE_IN_MS : PIP_FADE_OUT_MS;
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
        // Lock = lift in place. Keep home X/Z, only nudge Y up (design: translateY(-12px)).
        newTargetPos = new THREE.Vector3(die.homePos.x, HOLD_Y, HOLD_Z);
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

      // Face rotation target: only force canonical FACE_ROT when locked
      // (so dice sit cleanly face-up on the hold shelf). Active dice keep
      // whatever rotation physics produced — that orientation already shows
      // the correct face per faceFromQuaternion.
      if (!die.rolling && isLocked) {
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

    if (holdCount !== this.prevHoldCount) {
      this.rebuildHoldVisuals(holdCount);
      this.prevHoldCount = holdCount;
    }
  }

  private rebuildHoldVisuals(_holdCount: number): void {
    if (!this.holdGlow || !this.holdLinks || !this.holdAnchors) return;
    // Per design: locked dice lift in place with no rope, halo, or anchor stars.
    // Constellation lines are drawn only for scoring dice (ConstellationOverlay).
    this.holdGlow.visible = false;
    this.holdLinks.visible = false;
    this.holdAnchors.visible = false;
  }

  private kickAll() {
    const now = performance.now();
    this.dice.forEach((d, i) => {
      if (d.locked) return;
      this.startPipFade(d, 0);
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

  private startPlayback(frames: import('../../events/types').DieFrame[][] | undefined, _finalFaces: number[]): void {
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
      this.startPipFade(d, 0);
      d.playback = { frames: f, startedAt: now, stepMs: STEP_MS };
      d.rolling = false;
      // Do NOT set targetQuat from FACE_ROT here — physics rest pose already
      // shows the correct face. Setting canonical here would cause a visible
      // post-playback spin. Final pose will be captured at end of playback.
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
            d.targetQuat.copy(d.group.quaternion); // keep physics rest rotation, no canonical snap
            d.startPos.copy(d.group.position);
            d.targetPos.copy(d.homePos);
            d.targetScale = 1;
            d.startScale = d.group.scale.x;
            d.t0 = now;
            d.duration = 240;
            this.startPipFade(d, 1, PIP_REVEAL_DELAY_MS);
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
            this.startPipFade(d, 1, PIP_REVEAL_DELAY_MS);
          }
        } else {
          // Position + scale + face-quat smooth lerp
          const t = 1 - Math.pow(1 - tRaw, 3);
          d.group.position.lerpVectors(d.startPos, d.targetPos, t);
          const sc = d.startScale + (d.targetScale - d.startScale) * t;
          d.group.scale.setScalar(sc);
          d.group.quaternion.slerpQuaternions(d.startQuat, d.targetQuat, t);

          // Floaty held-die idle: bob + drift + gentle rotational shimmer once
          // the lerp into the hold slot has settled.
          if (d.locked && tRaw >= 1) {
            const ts = now / 1000;
            d.group.position.y = HOLD_Y + Math.sin(ts * 1.2 + d.holdBobPhase) * 0.08;
            d.group.position.x += Math.sin(ts * 0.7 + d.holdBobPhase) * 0.015;
            const wob = new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(0, 1, 0),
              Math.sin(ts * 0.6 + d.holdBobPhase) * 0.04,
            );
            d.group.quaternion.copy(d.targetQuat).multiply(wob);
          }
        }

        // Pip fade driver — drives per-die opacity toward target.
        if (d.pipFadeStart > 0) {
          const dt = now - d.pipFadeStart;
          if (dt >= 0) {
            const t = Math.min(1, dt / d.pipFadeDurMs);
            const eased = d.pipTargetOpacity === 1
              ? 1 - Math.pow(1 - t, 3)
              : t;
            const next = d.pipFadeFromOpacity + (d.pipTargetOpacity - d.pipFadeFromOpacity) * eased;
            d.pipOpacity = next;
            d.pipMat.opacity = next;
            if (t >= 1) {
              d.pipFadeStart = 0;
              d.pipOpacity = d.pipTargetOpacity;
              d.pipMat.opacity = d.pipTargetOpacity;
            }
          }
        }
      }
      this.renderer.render(this.scene, this.camera);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }
}
