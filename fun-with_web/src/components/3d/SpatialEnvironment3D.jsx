import React, { useMemo } from 'react';

/**
 * SpatialEnvironment3D.jsx
 * Procedurally generated 3D tactical city environment with glowing building nodes,
 * landing rooftops, and a shadow-receiving tactical coordinate plane.
 */
export function SpatialEnvironment3D() {
  // Deterministic 3D Building Nodes
  const buildings = useMemo(() => {
    const list = [];
    const gridSize = 10;
    const spacing = 4.5;

    for (let x = -gridSize; x <= gridSize; x++) {
      for (let z = -gridSize; z <= gridSize; z++) {
        // Skip central origin area where Spider-Man is initially crouched
        if (Math.abs(x) < 2 && Math.abs(z) < 2) continue;

        // Deterministic pseudo-random height & type
        const seed = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
        const rand = seed - Math.floor(seed);

        const height = 3.0 + rand * 8.0;
        const width = 1.6 + (rand * 0.8);
        const depth = 1.6 + (rand * 0.8);
        const posX = x * spacing + (rand - 0.5) * 1.5;
        const posZ = z * spacing + (rand - 0.5) * 1.5;
        const posY = height / 2 - 2.5;

        const type = rand > 0.7 ? 0 : (rand > 0.35 ? 1 : 2); // 0: Tactical Hub, 1: Spire, 2: Pillar

        list.push({
          id: `${x}_${z}`,
          pos: [posX, posY, posZ],
          size: [width, height, depth],
          topY: posY + height / 2,
          type,
          color: type === 0 ? '#38bdf8' : (type === 1 ? '#818cf8' : '#34d399')
        });
      }
    }
    return list;
  }, []);

  return (
    <group>
      {/* 3D Infinite Tactical Ground Plane (Receives Soft Shadows) */}
      <mesh receiveShadow position={[0, -2.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial
          color="#030712"
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>

      {/* Grid Lines Helper */}
      <gridHelper
        args={[200, 80, '#0284c7', '#0f172a']}
        position={[0, -2.48, 0]}
      />

      {/* 3D Skyscraper Building Nodes */}
      {buildings.map((b) => (
        <group key={b.id} position={b.pos}>
          {/* Main Building Monolith */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={b.size} />
            <meshStandardMaterial
              color="#0b1120"
              roughness={0.5}
              metalness={0.6}
            />
          </mesh>

          {/* Rooftop Tactical Landing Pad */}
          <mesh position={[0, b.size[1] / 2 + 0.05, 0]} receiveShadow>
            <boxGeometry args={[b.size[0] * 0.9, 0.1, b.size[2] * 0.9]} />
            <meshStandardMaterial
              color="#1e293b"
              roughness={0.3}
              metalness={0.7}
            />
          </mesh>

          {/* Emissive Beacon Spire Ring */}
          <mesh position={[0, b.size[1] / 2 + 0.15, 0]}>
            <torusGeometry args={[b.size[0] * 0.35, 0.04, 8, 24]} rotation={[Math.PI / 2, 0, 0]} />
            <meshStandardMaterial
              color={b.color}
              emissive={b.color}
              emissiveIntensity={1.8}
              roughness={0.1}
            />
          </mesh>

          {/* Central Beacon Light Spire */}
          <mesh position={[0, b.size[1] / 2 + 0.4, 0]}>
            <cylinderGeometry args={[0.04, 0.08, 0.6, 8]} />
            <meshStandardMaterial
              color={b.color}
              emissive={b.color}
              emissiveIntensity={2.5}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
