import * as THREE from 'three';

// Project a world-space point onto the canvas in CSS pixels.
//
// THREE's `.project(camera)` returns normalized device coordinates in [-1, 1]
// on x/y (and a z that's positive in front of the camera through 1 at the far
// plane). We map that to CSS pixels via the canvas's bounding rect so callers
// (DieTip, etc.) can position absolutely without doing their own 3D math.
//
// `inView` is true when the point lies inside the camera frustum — caller can
// fall back to "show on-edge" or "hide" when false.
export function projectToScreen(
  worldPos: THREE.Vector3,
  camera: THREE.Camera,
  rect: DOMRect,
): { x: number; y: number; inView: boolean } {
  const ndc = worldPos.clone().project(camera);
  const x = rect.left + (ndc.x * 0.5 + 0.5) * rect.width;
  const y = rect.top + (-ndc.y * 0.5 + 0.5) * rect.height;
  const inView = ndc.x >= -1 && ndc.x <= 1 && ndc.y >= -1 && ndc.y <= 1 && ndc.z <= 1;
  return { x, y, inView };
}
