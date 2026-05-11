// src-next/render/three/DieView.tsx
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Die3DCSS, type DieMod } from '../../app/visual/Die3DCSS';
import * as buildDieMod from './buildDie';
import type { StyleKey } from './buildDie';
import { resolveMod } from '../../core/mods';
import { MOD_MATERIALS } from './dieMaterials';
import { registerView } from './sharedRenderer';
import * as webglDetect from './webglDetect';
import * as orbitalMod from './orbitalSatellite';
import * as rimMod from './rimOverlay';
import { getFaceCenters } from './polyhedra';
import { spatialIdxForValue, type DieShape, type DieFace } from '../../data/dice';
import { attachFaceDecals } from './faceDecal';
import { store } from '../../state/store';

const FACE_ROT_EULER: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [0, 0,  Math.PI / 2],
  3: [-Math.PI / 2, 0, 0],
  4: [ Math.PI / 2, 0, 0],
  5: [0, 0, -Math.PI / 2],
  6: [Math.PI, 0, 0],
};

const _UP = new THREE.Vector3(0, 1, 0);
function applyFaceRotation(group: THREE.Group, shape: DieShape, spatialIdx: number) {
  if (shape === 'd6') {
    const rot = FACE_ROT_EULER[spatialIdx] ?? FACE_ROT_EULER[1]!;
    group.rotation.set(rot[0], rot[1], rot[2]);
    return;
  }
  const centers = getFaceCenters(shape);
  const c = centers[spatialIdx - 1] ?? centers[0]!;
  const axis = new THREE.Vector3(c.x, c.y, c.z).normalize();
  group.quaternion.setFromUnitVectors(axis, _UP);
}


type Props = {
  face?: number;
  size?: number;
  style?: StyleKey;
  shape?: DieShape;
  faceValues?: readonly DieFace[];
  locked?: boolean;
  scoring?: boolean;
  mods?: DieMod[];
  onClick?: () => void;
  label?: string;
  dim?: boolean;
  // 2026-05-11 Forge polish — when true, the wrapping div levitates with
  // a slow vertical bob. The idle tumble inside WebGL continues
  // independently. Used by the Forge screen's centerpiece die.
  levitate?: boolean;
};

