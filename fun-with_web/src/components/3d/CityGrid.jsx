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
// GLSL Procedural Window Matrix Shader
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
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNorm;

  float hash(vec2 p) {
    return fract(sin(dot(floor(p), vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 scale = vec2(uCols, uRows);
    vec2 cell  = fract(vUv * scale);
    float frame = step(0.11, cell.x) * step(0.11, cell.y) *
                  step(cell.x, 0.89) * step(cell.y, 0.89);

    float h = hash(floor(vUv * scale) + vWorldPos.xz * 0.04);

    vec3 lit = vec3(0.015, 0.028, 0.055); // dark glass default
    float ei  = 0.0;

    if (h > 0.87) { lit = vec3(0.87, 0.94, 1.0);  ei = 2.4; } // cool white
    else if (h > 0.67) { lit = vec3(0.0,  0.9,  1.0); ei = 2.9; } // cyan
    else if (h > 0.46) { lit = vec3(1.0,  0.72, 0.35); ei = 2.2; } // amber

    // ~3 pct temporal flicker
    if (h > 0.46 && h < 0.50) {
      ei *= (sin(uTime * 2.1 + h * 48.0) * 0.35 + 0.65);
    }

    float falloff = 1.0 - length(abs(cell - 0.5) * 2.0) * 0.35;
    vec3 color = mix(uBase, lit * falloff, frame * step(0.01, ei));
    color += lit * (ei * frame * 0.72);
    color += vec3(0.01, 0.05, 0.12) * pow(1.0 - max(0.0, dot(vNorm, vec3(0.0, 0.0, 1.0))), 2.6);

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

      // Vary height 180–450; leave very tall spires on corners
      const isCorner = (gx === 0 || gx === GRID - 1) && (gz === 0 || gz === GRID - 1);
      const height = isCorner ? 380 + r1 * 70 : 180 + r1 * 270;
      const width  = 20 + r2 * 16;     // 20–36
      const depth  = 20 + r1 * 14;     // 20–34

      const baseX = (gx - GRID / 2 + 0.5) * BLOCK_SIZE;
      const baseZ = (gz - GRID / 2 + 0.5) * BLOCK_SIZE;

      const cols = Math.floor(width / 1.9);
      const rows = Math.floor(height / 3.4);

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
          uTime: gTime,
        },
        vertexShader: WIN_VERT,
        fragmentShader: WIN_FRAG,
      });

      // Beacon color: alternate cyan / amber / violet
      const beaconColors = ['#00e5ff', '#f59e0b', '#a855f7'];
      const bColor = beaconColors[(gx * GRID + gz) % 3];

      list.push({
        idx: gx * GRID + gz, gx, gz,
        baseX, baseZ, height, width, depth,
        type, geo, edgeGeo, mat, bColor,
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

  const edgeMat   = useMemo(() => new THREE.LineBasicMaterial({
    color: '#00e5ff', transparent: true, opacity: 0.8,
  }), []);

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
                onBuildingPointerDown(e.point);
              }
            }}
          />

          {/* Neon edge glow */}
          <lineSegments geometry={b.edgeGeo} material={edgeMat} />

          {/* Rooftop landing pad */}
          <mesh position={[0, b.height / 2 + 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[b.width * 0.82, b.depth * 0.82]} />
            <meshStandardMaterial
              color="#060c1a" emissive={b.bColor}
              emissiveIntensity={0.55} roughness={0.2} metalness={0.8}
            />
          </mesh>

          {/* Beacon ring */}
          <mesh position={[0, b.height / 2 + 0.4, 0]}>
            <torusGeometry args={[b.width * 0.26, 0.07, 8, 22]} rotation={[Math.PI / 2, 0, 0]} />
            <meshStandardMaterial color={b.bColor} emissive={b.bColor} emissiveIntensity={3.0} />
          </mesh>

          {/* Spire */}
          <mesh position={[0, b.height / 2 + 6, 0]}>
            <cylinderGeometry args={[0.08, 0.45, 12, 6]} />
            <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={3.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
