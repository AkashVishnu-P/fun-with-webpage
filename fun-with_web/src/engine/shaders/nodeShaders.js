/**
 * nodeShaders.js
 * High-performance instanced shader for glowing building nodes.
 * Renders sub-pixel iridescent cores, Fresnel outer glow, and tactical reticles.
 */

export const nodeVertexShader = `#version 300 es
layout(location = 0) in vec2 a_quadVertex;       // [-1, 1] quad
layout(location = 1) in vec2 a_instancePos;      // [worldX, worldY]
layout(location = 2) in vec4 a_instanceAttr;     // [radius, type, energy, pulsePhase]

uniform mat3 u_matrix;
uniform float u_time;
uniform float u_zoom;

out vec2 v_localUV;
out vec4 v_attr;
out float v_pulse;

void main() {
  float radius = a_instanceAttr.x;
  float type = a_instanceAttr.y;
  float energy = a_instanceAttr.z;
  float pulsePhase = a_instanceAttr.w;

  // Expanding halo size for outer glow
  float haloScale = radius * 3.5;

  vec2 worldVertex = a_instancePos + a_quadVertex * haloScale;
  vec3 clipPos = u_matrix * vec3(worldVertex, 1.0);

  gl_Position = vec4(clipPos.xy, 0.0, 1.0);

  v_localUV = a_quadVertex; // [-1, 1]
  v_attr = a_instanceAttr;
  v_pulse = sin(u_time * 2.5 + pulsePhase) * 0.5 + 0.5;
}
`;

export const nodeFragmentShader = `#version 300 es
precision highp float;

in vec2 v_localUV;
in vec4 v_attr;
in float v_pulse;

out vec4 fragColor;

void main() {
  float dist = length(v_localUV);
  if (dist > 1.0) {
    discard;
  }

  float radius = v_attr.x;
  float type = v_attr.y;
  float energy = v_attr.z;

  // Relative unit radii
  // Since quad is [-1, 1] with haloScale = radius * 3.5:
  float coreRadius = 1.0 / 3.5;
  float ringRadius = coreRadius * 1.35;

  // Base colors per node type
  // 0: Tactical Hub (Cyan / Bright Teal)
  // 1: Civilian Spire (Electric Violet / Blue)
  // 2: Anchor Pillar (Iridescent Emerald / Mint)
  vec3 coreColor;
  vec3 glowColor;

  if (type < 0.5) {
    coreColor = vec3(0.9, 0.98, 1.0);
    glowColor = vec3(0.15, 0.75, 1.0);
  } else if (type < 1.5) {
    coreColor = vec3(0.85, 0.9, 1.0);
    glowColor = vec3(0.45, 0.45, 0.98);
  } else {
    coreColor = vec3(0.9, 1.0, 0.95);
    glowColor = vec3(0.1, 0.9, 0.65);
  }

  // Inner solid core
  float core = smoothstep(coreRadius, coreRadius * 0.7, dist);

  // Tactical Ring Reticle
  float ring = smoothstep(0.04, 0.0, abs(dist - ringRadius));

  // Multi-tier exponential Fresnel glow
  float glow = pow(clamp(1.0 - dist, 0.0, 1.0), 3.0) * 1.5;
  glow += pow(clamp(1.0 - dist, 0.0, 1.0), 6.0) * 2.0;

  // Pulse modulation
  glow *= (0.75 + 0.35 * v_pulse);
  ring *= (0.6 + 0.4 * v_pulse);

  vec3 rgb = mix(glowColor * glow, coreColor, core);
  rgb += glowColor * ring * 1.4;

  float alpha = clamp(core + glow * 0.85 + ring * 0.9, 0.0, 1.0);

  fragColor = vec4(rgb * energy, alpha);
}
`;
