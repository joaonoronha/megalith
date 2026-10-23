import React from 'react';

export interface LiquidGlassCanvasProps {
  readonly width?: number;
  readonly height?: number;
  readonly posterUrl: string;
  readonly videoRef?: React.RefObject<HTMLVideoElement | null>;
  readonly className?: string;
}

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/**
 * Liquid Glass Refraction Fragment Shader
 * Adapted from https://github.com/prabinpebam/liquid-glass (Refraction option)
 */
const FRAGMENT_SHADER = `
precision mediump float;
varying vec2 v_uv;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_containerResolution;
uniform float u_edgeDistortionThickness;
uniform float u_refractionStrength;
uniform float u_chromaticAberrationAmount;
uniform float u_frostiness;
uniform vec4 u_glassBaseColor;

void main() {
    vec2 p = (v_uv - vec2(0.5)) * u_resolution;
    float radius = min(u_resolution.x, u_resolution.y) * 0.5;
    float dist = length(p);
    float d = dist - radius;

    float mask = 1.0 - smoothstep(-1.0, 0.5, d);
    if (mask <= 0.0) {
        discard;
    }

    vec2 dir = dist > 0.0001 ? normalize(p) : vec2(0.0, 1.0);

    // Liquid Glass edge distortion calculation (prabinpebam/liquid-glass)
    float innerBoundary = -u_edgeDistortionThickness;
    float edgeAmount = 0.0;
    if (d > innerBoundary) {
        edgeAmount = clamp((d - innerBoundary) / u_edgeDistortionThickness, 0.0, 1.0);
    }

    float distortionMag = u_refractionStrength * pow(edgeAmount, 2.0);

    // Chromatic aberration refraction (R, G, B channels)
    float rDist = max(0.0, distortionMag - u_chromaticAberrationAmount * 0.5);
    float gDist = distortionMag;
    float bDist = distortionMag + u_chromaticAberrationAmount * 0.5;

    vec2 span = u_resolution / u_containerResolution;
    vec2 centerUV = vec2(0.5, 0.5);

    vec2 rCoord = centerUV + ((v_uv - vec2(0.5)) - (dir * rDist) / u_resolution) * span;
    vec2 gCoord = centerUV + ((v_uv - vec2(0.5)) - (dir * gDist) / u_resolution) * span;
    vec2 bCoord = centerUV + ((v_uv - vec2(0.5)) - (dir * bDist) / u_resolution) * span;

    // Flip Y for texture space
    rCoord.y = 1.0 - rCoord.y;
    gCoord.y = 1.0 - gCoord.y;
    bCoord.y = 1.0 - bCoord.y;

    vec4 color = vec4(0.0);
    if (u_frostiness > 0.1) {
        float samples = 0.0;
        for (int x = -1; x <= 1; x++) {
            for (int y = -1; y <= 1; y++) {
                vec2 offset = vec2(float(x), float(y)) * (u_frostiness / u_containerResolution);
                color.r += texture2D(u_texture, rCoord + offset).r;
                color.g += texture2D(u_texture, gCoord + offset).g;
                color.b += texture2D(u_texture, bCoord + offset).b;
                samples += 1.0;
            }
        }
        color /= samples;
    } else {
        color.r = texture2D(u_texture, rCoord).r;
        color.g = texture2D(u_texture, gCoord).g;
        color.b = texture2D(u_texture, bCoord).b;
    }
    color.a = 1.0;

    // Mix glass base tint
    color = mix(color, u_glassBaseColor, u_glassBaseColor.a);

    // Specular highlights: Top shadow and bottom glow
    float topShadow = smoothstep(-15.0, 0.0, p.y + radius * 0.7) * smoothstep(0.0, -10.0, d) * 0.22;
    color.rgb = mix(color.rgb, vec3(0.0), topShadow);

    float bottomGlow = smoothstep(15.0, 0.0, p.y - radius * 0.7) * smoothstep(0.0, -10.0, d) * 0.3;
    color.rgb += vec3(bottomGlow * 0.35);

    // Subtle edge rim highlight
    float rim = smoothstep(-2.5, -0.5, d) * 0.35;
    color.rgb += vec3(rim);

    gl_FragColor = vec4(color.rgb, mask);
}
`;

