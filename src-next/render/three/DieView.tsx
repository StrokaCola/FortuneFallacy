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

const FACE_ROT_EULER: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [0, 0,  Math.PI / 2],
  3: [-Math.PI / 2, 0, 0],
  4: [ Math.PI / 2, 0, 0],
  5: [0, 0, -Math.PI / 2],
  6: [Math.PI, 0, 0],
};

type Props = {
  face?: number;
  size?: number;
  style?: StyleKey;
  locked?: boolean;
  scoring?: boolean;
  mods?: DieMod[];
  onClick?: () => void;
  label?: string;
  dim?: boolean;
};

export function DieView(props: Props) {
  const { size = 88, face = 1, style = 'celestial' } = props;
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
    const built = buildDieMod.buildDie(0.85, style, modOverride);
    // Snap to canonical face rotation so the requested face is up.
    built.group.rotation.set(...(FACE_ROT_EULER[face] ?? FACE_ROT_EULER[1]!));
    // Fade up only the visible face's pip lens for legibility.
    for (let f = 1; f <= 6; f++) {
      const visible = f === face ? 0.78 : 0;
      built.faceLensMats[f as 1 | 2 | 3 | 4 | 5 | 6].opacity = visible;
      built.faceHaloMats[f as 1 | 2 | 3 | 4 | 5 | 6].opacity = f === face ? 1 : 0;
    }
    scene.add(built.group);

    const secondary = resolveMod(props.mods?.[1]);
    const tertiary = resolveMod(props.mods?.[2]);

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

    // Idle tumble: gentle wobble around the canonical pose.
    const baseEuler = FACE_ROT_EULER[face] ?? FACE_ROT_EULER[1]!;
    const t0 = performance.now();
    const ORBIT_PERIOD_S = 8;
    const tick = () => {
      const dt = (performance.now() - t0) / 1000;
      built.group.rotation.set(
        baseEuler[0] + Math.sin(dt * 0.45) * 0.07,
        baseEuler[1] + Math.sin(dt * 0.60 + 1.0) * 0.05,
        baseEuler[2] + Math.sin(dt * 0.50 + 2.1) * 0.07,
      );
      if (orbital) {
        const angle = (dt / ORBIT_PERIOD_S) * Math.PI * 2;
        orbital.setAngle(angle);
      }
      tumbleHandleRef.current = requestAnimationFrame(tick);
    };
    tumbleHandleRef.current = requestAnimationFrame(tick);

    return () => {
      if (tumbleHandleRef.current != null) cancelAnimationFrame(tumbleHandleRef.current);
      dispose();
      orbital?.dispose();
      rim?.dispose();
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
      onClick={props.onClick}
      style={{
        width: size, height: size,
        cursor: props.onClick ? 'pointer' : 'default',
        opacity: props.dim ? 0.45 : 1,
        position: 'relative',
        // Reserve space; actual pixels are drawn by sharedRenderer overlay.
      }}
    />
  );
}
