const VERT_SRC = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG_SRC = `
precision mediump float;

uniform vec2  u_res;
uniform float u_time;
uniform float u_mode;
uniform float u_flash;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  vec2 shift = vec2(100.0);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.1 + shift; a *= 0.48; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  uv.y = 1.0 - uv.y;
  float t = u_time * 0.035;
  vec2 q = uv * 2.8 - 1.4;
  float n1 = fbm(q + t * vec2(0.18, 0.12));
  float n2 = fbm(q + n1 * 0.85 + vec2(3.43, 2.14) + t * 0.06);
  float nebula = fbm(q + n2 * 0.65 + vec2(8.1, 4.3) + t * 0.03);
  float m = clamp(u_mode, 0.0, 3.0);
  vec3 cold, warm;
  cold = mix(vec3(0.015, 0.008, 0.045), vec3(0.030, 0.010, 0.090), clamp(m, 0.0, 1.0));
  warm = mix(vec3(0.045, 0.018, 0.120), vec3(0.120, 0.040, 0.220), clamp(m, 0.0, 1.0));
  cold = mix(cold, vec3(0.008, 0.025, 0.065), clamp(m - 1.0, 0.0, 1.0));
  warm = mix(warm, vec3(0.020, 0.060, 0.130), clamp(m - 1.0, 0.0, 1.0));
  cold = mix(cold, vec3(0.060, 0.004, 0.018), clamp(m - 2.0, 0.0, 1.0));
  warm = mix(warm, vec3(0.200, 0.018, 0.050), clamp(m - 2.0, 0.0, 1.0));
  vec3 col = mix(cold, warm, nebula * 0.95 + 0.03);

  vec2 sUV = uv * vec2(200.0, 112.0);
  float star = hash(floor(sUV));
  star = pow(max(0.0, star - 0.965) / 0.035, 3.0);
  float twinkle = 0.6 + 0.4 * sin(u_time * 1.4 + hash(floor(sUV)) * 6.28);
  col += star * twinkle * vec3(0.85, 0.90, 1.00) * 0.55;

  vec2 hUV = uv * vec2(55.0, 31.0);
  float hStar = hash(floor(hUV));
  hStar = pow(max(0.0, hStar - 0.96) / 0.04, 4.0);
  float hTwinkle = 0.5 + 0.5 * sin(u_time * 0.9 + hash(floor(hUV)) * 6.28);
  col += hStar * hTwinkle * vec3(0.90, 0.88, 1.00) * 0.80;

  float vig = 1.0 - smoothstep(0.25, 1.05, length((uv - 0.5) * vec2(1.78, 1.0)));
  col *= vig * 0.92 + 0.08;

  col += u_flash * vec3(0.18, 0.12, 0.32) * smoothstep(0.3, 1.0, nebula);
  col += u_flash * 0.06 * vec3(1.0, 0.9, 1.0);

  gl_FragColor = vec4(col, 1.0);
}
`;

import type { Screen } from '../../state/slices/ui';

const SCREEN_MODES: Record<Screen, number> = {
  title: 0, nameentry: 0, scores: 0, win: 1, round: 1,
  hub: 2, shop: 2, forge: 2, runes: 2, pause: 0,
};

let gl: WebGLRenderingContext | null = null;
let program: WebGLProgram | null = null;
let uniforms: { res: WebGLUniformLocation | null; time: WebGLUniformLocation | null; mode: WebGLUniformLocation | null; flash: WebGLUniformLocation | null } = { res: null, time: null, mode: null, flash: null };
let vbo: WebGLBuffer | null = null;
let _canvas: HTMLCanvasElement | null = null;
let _active = false;
let _flash = 0;
let _intensity = 0;
let _screen: Screen = 'title';

function compile(type: number, src: string): WebGLShader | null {
  const g = gl!;
  const s = g.createShader(type);
  if (!s) return null;
  g.shaderSource(s, src);
  g.compileShader(s);
  if (!g.getShaderParameter(s, g.COMPILE_STATUS)) {
    console.error('[nebula] compile:', g.getShaderInfoLog(s));
    return null;
  }
  return s;
}

export function initNebula(canvas: HTMLCanvasElement): boolean {
  _canvas = canvas;
  try { gl = canvas.getContext('webgl') as WebGLRenderingContext | null; }
  catch { gl = null; }
  if (!gl) return false;
  const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
  if (!vs || !fs) return false;
  program = gl.createProgram();
  if (!program) return false;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[nebula] link:', gl.getProgramInfoLog(program));
    return false;
  }
  vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  uniforms = {
    res: gl.getUniformLocation(program, 'u_res'),
    time: gl.getUniformLocation(program, 'u_time'),
    mode: gl.getUniformLocation(program, 'u_mode'),
    flash: gl.getUniformLocation(program, 'u_flash'),
  };
  _active = true;
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  startLoop();
  return true;
}

function resizeCanvas() {
  if (!_canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  _canvas.width = Math.floor(window.innerWidth * dpr);
  _canvas.height = Math.floor(window.innerHeight * dpr);
}

export function setNebulaScreen(s: Screen): void { _screen = s; }
export function setNebulaIntensity(i: number): void { _intensity = Math.max(0, Math.min(1, i)); }
export function flashNebula(amount = 0.7): void { _flash = Math.min(1, _flash + amount); }

let rafHandle: number | null = null;
function startLoop() {
  if (rafHandle != null) return;
  const start = performance.now();
  const loop = () => {
    rafHandle = requestAnimationFrame(loop);
    if (!_active || !gl || !program || !_canvas) return;
    _flash = Math.max(0, _flash - 0.022);
    const time = (performance.now() - start) / 1000;
    const baseMode = SCREEN_MODES[_screen] ?? 0;
    const mode = baseMode + (3 - baseMode) * _intensity * 0.45;
    const cw = _canvas.width;
    const ch = _canvas.height;
    gl.viewport(0, 0, cw, ch);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const posLoc = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uniforms.res, cw, ch);
    gl.uniform1f(uniforms.time, time);
    gl.uniform1f(uniforms.mode, mode);
    gl.uniform1f(uniforms.flash, _flash);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  rafHandle = requestAnimationFrame(loop);
}
