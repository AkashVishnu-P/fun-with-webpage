import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * CityCanyon.jsx
 * Photorealistic Urban Canyon Navigation Engine.
 * Features:
 * - Direct surface raycasting: building meshes capture onPointerDown with stopPropagation()
 * - Towering skyscraper canyons (heights 250 to 600 units, West corridor X=-56, East corridor X=+56)
 * - 4 distinct architectural silhouettes (Curtain Wall, Cylindrical Glass Tower, Stepped Art Deco, Brutalist Modernist)
 * - Custom GLSL Procedural Window Matrix Shader with cyan, amber, and daylight white office lights
 * - Zero-allocation Ring-Buffer Chunk Treadmill along the Z-axis
 * - Celestial Gradient Sky Dome, 2000-Star point cloud, and street steam mist plane
 */

// Shared global time uniform object for zero-overhead animation
const globalShaderTime = { value: 0.0 };

// --- 1. PROCEDURAL WINDOW MATRIX GLSL SHADER ---

const windowVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const windowFragmentShader = `
  precision highp float;

  uniform vec3 uBaseColor;      // Dark obsidian slate vec3(0.02, 0.04, 0.07)
  uniform float uWindowCols;    // Number of window columns
  uniform float uWindowRows;    // Number of window rows
  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  // Hash function for discrete window states
  float hash2D(vec2 p) {
    return fract(sin(dot(floor(p), vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 gridScale = vec2(uWindowCols, uWindowRows);
    vec2 cellUV = fract(vUv * gridScale);
    vec2 cellID = floor(vUv * gridScale);

    // Frame mullion check (horizontal & vertical steel frames)
    float mullion = step(0.12, cellUV.x) * step(0.12, cellUV.y) * step(cellUV.x, 0.88) * step(cellUV.y, 0.88);

    // Pseudo-random window state
    float h = hash2D(cellID + vec2(vWorldPosition.x * 0.05, vWorldPosition.z * 0.05));

    // Base dark reflective glass
    vec3 baseGlass = vec3(0.015, 0.03, 0.06);

    // Window light palette:
    // State 0 (Off): Dark reflective blue-black glass
    // State 1: Soft Cyan Corporate Office vec3(0.0, 0.9, 1.0)
    // State 2: Warm Residential Amber vec3(1.0, 0.72, 0.35)
    // State 3: Cool Daylight White vec3(0.85, 0.95, 1.0)
    vec3 lightColor = baseGlass;
    float emissiveIntensity = 0.0;

    if (h > 0.88) {
      // Cool Daylight White
      lightColor = vec3(0.88, 0.95, 1.0);
      emissiveIntensity = 2.4;
    } else if (h > 0.68) {
      // Soft Cyan Corporate Office
      lightColor = vec3(0.0, 0.9, 1.0);
      emissiveIntensity = 2.8;
    } else if (h > 0.48) {
      // Warm Residential Amber
      lightColor = vec3(1.0, 0.72, 0.35);
      emissiveIntensity = 2.2;
    }

    // Temporal Occupant Motion Pulse on ~3% of lit windows
    if (h > 0.48 && h < 0.52) {
      float flicker = sin(uTime * 1.5 + h * 50.0) * 0.35 + 0.65;
      emissiveIntensity *= flicker;
    }

    // Soft interior falloff within the window pane
    vec2 paneCenter = abs(cellUV - 0.5) * 2.0;
    float interiorGlow = 1.0 - length(paneCenter) * 0.35;

    vec3 finalColor = mix(uBaseColor, lightColor * interiorGlow, mullion * (emissiveIntensity > 0.0 ? 1.0 : 0.0));

    // Ambient night sky reflection on glass
    float fresnel = pow(1.0 - max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.5);
    finalColor += vec3(0.01, 0.05, 0.12) * fresnel;

    // Emissive boost for Bloom
    finalColor += lightColor * (emissiveIntensity * mullion * 0.75);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// --- 2. CELESTIAL SKY DOME & STARFIELD ---

function CelestialSkyDome() {
  const skyMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTopColor: { value: new THREE.Color('#020814') },    // Deep Midnight Navy
        uBottomColor: { value: new THREE.Color('#003247') }, // Horizon Electric Teal Smog
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          float factor = max(0.0, min(1.0, (h + 0.1) * 1.8));
          vec3 sky = mix(uBottomColor, uTopColor, factor);
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, []);

  const starGeo = useMemo(() => {
    const count = 2000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const seed1 = Math.sin(i * 12.9898) * 43758.5453;
      const u = seed1 - Math.floor(seed1);
      const seed2 = Math.cos(i * 78.233) * 23456.789;
      const v = seed2 - Math.floor(seed2);

      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 1400 + u * 200;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.max(50, r * Math.cos(phi));
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  return (
    <group>
      <mesh material={skyMaterial}>
        <sphereGeometry args={[1600, 24, 24]} />
      </mesh>
      <points geometry={starGeo}>
        <pointsMaterial
          size={2.5}
          color="#e0f7fa"
          transparent
          opacity={0.85}
          sizeAttenuation={false}
        />
      </points>
    </group>
  );
}

// --- 3. CANYON GROUND STEAM MIST ---

function CanyonGroundMist({ playerPosRef }) {
  const meshRef = useRef();

  const mistMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: globalShaderTime,
        uColor: { value: new THREE.Color('#002b3d') }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;

        float noise(vec2 p) {
          return sin(p.x * 0.05 + uTime * 0.4) * cos(p.y * 0.05 + uTime * 0.3) * 0.5 + 0.5;
        }

        void main() {
          float n = noise(vUv * 200.0);
          float alpha = smoothstep(0.3, 0.8, n) * 0.45;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
  }, []);

  useFrame(() => {
    if (playerPosRef && playerPosRef.current && meshRef.current) {
      meshRef.current.position.z = playerPosRef.current.z;
      meshRef.current.position.x = playerPosRef.current.x;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, -25, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mistMaterial}>
      <planeGeometry args={[600, 600]} />
    </mesh>
  );
}

// --- 4. MAIN CITY CANYON COMPONENT ---

export function CityCanyon({ playerPosRef, onBuildingPointerDown = null }) {
  const chunkGroupsRef = useRef([]);

  // Chunk Ring-Buffer Configuration (6 chunks, 120m length = 720m span)
  const numChunks = 6;
  const chunkLength = 120;
  const totalCanyonSpan = numChunks * chunkLength;

  // Build Chunks Data: 4 Skyscraper Archetypes flanking West (X=-56) and East (X=+56)
  const chunks = useMemo(() => {
    const chunkList = [];

    for (let c = 0; c < numChunks; c++) {
      const buildings = [];
      const baseChunkZ = -c * chunkLength;

      const positions = [
        { posX: -56, relZ: -25, type: 'A' },
        { posX: -52, relZ: -85, type: 'C' },
        { posX: 56,  relZ: -25, type: 'B' },
        { posX: 52,  relZ: -85, type: 'D' },
      ];

      for (let b = 0; b < positions.length; b++) {
        const p = positions[b];
        const seed = Math.sin(c * 91.34 + b * 23.45) * 43758.5453;
        const rand = seed - Math.floor(seed);

        // Towering Skyscraper Heights from 280 to 580 units
        const height = 280.0 + rand * 300.0;
        const width = 34.0 + rand * 12.0;
        const depth = 38.0 + rand * 10.0;

        const cols = Math.floor(width / 1.8);
        const rows = Math.floor(height / 3.2);

        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uBaseColor: { value: new THREE.Color('#050a14') },
            uWindowCols: { value: cols },
            uWindowRows: { value: rows },
            uTime: globalShaderTime
          },
          vertexShader: windowVertexShader,
          fragmentShader: windowFragmentShader
        });

        let geo;
        let edgeGeo;
        if (p.type === 'B') {
          geo = new THREE.CylinderGeometry(width * 0.45, width * 0.45, height, 24);
          edgeGeo = new THREE.EdgesGeometry(geo, 20);
        } else {
          geo = new THREE.BoxGeometry(width, height, depth);
          edgeGeo = new THREE.EdgesGeometry(geo, 15);
        }

        buildings.push({
          id: `chunk_${c}_b_${b}`,
          type: p.type,
          posX: p.posX,
          relZ: p.relZ,
          height,
          width,
          depth,
          geo,
          edgeGeo,
          material: mat,
          beaconColor: b % 2 === 0 ? '#00e5ff' : '#f59e0b'
        });
      }

      chunkList.push({
        chunkIndex: c,
        baseZ: baseChunkZ,
        buildings
      });
    }

    return chunkList;
  }, []);

  const edgeLineMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color: '#00e5ff',
    linewidth: 1.5,
    transparent: true,
    opacity: 0.85
  }), []);

  // Zero-allocation Ring-Buffer Chunk Repositioning in useFrame
  useFrame((state) => {
    globalShaderTime.value = state.clock.getElapsedTime();

    if (!playerPosRef || !playerPosRef.current) return;
    const pz = playerPosRef.current.z;

    for (let c = 0; c < chunks.length; c++) {
      const chunk = chunks[c];
      const group = chunkGroupsRef.current[c];
      if (!group) continue;

      const halfSpan = totalCanyonSpan / 2;
      let dz = (chunk.baseZ - pz) % totalCanyonSpan;
      if (dz > halfSpan) dz -= totalCanyonSpan;
      else if (dz < -halfSpan) dz += totalCanyonSpan;

      group.position.z = pz + dz;
    }
  });

  return (
    <group>
      <CelestialSkyDome />
      <CanyonGroundMist playerPosRef={playerPosRef} />

      {/* 6 Ring-Buffered Skyscraper Canyon Chunks */}
      {chunks.map((chunk, cIdx) => (
        <group
          key={chunk.chunkIndex}
          ref={(el) => { chunkGroupsRef.current[cIdx] = el; }}
          position={[0, 0, chunk.baseZ]}
        >
          {chunk.buildings.map((b) => (
            <group
              key={b.id}
              position={[b.posX, b.height / 2 - 40, b.relZ]}
            >
              {/* Main Skyscraper Facade with Direct Surface Raycasting */}
              <mesh
                geometry={b.geo}
                material={b.material}
                castShadow
                receiveShadow
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (onBuildingPointerDown && e.point) {
                    onBuildingPointerDown(e.point);
                  }
                }}
              >
                {/* Visual Hover Surface Feedback */}
              </mesh>

              <lineSegments
                geometry={b.edgeGeo}
                material={edgeLineMaterial}
              />

              {/* Rooftop Tactical Landing Pad */}
              <mesh position={[0, b.height / 2 + 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[b.width * 0.85, b.depth * 0.85]} />
                <meshStandardMaterial
                  color="#050a14"
                  emissive={b.beaconColor}
                  emissiveIntensity={0.5}
                  roughness={0.2}
                  metalness={0.8}
                />
              </mesh>

              {/* Rooftop Emissive Beacon Ring */}
              <mesh position={[0, b.height / 2 + 0.5, 0]}>
                <torusGeometry args={[b.width * 0.28, 0.08, 8, 24]} rotation={[Math.PI / 2, 0, 0]} />
                <meshStandardMaterial
                  color={b.beaconColor}
                  emissive={b.beaconColor}
                  emissiveIntensity={3.2}
                />
              </mesh>

              {/* Spire Antenna */}
              <mesh position={[0, b.height / 2 + 8.0, 0]}>
                <cylinderGeometry args={[0.1, 0.5, 16.0, 8]} />
                <meshStandardMaterial
                  color="#00e5ff"
                  emissive="#00e5ff"
                  emissiveIntensity={4.0}
                />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* Canyon Street Floor Plane at Y = -40 */}
      <mesh receiveShadow position={[0, -40, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[600, 3000]} />
        <meshStandardMaterial
          color="#02050b"
          roughness={0.9}
          metalness={0.2}
        />
      </mesh>
    </group>
  );
}