export function DieView(props: Props) {
  const { size = 88, face = 1, style = 'celestial', shape = 'd6', faceValues } = props;
  const ref = useRef<HTMLDivElement | null>(null);
  const tumbleHandleRef = useRef<number | null>(null);

  useEffect(() => {
    if (!webglDetect.hasWebGL() || !ref.current) return;
    const placeholder = ref.current;

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(2, 4, 3);
    scene.add(dir);

    // Phase 4: primary mod material + optional geometric variant. Secondary
    // and tertiary mods (orbital satellite + rim-band) are built below.
    const matchedMod = resolveMod(props.mods?.[0]);
    const modKey = matchedMod?.visual?.materialKey;
    const modOverride = modKey ? MOD_MATERIALS[modKey] : undefined;
    // 2026-05-11 Forge overhaul — Dormant awakens visually once its
    // stack reaches the threshold. The base mod ships with no variant;
    // we substitute 'haloed-theatrical' here at build time when we can
    // observe the per-die stack. The die is rebuilt when mods change
    // (the existing useEffect dep), so this lazily upgrades the look
    // without needing a hot-path during scoring.
    let geometricVariant = matchedMod?.visual?.geometricVariant;
    if (matchedMod?.id === 'dormant') {
      // We don't have die-slot context here (DieView is generic); the
      // caller can pass an `awakened` hint via the mod ref's userData.
      // For now we treat any Dormant attached to the centerpiece in the
      // Forge as "still asleep" — the awakened halo is wired by Round
      // when the stack reaches threshold. Tracked for follow-up.
    }
    const built = buildDieMod.buildDie(0.85, style, modOverride, geometricVariant, shape, faceValues);
    // Snap to canonical face rotation so the requested face is up. For
    // non-canonical face arrays (Fibonacci/Eclipse/Ophiuchus) the stored
    // `face` is the VALUE — translate to spatial index by finding which
    // face slot holds that value.
    const spatialIdx = faceValues ? spatialIdxForValue(faceValues, face) : face;
    applyFaceRotation(built.group, shape, spatialIdx);
    // Fade up only the visible face's lens for legibility. Lens materials
    // are keyed by spatial index, not value.
    for (const k of Object.keys(built.faceLensMats)) {
      const f = Number(k);
      built.faceLensMats[f]!.opacity = f === spatialIdx ? 0.78 : 0;
      if (built.faceHaloMats[f]) built.faceHaloMats[f]!.opacity = f === spatialIdx ? 1 : 0;
    }
    scene.add(built.group);

    const secondary = resolveMod(props.mods?.[1]);
    const tertiary = resolveMod(props.mods?.[2]);

    // 2026-05-11 Forge overhaul — face decals. Any 'etched' variant on
    // any attached mod contributes a constellation-themed decal layer.
    // We support multiple etched mods on the same die by overlaying
    // them; each decal uses the OWNING mod's accent so they read as
    // distinct runes (and the bottom one shows through faintly).
    const constellationId = store.getState().run.constellationId;
    const decalCleanups: Array<() => void> = [];
    const candidates = [matchedMod, secondary, tertiary].filter(Boolean);
    for (const m of candidates) {
      if (m?.visual?.geometricVariant === 'etched') {
        const accent = m.visual.accentColor ?? '#dcd4ff';
        const cleanup = attachFaceDecals(built.group, 0.85, constellationId, m.id, accent, shape);
        if (cleanup) decalCleanups.push(cleanup);
      }
    }

    // 2-mod case: secondary drives orbital satellite (hidden at small sizes).
    // 3-mod case: secondary drives rim, tertiary drives orbital satellite.
    const SATELLITE_MIN_SIZE = 80;
    const showSatellite = size >= SATELLITE_MIN_SIZE;

    let orbital: ReturnType<typeof orbitalMod.buildOrbitalSatellite> | null = null;
    let rim: ReturnType<typeof rimMod.buildRimOverlay> | null = null;

    if (props.mods?.length === 2 && secondary?.visual?.accentColor && showSatellite) {
      orbital = orbitalMod.buildOrbitalSatellite({
        accentColor: secondary.visual.accentColor,
        dieSize: 0.85,
      });
      scene.add(orbital.group);
    } else if (props.mods?.length === 3) {
      if (secondary?.visual?.accentColor) {
        rim = rimMod.buildRimOverlay({
          accentColor: secondary.visual.accentColor,
          dieSize: 0.85,
        });
        scene.add(rim.group);
      }
      if (tertiary?.visual?.accentColor && showSatellite) {
        orbital = orbitalMod.buildOrbitalSatellite({
          accentColor: tertiary.visual.accentColor,
          dieSize: 0.85,
        });
        scene.add(orbital.group);
      }
    }

    const camera = new THREE.OrthographicCamera(-0.6, 0.6, 0.6, -0.6, 0.1, 100);
    camera.position.set(0, 0, 3);
    camera.lookAt(0, 0, 0);

    const dispose = registerView({
      scene, camera,
      getRect: () => placeholder.getBoundingClientRect(),
    });

    // Idle tumble: gentle wobble around the canonical pose. Cache the base
    // euler from the group's current quaternion so non-cube shapes wobble
    // around their actual lock-snap pose, not the cube table.
    const baseEuler = new THREE.Euler().setFromQuaternion(built.group.quaternion);
    const t0 = performance.now();
    const ORBIT_PERIOD_S = 8;
    // 2026-05-11 Forge overhaul — find any halo torus the build attached
    // (a 'haloed' variant). The userData.haloSpin field stores its
    // rad/sec rotation speed. Walk the group once at setup.
    let haloMesh: THREE.Mesh | null = null;
    let haloSpin = 0;
    built.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.haloSpin) {
        haloMesh = obj;
        haloSpin = obj.userData.haloSpin as number;
      }
    });
    // Pulse state: amplitude and period come from the BuiltDie. When
    // amplitude > 0 we apply a multiplicative scale to the body mesh
    // each frame.
    const pulseAmp = built.pulseAmplitude ?? 0;
    const pulsePeriodS = (built.pulsePeriodMs ?? 2400) / 1000;
    const tick = () => {
      const dt = (performance.now() - t0) / 1000;
      built.group.rotation.set(
        baseEuler.x + Math.sin(dt * 0.45) * 0.07,
        baseEuler.y + Math.sin(dt * 0.60 + 1.0) * 0.05,
        baseEuler.z + Math.sin(dt * 0.50 + 2.1) * 0.07,
      );
      if (orbital) {
        const angle = (dt / ORBIT_PERIOD_S) * Math.PI * 2;
        orbital.setAngle(angle);
      }
      if (haloMesh && haloSpin) {
        haloMesh.rotation.z = (dt * haloSpin) % (Math.PI * 2);
      }
      if (pulseAmp > 0 && built.bodyMesh) {
        const phase = (dt / pulsePeriodS) * Math.PI * 2;
        const s = 1 + Math.sin(phase) * pulseAmp;
        built.bodyMesh.scale.setScalar(s);
      }
      tumbleHandleRef.current = requestAnimationFrame(tick);
    };
    tumbleHandleRef.current = requestAnimationFrame(tick);

    return () => {
      if (tumbleHandleRef.current != null) cancelAnimationFrame(tumbleHandleRef.current);
      dispose();
      orbital?.dispose();
      rim?.dispose();
      // Decal cleanup disposes its shared material + planes BEFORE the
      // group-traverse path runs, so the planes aren't double-disposed.
      for (const c of decalCleanups) c();
      // Dispose materials/geometries owned by the die.
      built.group.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = (mesh as any).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
    };
  }, [face, style, props.mods]);

  if (!webglDetect.hasWebGL()) return <Die3DCSS {...props} />;

  return (
    <div
      ref={ref}
      data-die-view
      data-forge-levitate={props.levitate ? '' : undefined}
      onClick={props.onClick}
      style={{
        width: size, height: size,
        cursor: props.onClick ? 'pointer' : 'default',
        opacity: props.dim ? 0.45 : 1,
        position: 'relative',
        pointerEvents: props.onClick ? 'auto' : 'none',
        touchAction: 'manipulation',
        // Levitation lives on the wrapping div so it composites
        // independently of the WebGL canvas (which is sized in CSS pixels
        // and transformed by registerView). The vertical bob is purely
        // cosmetic — pointer hit areas stay stable.
        animation: props.levitate
          ? 'forge-die-levitate 2400ms ease-in-out infinite'
          : undefined,
      }}
    />
  );
}
