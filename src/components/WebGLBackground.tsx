import { useEffect, useRef } from "react";

// Purely decorative: a few soft, slowly drifting glows behind the app's
// cards, rendered with WebGL instead of a CSS animation so they stay smooth
// even while the rest of the page is busy (route transitions, chart
// re-renders). No dependency, no network — it draws two triangles and a
// handful of `exp()` calls per pixel. It reads no beer data and writes
// nothing; if it fails to start for any reason the app looks exactly as it
// does today.

const VERTEX_SRC = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SRC = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec3 u_colorC;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;

  float t = u_time * 0.05;
  vec2 c1 = vec2(sin(t * 0.7) * 0.65, cos(t * 0.5) * 0.5 - 0.15);
  vec2 c2 = vec2(cos(t * 0.4) * 0.6, sin(t * 0.9) * 0.55 + 0.25);
  vec2 c3 = vec2(sin(t * 0.33 + 2.0) * 0.5 + 0.15, cos(t * 0.6 + 1.0) * 0.45 - 0.3);

  float g1 = exp(-dot(p - c1, p - c1) * 2.6);
  float g2 = exp(-dot(p - c2, p - c2) * 2.6);
  float g3 = exp(-dot(p - c3, p - c3) * 2.6);

  vec3 col = u_colorA * g1 + u_colorB * g2 + u_colorC * g3;
  float alpha = clamp((g1 + g2 + g3) * 0.4, 0.0, 0.28);

  gl_FragColor = vec4(col, alpha);
}
`;

type RGB = [number, number, number];

// The app's palette is written in oklch (see src/styles.css) so it can't be
// parsed as text; letting the browser resolve it through a throwaway element
// is the same trick devtools uses, and it works for any color function.
function readCssColorRGB(varName: string, fallback: RGB): RGB {
  if (typeof document === "undefined") return fallback;
  try {
    const probe = document.createElement("span");
    probe.style.color = `var(${varName})`;
    probe.style.display = "none";
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    document.body.removeChild(probe);
    const nums = resolved.match(/[\d.]+/g);
    if (!nums || nums.length < 3) return fallback;
    return [Number(nums[0]) / 255, Number(nums[1]) / 255, Number(nums[2]) / 255];
  } catch {
    return fallback;
  }
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function WebGLBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = (canvas.getContext("webgl") ??
        canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    } catch {
      gl = null;
    }
    if (!gl) return;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    const program = gl.createProgram();
    if (!vertexShader || !fragmentShader || !program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
    const timeLoc = gl.getUniformLocation(program, "u_time");
    const colorALoc = gl.getUniformLocation(program, "u_colorA");
    const colorBLoc = gl.getUniformLocation(program, "u_colorB");
    const colorCLoc = gl.getUniformLocation(program, "u_colorC");

    const background = readCssColorRGB("--background", [0.039, 0.059, 0.11]);
    const primary = readCssColorRGB("--primary", [0.231, 0.51, 0.965]);
    const colorA = primary;
    const colorB = mix(primary, [1, 1, 1], 0.3);
    const colorC = mix(primary, background, 0.45);
    gl.uniform3f(colorALoc, ...colorA);
    gl.uniform3f(colorBLoc, ...colorB);
    gl.uniform3f(colorCLoc, ...colorC);

    // Rendered under CSS pixels rather than device pixels — the glows are
    // soft by design, so the upscale reads as depth, not blur, and it keeps
    // this cheap on a phone with a high-DPI screen.
    const RENDER_SCALE = 0.6;
    function resize() {
      if (!gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(window.innerWidth * dpr * RENDER_SCALE));
      const height = Math.max(1, Math.floor(window.innerHeight * dpr * RENDER_SCALE));
      if (canvas!.width !== width || canvas!.height !== height) {
        canvas!.width = width;
        canvas!.height = height;
        gl.viewport(0, 0, width, height);
      }
      gl.uniform2f(resolutionLoc, width, height);
    }

    function draw(time: number) {
      if (!gl) return;
      gl.uniform1f(timeLoc, time);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function handleResize() {
      resize();
      if (reduceMotion) draw(0);
    }
    resize();
    window.addEventListener("resize", handleResize);

    let rafId = 0;
    const start = performance.now();

    function frame(now: number) {
      draw((now - start) / 1000);
      rafId = requestAnimationFrame(frame);
    }

    function stopLoop() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    }

    function startLoop() {
      if (reduceMotion || rafId) return;
      rafId = requestAnimationFrame(frame);
    }

    function handleVisibility() {
      if (document.hidden) stopLoop();
      else startLoop();
    }

    if (reduceMotion) {
      draw(0);
    } else {
      startLoop();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    canvas.addEventListener("webglcontextlost", stopLoop);

    return () => {
      stopLoop();
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      canvas.removeEventListener("webglcontextlost", stopLoop);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
