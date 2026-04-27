import * as THREE from 'three';

export function createCosmicEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#07051a');
    grad.addColorStop(0.35, '#1c1245');
    grad.addColorStop(0.55, '#2e1d6b');
    grad.addColorStop(0.75, '#7be3ff');
    grad.addColorStop(1.0, '#ff7847');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 256;
      const r = 1 + Math.random() * 2;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.5})`;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const eqTex = new THREE.CanvasTexture(canvas);
  eqTex.mapping = THREE.EquirectangularReflectionMapping;
  eqTex.colorSpace = THREE.SRGBColorSpace;
  const env = pmrem.fromEquirectangular(eqTex).texture;
  pmrem.dispose();
  eqTex.dispose();
  return env;
}
