/**
 * gridShaders.js
 * High-performance procedural infinite tactical grid shader.
 * Renders anti-aliased minor/major coordinate gridlines and coordinate hashes.
 */

export const gridVertexShader = `#version 300 es
in vec2 a_position;
out vec2 v_screenCoord;

void main() {
  v_screenCoord = a_position;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const gridFragmentShader = `#version 300 es
precision highp float;

in vec2 v_screenCoord;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform vec2 u_cameraPos;
uniform float u_zoom;
uniform float u_time;

float pristineGrid(vec2 uv, vec2 lineWidth) {
  vec2 ddx = dFdx(uv);
  vec2 ddy = dFdy(uv);
  vec2 uvDeriv = vec2(length(vec2(ddx.x, ddy.x)), length(vec2(ddx.y, ddy.y)));
  vec2 targetWidth = clamp(lineWidth, uvDeriv, vec2(0.5));
  vec2 drawWidth = clamp(targetWidth, uvDeriv, vec2(0.5));
  vec2 lineAA = uvDeriv * 1.5;
  vec2 gridUV = 1.0 - abs(fract(uv) * 2.0 - 1.0);
  vec2 grid2 = smoothstep(drawWidth + lineAA, drawWidth - lineAA, gridUV);
  grid2 *= clamp(targetWidth / drawWidth, 0.0, 1.0);
  grid2 = mix(grid2, targetWidth, clamp(uvDeriv * 2.0 - 1.0, 0.0, 1.0));
  return mix(grid2.x, 1.0, grid2.y);
}

void main() {
  // Compute world position for this pixel
  vec2 screenPixel = (v_screenCoord * 0.5 + 0.5) * u_resolution;
  vec2 worldPos = u_cameraPos + (screenPixel - u_resolution * 0.5) / u_zoom;

  // Multi-tier grid spacing
  float minorSpacing = 100.0;
  float majorSpacing = 500.0;

  vec2 minorUV = worldPos / minorSpacing;
  vec2 majorUV = worldPos / majorSpacing;

  float minorLine = pristineGrid(minorUV, vec2(0.015));
  float majorLine = pristineGrid(majorUV, vec2(0.035));

  // Deep obsidian background
  vec3 bg = vec3(0.012, 0.027, 0.071); // Deep slate-void #030712

  // Subtle tactical cyan/slate grid colors
  vec3 minorColor = vec3(0.08, 0.18, 0.28);
  vec3 majorColor = vec3(0.15, 0.40, 0.58);

  // Tactical origin axes
  float axisX = smoothstep(1.5 / u_zoom, 0.0, abs(worldPos.x));
  float axisY = smoothstep(1.5 / u_zoom, 0.0, abs(worldPos.y));
  vec3 axisColor = vec3(0.2, 0.7, 0.9);

  // Tactical radar sweep pulse
  float sweep = sin(u_time * 0.8 - length(worldPos) * 0.002) * 0.5 + 0.5;
  sweep = pow(sweep, 6.0) * 0.15;

  vec3 finalColor = bg;
  finalColor = mix(finalColor, minorColor, minorLine * 0.45);
  finalColor = mix(finalColor, majorColor, majorLine * 0.85);
  finalColor = mix(finalColor, axisColor, (axisX + axisY) * 0.7);
  finalColor += vec3(0.02, 0.08, 0.15) * sweep;

  // Subtle vignette
  vec2 uv = screenPixel / u_resolution;
  float vignette = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
  vignette = clamp(pow(16.0 * vignette, 0.25), 0.0, 1.0);
  finalColor *= vignette;

  fragColor = vec4(finalColor, 1.0);
}
`;
