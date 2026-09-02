/**
 * avatarShaders.js
 * Custom GLSL shaders for The Apex Symbiote Avatar.
 * Features instanced articulated leg rendering, PBR chitin material,
 * thin-film interference sheen, and emissive ocular clusters.
 */

// --- 1. INSTANCED LEGS PIPELINE ---

export const avatarLegVertexShader = `#version 300 es
layout(location = 0) in vec2 a_quadVertex;   // [-1, 1] unit quad
layout(location = 1) in vec2 a_legStart;     // [startX, startY]
layout(location = 2) in vec2 a_legEnd;       // [endX, endY]
layout(location = 3) in vec2 a_radii;        // [radiusStart, radiusEnd]
layout(location = 4) in vec2 a_meta;         // [legIndex, segmentIndex]

uniform mat3 u_matrix;
uniform float u_time;
uniform float u_zoom;

out vec2 v_localUV;     // x: across [-1, 1], y: along [0, 1]
out vec2 v_meta;        // legIndex, segmentIndex
out float v_segmentLen;

void main() {
  vec2 dir = a_legEnd - a_legStart;
  float len = length(dir);
  vec2 uDir = len > 0.001 ? dir / len : vec2(0.0, 1.0);
  vec2 uNorm = vec2(-uDir.y, uDir.x);

  // Map quad Y from [-1, 1] to along-segment [0, 1]
  float t = a_quadVertex.y * 0.5 + 0.5;
  float s = a_quadVertex.x; // across segment [-1, 1]

  float radius = mix(a_radii.x, a_radii.y, t);

  // World-space vertex position
  vec2 worldPos = a_legStart + uDir * (t * len) + uNorm * (s * radius);
  vec3 clipPos = u_matrix * vec3(worldPos, 1.0);

  gl_Position = vec4(clipPos.xy, 0.0, 1.0);

  v_localUV = vec2(s, t);
  v_meta = a_meta;
  v_segmentLen = len;
}
`;

export const avatarLegFragmentShader = `#version 300 es
precision highp float;

in vec2 v_localUV;
in vec2 v_meta;
in float v_segmentLen;

uniform float u_time;

out vec4 fragColor;

void main() {
  float s = v_localUV.x; // across [-1, 1]
  float t = v_localUV.y; // along [0, 1]

  if (abs(s) > 1.0) discard;

  // Reconstruct 3D cylinder normal
  float nz = sqrt(max(0.0, 1.0 - s * s));
  vec3 normal = normalize(vec3(s, 0.0, nz));

  // Light direction (overhead tactical key light + rim fill)
  vec3 lightDir = normalize(vec3(0.3, 0.5, 0.8));
  float NdotL = clamp(dot(normal, lightDir), 0.0, 1.0);

  // Deep obsidian chitin base
  vec3 chitinBase = vec3(0.02, 0.04, 0.08);

  // Thin-film interference shimmer (iridescent violet & toxic emerald on glancing angle)
  float fresnel = pow(1.0 - nz, 2.5);
  vec3 sheenViolet = vec3(0.45, 0.15, 0.65);
  vec3 sheenCyan = vec3(0.12, 0.65, 0.95);
  vec3 thinFilmSheen = mix(sheenViolet, sheenCyan, sin(v_meta.x * 0.8 + t * 4.0) * 0.5 + 0.5);

  // Specular chitin ridge reflection along cylinder spine
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfVec = normalize(lightDir + viewDir);
  float spec = pow(max(0.0, dot(normal, halfVec)), 28.0) * 0.9;

  // Joint articulation ridges
  float jointBand = smoothstep(0.08, 0.0, t) + smoothstep(0.92, 1.0, t);
  float ridgePattern = sin(t * 24.0) * 0.08;

  // Composite Chitin Material
  vec3 rgb = chitinBase * (0.4 + 0.6 * NdotL + ridgePattern);
  rgb += thinFilmSheen * (fresnel * 0.85);
  rgb += vec3(0.7, 0.9, 1.0) * spec;
  rgb += vec3(0.1, 0.3, 0.5) * jointBand;

  // Subsurface edge glow
  float alpha = smoothstep(1.0, 0.85, abs(s));

  fragColor = vec4(rgb, alpha);
}
`;

// --- 2. CARAPACE & BODY PIPELINE ---

