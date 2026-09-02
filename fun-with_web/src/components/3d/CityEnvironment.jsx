import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * CityEnvironment.jsx
 * Infinite procedural cyber-skyline with neon blue glowing edges, rooftop beacons,
 * and real-time modulo wrapping so skyscrapers continuously spawn ahead of Spider-Man.
 */

export function CityEnvironment({ playerPosRef }) {
  const cityGroupRef = useRef();
  const buildingGroupsRef = useRef([]);

  // 1. Grid Parameters (144 Skyscrapers: 12x12 grid)
  const gridCount = 12;
  const spacing = 26; // Distance between building centers
  const totalSpan = gridCount * spacing; // ~312m loop span

  // 2. Generate 144 Unique Building Archetypes with Neon Edges
  const buildingData = useMemo(() => {
    const list = [];
    let idx = 0;

    for (let gx = 0; gx < gridCount; gx++) {
      for (let gz = 0; gz < gridCount; gz++) {
        // Skip central spawn column to keep the immediate starting strip clear
        const isCenter = Math.abs(gx - gridCount / 2) < 1 && Math.abs(gz - gridCount / 2) < 1;

        const seed1 = Math.sin(gx * 12.9898 + gz * 78.233) * 43758.5453;
        const rand1 = seed1 - Math.floor(seed1);
        const seed2 = Math.cos(gx * 34.567 + gz * 12.345) * 23456.789;
        const rand2 = seed2 - Math.floor(seed2);

        // Skyscraper dimensions (Towering from 35m to 120m)
        const height = isCenter ? 25.0 : 35.0 + rand1 * 85.0;
        const width = 14.0 + rand2 * 5.0;
        const depth = 14.0 + rand1 * 5.0;

        const baseX = (gx - gridCount / 2) * spacing;
        const baseZ = (gz - gridCount / 2) * spacing;

        // Shared geometries for efficiency
        const boxGeo = new THREE.BoxGeometry(width, height, depth);
        const edgeGeo = new THREE.EdgesGeometry(boxGeo, 15);
        const roofGeo = new THREE.PlaneGeometry(width * 0.9, depth * 0.9);

        // Rooftop Beacon Type (0: Neon Cyan, 1: Electric Amber, 2: Cyber Violet)
        const beaconType = rand1 > 0.75 ? 1 : (rand1 > 0.4 ? 0 : 2);
        const beaconColor = beaconType === 1 ? '#f59e0b' : (beaconType === 0 ? '#00e5ff' : '#a855f7');

        list.push({
          index: idx++,
          baseX,
          baseZ,
          width,
          height,
          depth,
          boxGeo,
          edgeGeo,
          roofGeo,
          beaconColor,
          currentWorldPos: new THREE.Vector3(baseX, height / 2, baseZ),
          currentRooftopPos: new THREE.Vector3(baseX, height, baseZ)
        });
      }
    }
    return list;
  }, []);

  // 3. High-Performance Materials
  const buildingMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#050811',
    roughness: 0.15,
    metalness: 0.85,
  }), []);

  const edgeMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color: '#00e5ff',
    linewidth: 2,
  }), []);

  // 4. Infinite Modulo Wrapping Loop in useFrame
  useFrame(() => {
    if (!playerPosRef || !playerPosRef.current) return;
    const px = playerPosRef.current.x;
    const pz = playerPosRef.current.z;
    const halfSpan = totalSpan / 2;

    for (let i = 0; i < buildingData.length; i++) {
      const b = buildingData[i];
      const group = buildingGroupsRef.current[i];
      if (!group) continue;

      // Calculate relative delta from player position with modulo wrapping
      let dx = (b.baseX - px) % totalSpan;
      if (dx > halfSpan) dx -= totalSpan;
      else if (dx < -halfSpan) dx += totalSpan;

      let dz = (b.baseZ - pz) % totalSpan;
      if (dz > halfSpan) dz -= totalSpan;
      else if (dz < -halfSpan) dz += totalSpan;

      const worldX = px + dx;
      const worldZ = pz + dz;
      const worldY = b.height / 2;

      group.position.set(worldX, worldY, worldZ);

      // Keep world positions updated for web anchor raycasting
      b.currentWorldPos.set(worldX, worldY, worldZ);
      b.currentRooftopPos.set(worldX, b.height, worldZ);
    }
  });

  return (
    <group ref={cityGroupRef}>
      {/* 144 Towering Cyber-Skyscrapers with Neon Blue Edges */}
      {buildingData.map((b, i) => (
        <group
          key={b.index}
          ref={(el) => { buildingGroupsRef.current[i] = el; }}
          position={[b.baseX, b.height / 2, b.baseZ]}
        >
          {/* Dark Obsidian Building Body */}
          <mesh
            geometry={b.boxGeo}
            material={buildingMaterial}
            castShadow
            receiveShadow
          />

          {/* Glowing Neon Cyan Edge Contours */}
          <lineSegments
            geometry={b.edgeGeo}
            material={edgeMaterial}
          />

          {/* Illuminated Rooftop Landing Pad */}
          <mesh
            geometry={b.roofGeo}
            position={[0, b.height / 2 + 0.05, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial
              color="#0b1329"
              emissive={b.beaconColor}
              emissiveIntensity={0.6}
              roughness={0.2}
              metalness={0.8}
            />
          </mesh>

          {/* Glowing Rooftop Beacon Spire Ring */}
          <mesh position={[0, b.height / 2 + 0.15, 0]}>
            <torusGeometry args={[b.width * 0.3, 0.06, 8, 24]} rotation={[Math.PI / 2, 0, 0]} />
            <meshStandardMaterial
              color={b.beaconColor}
              emissive={b.beaconColor}
              emissiveIntensity={2.5}
            />
          </mesh>

          {/* Rooftop Center Beacon Point */}
          <mesh position={[0, b.height / 2 + 0.8, 0]}>
            <sphereGeometry args={[0.3, 12, 12]} />
            <meshStandardMaterial
              color={b.beaconColor}
              emissive={b.beaconColor}
              emissiveIntensity={3.2}
            />
          </mesh>
        </group>
      ))}

      {/* Infinite Cyber Ground Grid at Y=0 (anchored to player) */}
      <mesh receiveShadow position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial
          color="#02040a"
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}
