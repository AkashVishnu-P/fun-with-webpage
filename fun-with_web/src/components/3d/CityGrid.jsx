import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cityColliders } from './cityColliders.js';

/**
 * CityGrid.jsx
 * Infinite 2D Toroidal Chunk Grid with AABB Wall Collision.
 *
 * - 8x8 block matrix (64 skyscrapers) wrapping around the player in both X and Z
 * - Each block has a deterministic height (180–450 units) and width (20–36 units)
 * - Street avenues left by spacing: BLOCK_SIZE = 52, BUILDING_SIZE ~28-36 => 8-24m alleys
 * - useFrame: modulo chunk repositioning on both axes, globalShaderTime update
 * - AABB collision response exposed via cityColliders export
 * - Procedural window GLSL shader (single shared time uniform)
 */

// Module-level time uniform shared by ALL building shader materials (zero allocations)
const gTime = { value: 0.0 };

// ---------------------------------------------------------------------------
// GLSL Procedural Window Matrix Shader with Per-Building Color Themes
// ---------------------------------------------------------------------------
const WIN_VERT = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNorm;
  void main() {
    vUv = uv;
    vNorm = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const WIN_FRAG = `
  precision highp float;
  uniform vec3 uBase;
  uniform float uCols;
  uniform float uRows;
  uniform float uTime;
  uniform float uThemeId; // 0.0 = Light Blue, 1.0 = Light Red, 2.0 = Mixed Cyberpunk
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNorm;

  float hash(vec2 p) {
    return fract(sin(dot(floor(p), vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    // 1. Calculate the Window Grid (Mullions)
    vec2 scale = vec2(uCols, uRows);
    vec2 cell  = fract(vUv * scale);
    float frame = step(0.12, cell.x) * step(0.12, cell.y) *
                  step(cell.x, 0.88) * step(cell.y, 0.88);

    // 2. Generate random cell hash
    float h = hash(floor(vUv * scale) + vWorldPos.xz * 0.04);

    // 55% of windows are illuminated
    float isLit = step(0.45, h);

    vec3 windowColor = vec3(0.0);

    // 3. APPLY PER-BUILDING COLOR THEMES
    if (uThemeId < 0.5) {
      // THEME 0: LIGHT BLUE / NEON CYAN BUILDING
      vec3 colorA = vec3(0.0, 0.85, 1.0); // Neon Cyan
      vec3 colorB = vec3(0.65, 0.92, 1.0); // Pale Ice Blue
      windowColor = mix(colorA, colorB, step(0.5, fract(h * 13.0)));
    } else if (uThemeId < 1.5) {
      // THEME 1: LIGHT RED / CRIMSON BUILDING
      vec3 colorA = vec3(1.0, 0.12, 0.22); // Bright Crimson
      vec3 colorB = vec3(1.0, 0.45, 0.35); // Coral Ember
      windowColor = mix(colorA, colorB, step(0.5, fract(h * 17.0)));
    } else {
      // THEME 2: MIXED CYBERPUNK / GOLD & PURPLE BUILDING
      vec3 colorA = vec3(1.0, 0.78, 0.15); // Amber / Gold
      vec3 colorB = vec3(0.85, 0.15, 1.0); // Purple / Magenta
      windowColor = mix(colorA, colorB, step(0.5, fract(h * 23.0)));
    }

    // Temporal micro-flicker on ~4% of windows
    if (h > 0.45 && h < 0.49) {
      isLit *= (sin(uTime * 3.5 + h * 60.0) * 0.4 + 0.6);
    }

    // Glow falloff from window center
    float falloff = 1.0 - length(abs(cell - 0.5) * 2.0) * 0.3;

    // Glowing edge detection in shader
    float edgeX = step(0.015, vUv.x) * step(vUv.x, 0.985);
    float edgeY = step(0.008, vUv.y) * step(vUv.y, 0.992);
    float isEdge = 1.0 - (edgeX * edgeY);

    // Composite final pixel
    vec3 color = mix(uBase, windowColor * 1.8 * falloff, frame * isLit);
    color = mix(color, windowColor * 2.2, isEdge); // Glowing building edge accent
    color += vec3(0.01, 0.03, 0.06) * pow(1.0 - max(0.0, dot(vNorm, vec3(0.0, 0.0, 1.0))), 2.5);

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ---------------------------------------------------------------------------
// Sky Dome (gradient + 2 000 stars, deterministic)
// ---------------------------------------------------------------------------
function SkyDome() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color('#020814') },
      uBot: { value: new THREE.Color('#002a3f') },
    },
    vertexShader: `
      varying vec3 vWP;
      void main() {
        vWP = (modelMatrix * vec4(position,1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.0);
      }`,
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uBot; varying vec3 vWP;
      void main() {
        float t = max(0.0, min(1.0, (normalize(vWP).y + 0.12) * 1.75));
        gl_FragColor = vec4(mix(uBot, uTop, t), 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  }), []);

  const stars = useMemo(() => {
    const n = 2000; const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const s1 = Math.sin(i * 12.9898) * 43758.5453; const u = s1 - Math.floor(s1);
      const s2 = Math.cos(i * 78.233) * 23456.789;   const v = s2 - Math.floor(s2);
      const th = u * 6.2832; const ph = Math.acos(2 * v - 1); const r = 1450 + u * 150;
      pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
      pos[i*3+1] = Math.max(40, r * Math.cos(ph));
      pos[i*3+2] = r * Math.sin(ph) * Math.sin(th);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  return (
    <group>
      <mesh material={mat}><sphereGeometry args={[1600, 20, 20]} /></mesh>
      <points geometry={stars}>
        <pointsMaterial size={2.8} color="#d0f4f8" transparent opacity={0.8} sizeAttenuation={false} />
      </points>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Main CityGrid Component
// ---------------------------------------------------------------------------
const GRID       = 8;       // 8x8 grid => 64 buildings
const BLOCK_SIZE = 52;      // spacing between building centres
const TOTAL_SPAN = GRID * BLOCK_SIZE; // 416 units loop span

/** Build deterministic descriptors for one full 8x8 grid */
function buildGridData() {
  const list = [];
  for (let gx = 0; gx < GRID; gx++) {
    for (let gz = 0; gz < GRID; gz++) {
      const s1 = Math.sin(gx * 13.452 + gz * 78.123) * 43758.5453;
      const r1 = s1 - Math.floor(s1);
      const s2 = Math.cos(gx * 31.267 + gz * 17.891) * 23456.789;
      const r2 = s2 - Math.floor(s2);

      // Elevation Nerf: Scaled down building heights: Min 60, Max 140
      const isCorner = (gx === 0 || gx === GRID - 1) && (gz === 0 || gz === GRID - 1);
      const height = isCorner ? 100 + r1 * 30 : 60 + r1 * 50; // 60 to 140 units
      const width  = 20 + r2 * 12;     // 20–32
      const depth  = 20 + r1 * 12;     // 20–32

      const baseX = (gx - GRID / 2 + 0.5) * BLOCK_SIZE;
      const baseZ = (gz - GRID / 2 + 0.5) * BLOCK_SIZE;

      const cols = Math.floor(width / 1.9);
      const rows = Math.floor(height / 3.4);

      // Theme ID assignment (0 = Light Blue, 1 = Light Red, 2 = Mixed Cyberpunk)
      const themeId = Math.floor(r2 * 3); // 0, 1, or 2

      // Alternate building types by sum parity
      const type = (gx + gz) % 3; // 0=box, 1=cylinder, 2=box-stepped

      const geo = type === 1
        ? new THREE.CylinderGeometry(width * 0.44, width * 0.44, height, 20)
        : new THREE.BoxGeometry(width, height, depth);
      const edgeGeo = new THREE.EdgesGeometry(geo, type === 1 ? 20 : 14);

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uBase: { value: new THREE.Color('#050a14') },
          uCols: { value: cols },
          uRows: { value: rows },
          uThemeId: { value: themeId },
          uTime: gTime,
        },
        vertexShader: WIN_VERT,
        fragmentShader: WIN_FRAG,
      });

      // Beacon color: matching theme color
      const beaconColors = ['#00e5ff', '#ff1744', '#a855f7'];
      const bColor = beaconColors[themeId];

      list.push({
        idx: gx * GRID + gz, gx, gz,
        baseX, baseZ, height, width, depth,
        type, geo, edgeGeo, mat, bColor,
        themeId,
        // AABB half-extents for collision (cylinder approximated as box)
        hx: width  * 0.5 + 0.5,
        hz: depth  * 0.5 + 0.5,
      });
    }
  }
  return list;
}

export function CityGrid({ playerPosRef, onBuildingPointerDown = null }) {
  const groupRefs = useRef([]);
  const data      = useMemo(() => buildGridData(), []);

  // Theme edge materials matching each building's neon glow
  const themeEdgeMats = useMemo(() => [
    new THREE.LineBasicMaterial({ color: '#00e5ff', transparent: true, opacity: 0.85 }), // Light Blue
    new THREE.LineBasicMaterial({ color: '#ff1744', transparent: true, opacity: 0.85 }), // Light Red
    new THREE.LineBasicMaterial({ color: '#c084fc', transparent: true, opacity: 0.85 }), // Mixed Cyberpunk
  ], []);

  // Ground grid stays parented to player XZ (snapped)
  const groundRef = useRef();

  useFrame((state) => {
    gTime.value = state.clock.getElapsedTime();

    if (!playerPosRef?.current) return;
    const { x: px, z: pz } = playerPosRef.current;
    const half = TOTAL_SPAN / 2;

    // Snap ground plane under player
    if (groundRef.current) {
      groundRef.current.position.set(
        Math.floor(px / 40) * 40,
        0.02,
        Math.floor(pz / 40) * 40
      );
    }

    // Rebuild collider list each frame (cheap for 64 entries)
    cityColliders.length = 0;

    for (let i = 0; i < data.length; i++) {
      const b   = data[i];
      const grp = groupRefs.current[i];
      if (!grp) continue;

      // Modulo wrap X
      let dx = (b.baseX - px) % TOTAL_SPAN;
      if (dx >  half) dx -= TOTAL_SPAN;
      else if (dx < -half) dx += TOTAL_SPAN;

      // Modulo wrap Z
      let dz = (b.baseZ - pz) % TOTAL_SPAN;
      if (dz >  half) dz -= TOTAL_SPAN;
      else if (dz < -half) dz += TOTAL_SPAN;

      const wx = px + dx;
      const wz = pz + dz;
      grp.position.set(wx, b.height / 2, wz);

      // Expose AABB (world-space min/max on X and Z; Y handled separately)
      cityColliders.push({
        minX: wx - b.hx, maxX: wx + b.hx,
        minZ: wz - b.hz, maxZ: wz + b.hz,
        height: b.height,
        cx: wx, cz: wz,
      });
    }
  });

  return (
    <group>
      <SkyDome />

      {/* Ground plane tracked to player */}
      <mesh ref={groundRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2400, 2400]} />
        <meshStandardMaterial color="#02050b" roughness={0.9} metalness={0.15} />
      </mesh>

      {/* Persistent glowing street grid */}
      <gridHelper args={[2400, 120, '#00e5ff', '#002244']} position={[0, 0.06, 0]} />

      {/* 64 Infinite-Wrapping Skyscrapers */}
      {data.map((b, i) => (
        <group
          key={b.idx}
          ref={(el) => { groupRefs.current[i] = el; }}
          position={[b.baseX, b.height / 2, b.baseZ]}
        >
          {/* Main facade with procedural window shader + direct raycast */}
          <mesh
            geometry={b.geo}
            material={b.mat}
            castShadow
            receiveShadow
            onPointerDown={(e) => {
              e.stopPropagation();
              if (onBuildingPointerDown && e.point) {
                // Forward clientX/clientY so WebSlingerCanvas drag-start is accurate
                onBuildingPointerDown(e.point, e.clientX ?? e.nativeEvent?.clientX ?? 0, e.clientY ?? e.nativeEvent?.clientY ?? 0);
              }
            }}
          />

          {/* Neon edge glow matching building color theme */}
          <lineSegments geometry={b.edgeGeo} material={themeEdgeMats[b.themeId ?? 0]} />

          {/* Rooftop standing pad & landing zone */}
          <mesh
            position={[0, b.height / 2 + 0.08, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (onBuildingPointerDown && e.point) {
                onBuildingPointerDown(e.point, e.clientX ?? e.nativeEvent?.clientX ?? 0, e.clientY ?? e.nativeEvent?.clientY ?? 0);
              }
            }}
          >
            <planeGeometry args={[b.width * 0.86, b.depth * 0.86]} />
            <meshStandardMaterial
              color="#070e1c"
              emissive={b.bColor}
              emissiveIntensity={0.65}
              roughness={0.2}
              metalness={0.8}
            />
          </mesh>

          {/* Central Rooftop Standing Target Point */}
          <group position={[0, b.height / 2 + 0.15, 0]}>
            {/* Outer Target Ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[2.2, 2.7, 32]} />
              <meshBasicMaterial color={b.bColor} side={THREE.DoubleSide} transparent opacity={0.9} />
            </mesh>
            {/* Inner Stand Point Beacon Disk */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[1.2, 32]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive={b.bColor}
                emissiveIntensity={2.5}
                roughness={0.1}
              />
            </mesh>
            {/* Vertical Hologram Column Marker */}
            <mesh position={[0, 1.2, 0]}>
              <cylinderGeometry args={[0.08, 0.4, 2.4, 16, 1, true]} />
              <meshBasicMaterial
                color={b.bColor}
                transparent
                opacity={0.35}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>

          {/* Beacon ring */}
          <mesh position={[0, b.height / 2 + 0.4, 0]}>
            <torusGeometry args={[b.width * 0.26, 0.07, 8, 22]} rotation={[Math.PI / 2, 0, 0]} />
            <meshStandardMaterial color={b.bColor} emissive={b.bColor} emissiveIntensity={3.0} />
          </mesh>

          {/* Spire */}
          <mesh position={[0, b.height / 2 + 6, 0]}>
            <cylinderGeometry args={[0.08, 0.45, 12, 6]} />
            <meshStandardMaterial color={b.bColor} emissive={b.bColor} emissiveIntensity={3.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