export const avatarBodyVertexShader = `#version 300 es
layout(location = 0) in vec2 a_quadVertex;   // [-1, 1] unit quad
layout(location = 1) in vec2 a_bodyPos;      // [x, y]
layout(location = 2) in vec2 a_bodyRadius;   // [rx, ry]
layout(location = 3) in float a_bodyRot;     // rotation angle (heading)
layout(location = 4) in vec3 a_bodyMeta;     // [type, pulse, index]

uniform mat3 u_matrix;
uniform float u_time;
uniform float u_zoom;

out vec2 v_localUV;
out vec3 v_bodyMeta;

void main() {
  float cosR = cos(a_bodyRot);
  float sinR = sin(a_bodyRot);

  // Scale and rotate quad in local space
  vec2 scaled = a_quadVertex * a_bodyRadius;
  vec2 rotated = vec2(
    scaled.x * cosR - scaled.y * sinR,
    scaled.x * sinR + scaled.y * cosR
  );

  vec2 worldPos = a_bodyPos + rotated;
  vec3 clipPos = u_matrix * vec3(worldPos, 1.0);

  gl_Position = vec4(clipPos.xy, 0.0, 1.0);

  v_localUV = a_quadVertex; // [-1, 1]
  v_bodyMeta = a_bodyMeta;
}
`;

export const avatarBodyFragmentShader = `#version 300 es
precision highp float;

in vec2 v_localUV;
in vec3 v_bodyMeta;

uniform float u_time;

out vec4 fragColor;

void main() {
  float distSq = dot(v_localUV, v_localUV);
  if (distSq > 1.0) discard;

  float type = v_bodyMeta.x; // 0: Cephalothorax, 1: Abdomen, 2: Mandibles
  float pulse = v_bodyMeta.y;

  // Reconstruct 3D hemisphere normal
  float nz = sqrt(max(0.0, 1.0 - distSq));
  vec3 normal = normalize(vec3(v_localUV.x, v_localUV.y, nz));

  // Lighting
  vec3 lightDir = normalize(vec3(0.2, 0.4, 0.9));
  float NdotL = clamp(dot(normal, lightDir), 0.0, 1.0);

  // Obsidian Chitin Base
  vec3 chitin = vec3(0.015, 0.03, 0.06) * (0.3 + 0.7 * NdotL);

  // Thin-film iridescent sheen
  float fresnel = pow(1.0 - nz, 2.8);
  vec3 sheen = mix(vec3(0.5, 0.1, 0.7), vec3(0.1, 0.8, 0.6), sin(v_localUV.y * 3.0 + u_time) * 0.5 + 0.5);
  chitin += sheen * (fresnel * 0.9);

  // Specular Carapace Highlight
  vec3 halfVec = normalize(lightDir + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(0.0, dot(normal, halfVec)), 32.0);
  chitin += vec3(0.8, 0.95, 1.0) * spec * 0.9;

  // Bio-veins on Abdomen
  if (type > 0.5 && type < 1.5) {
    float vein = sin(v_localUV.y * 18.0) * cos(v_localUV.x * 12.0);
    float veinIntensity = smoothstep(0.65, 0.95, vein) * (0.6 + 0.4 * sin(u_time * 3.0));
    chitin += vec3(0.15, 0.6, 0.95) * veinIntensity;
  }

  // Glowing 8-Eye Cluster on Cephalothorax
  if (type < 0.5) {
    // 8 arachnid eyes positioned on front ridge of cephalothorax
    // Normalized coords: front is along -Y or +Y depending on orientation
    vec2 eyeUV = v_localUV;
    
    // Principal Median Eyes (2 large central)
    float d1 = length(eyeUV - vec2(-0.22, 0.55));
    float d2 = length(eyeUV - vec2(0.22, 0.55));
    float eye1 = smoothstep(0.10, 0.02, d1) + smoothstep(0.10, 0.02, d2);

    // Lateral Eyes (4 outer)
    float d3 = length(eyeUV - vec2(-0.42, 0.42));
    float d4 = length(eyeUV - vec2(0.42, 0.42));
    float d5 = length(eyeUV - vec2(-0.55, 0.25));
    float d6 = length(eyeUV - vec2(0.55, 0.25));
    float eye2 = smoothstep(0.07, 0.01, d3) + smoothstep(0.07, 0.01, d4) +
                 smoothstep(0.06, 0.01, d5) + smoothstep(0.06, 0.01, d6);

    // Posterior Eyes (2 secondary)
    float d7 = length(eyeUV - vec2(-0.25, 0.30));
    float d8 = length(eyeUV - vec2(0.25, 0.30));
    float eye3 = smoothstep(0.06, 0.01, d7) + smoothstep(0.06, 0.01, d8);

    float totalEye = eye1 * 1.5 + eye2 * 1.2 + eye3 * 1.0;
    vec3 eyeColor = vec3(0.2, 0.9, 1.0); // Electric Cyan Bioluminescence
    chitin += eyeColor * totalEye * 2.2;
  }

  float alpha = smoothstep(1.0, 0.94, sqrt(distSq));
  fragColor = vec4(chitin, alpha);
}
`;
