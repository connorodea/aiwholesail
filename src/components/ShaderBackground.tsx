import { useRef, useEffect, useCallback } from 'react';

/**
 * Organic noise-based shader background with mouse reactivity.
 * Renders a full-screen canvas behind content with animated gradient noise,
 * subtle wave effects, and bloom-like glow that responds to mouse position.
 */

const VERTEX_SHADER = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform float uScrollY;

  // Simplex-style noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec2 mouse = uMouse / uResolution;

    // Base noise layers (organic flowing gradient)
    float t = uTime * 0.08;
    float n1 = snoise(uv * 2.0 + vec2(t, t * 0.7)) * 0.5 + 0.5;
    float n2 = snoise(uv * 4.0 - vec2(t * 0.5, t * 1.2)) * 0.5 + 0.5;
    float n3 = snoise(uv * 1.5 + vec2(t * 0.3, -t * 0.4)) * 0.5 + 0.5;

    // Wave effect
    float wave = sin(uv.x * 6.0 + t * 2.0 + n1 * 3.0) * 0.02;
    uv.y += wave;

    // Color palette: deep dark with cyan and teal accents
    vec3 darkBase = vec3(0.031, 0.035, 0.039);   // #08090a
    vec3 cyan     = vec3(0.0, 0.769, 0.784);      // #00c4c8 (brand seafoam)
    vec3 teal     = vec3(0.051, 0.647, 0.506);    // #0da581
    vec3 deepBlue = vec3(0.02, 0.06, 0.15);

    // Mouse influence — subtle glow that follows cursor
    float mouseDist = length(uv - mouse);
    float mouseGlow = smoothstep(0.5, 0.0, mouseDist) * 0.08;

    // Compose color
    float blend = n1 * 0.4 + n2 * 0.3 + n3 * 0.3;
    vec3 color = darkBase;

    // Subtle gradient: more blue-cyan at top, darker at bottom
    color += deepBlue * (1.0 - uv.y) * 0.3;

    // Noise-driven color accents
    color += cyan * blend * 0.04 * (1.0 - uv.y * 0.5);
    color += teal * n2 * 0.03 * uv.y;

    // Mouse reactive glow
    color += cyan * mouseGlow;

    // Scroll-based fade: push colors slightly as user scrolls
    float scrollFade = min(uScrollY / 2000.0, 1.0);
    color = mix(color, darkBase, scrollFade * 0.3);

    // Vignette
    float vignette = 1.0 - smoothstep(0.4, 1.4, length(uv - 0.5) * 1.5);
    color *= vignette * 0.85 + 0.15;

    // Very subtle film grain
    float grain = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.015;
    color += grain;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function ShaderBackground({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const scrollRef = useRef(0);
  const rafRef = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleScroll = useCallback(() => {
    scrollRef.current = window.scrollY;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check for reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) return;

    // Compile shaders
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, VERTEX_SHADER);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, FRAGMENT_SHADER);
    gl.compileShader(fs);

    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.warn('Shader compile error:', gl.getShaderInfoLog(fs));
      return;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Full-screen quad
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uResolution = gl.getUniformLocation(program, 'uResolution');
    const uMouse = gl.getUniformLocation(program, 'uMouse');
    const uScrollY = gl.getUniformLocation(program, 'uScrollY');

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 1.5); // Cap DPR for performance
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll, { passive: true });

    const startTime = performance.now();

    const render = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform2f(uMouse, mouseRef.current.x * (canvas.width / canvas.clientWidth), (canvas.clientHeight - mouseRef.current.y) * (canvas.height / canvas.clientHeight));
      gl.uniform1f(uScrollY, scrollRef.current);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
    };
  }, [handleMouseMove, handleScroll]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full ${className}`}
      style={{ zIndex: 0 }}
    />
  );
}