export const LiquidGlassCanvas: React.FC<LiquidGlassCanvasProps> = ({
  width = 70,
  height = 70,
  posterUrl,
  videoRef,
  className = '',
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Retina 2x resolution
    const pixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const internalWidth = width * pixelRatio;
    const internalHeight = height * pixelRatio;
    canvas.width = internalWidth;
    canvas.height = internalHeight;

    // In test / JSDOM environments, skip canvas WebGL context to prevent noisy jsdom warnings
    if (
      typeof window !== 'undefined' &&
      (window.navigator?.userAgent?.includes('jsdom') ||
        (import.meta as any).env?.MODE === 'test')
    ) {
      return;
    }

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl', { alpha: true, antialias: true }) ||
           (canvas.getContext('experimental-webgl', { alpha: true, antialias: true }) as WebGLRenderingContext | null);
    } catch {
      gl = null;
    }

    if (!gl) {
      // Graceful fallback for non-WebGL environments (e.g. Vitest / JSDOM)
      return;
    }

    // Helper to compile shaders
    const compile = (type: number, source: string): WebGLShader | null => {
      if (!gl) return null;
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    gl.useProgram(program);

    // Full-screen quad
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Uniform locations
    const uResLoc = gl.getUniformLocation(program, 'u_resolution');
    const uContainerResLoc = gl.getUniformLocation(program, 'u_containerResolution');
    const uEdgeDistLoc = gl.getUniformLocation(program, 'u_edgeDistortionThickness');
    const uRefractStrLoc = gl.getUniformLocation(program, 'u_refractionStrength');
    const uCALoc = gl.getUniformLocation(program, 'u_chromaticAberrationAmount');
    const uFrostLoc = gl.getUniformLocation(program, 'u_frostiness');
    const uBaseColorLoc = gl.getUniformLocation(program, 'u_glassBaseColor');

    // Values from prabinpebam/liquid-glass refraction option
    gl.uniform2f(uResLoc, internalWidth, internalHeight);
    gl.uniform2f(uContainerResLoc, 440 * pixelRatio, 330 * pixelRatio); // 4:3 video container scale
    gl.uniform1f(uEdgeDistLoc, 18.0 * pixelRatio);
    gl.uniform1f(uRefractStrLoc, 36.0 * pixelRatio);
    gl.uniform1f(uCALoc, 5.5 * pixelRatio);
    gl.uniform1f(uFrostLoc, 1.2 * pixelRatio);
    gl.uniform4f(uBaseColorLoc, 0.98, 0.98, 1.0, 0.12);

    // Texture setup
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Placeholder 1x1 ivory pixel while image loads
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([248, 245, 238, 255])
    );

    let isDisposed = false;

    const render = () => {
      if (!gl || isDisposed) return;
      gl.viewport(0, 0, internalWidth, internalHeight);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    // Load poster image as initial texture
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (isDisposed || !gl) return;
      try {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        render();
      } catch {
        // Fallback gracefully
      }
    };
    img.src = posterUrl;

    render();

    return () => {
      isDisposed = true;
      if (gl) {
        if (texture) gl.deleteTexture(texture);
        if (posBuffer) gl.deleteBuffer(posBuffer);
        if (program) gl.deleteProgram(program);
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
      }
    };
  }, [width, height, posterUrl, videoRef]);

  return (
    <canvas
      ref={canvasRef}
      className={`liquid-glass-canvas ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: 'none',
        borderRadius: '50%',
        position: 'absolute',
        inset: 0,
      }}
      aria-hidden="true"
    />
  );
};
