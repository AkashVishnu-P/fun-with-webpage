import React, { useMemo, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * ProceduralCity.jsx
 * High-performance 500+ skyscraper procedural Manhattan grid rendered in a single GPU draw call
 * utilizing THREE.InstancedMesh, dark cyber-noir materials, street canyons, and rooftop anchor nodes.
 */

// Internal deterministic building generator (24 x 24 grid = 576 buildings)
function generateCityGridData() {
  const gridSize = 24;
  const spacing = 18;  // Distance between building centers
  const halfGrid = (gridSize * spacing) / 2;
  const buildings = [];

  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      const worldX = x * spacing - halfGrid;
      const worldZ = z * spacing - halfGrid;

      // Skip exact center block to leave an open courtyard for player spawn
      if (Math.abs(worldX) < 12 && Math.abs(worldZ) < 12) {
        continue;
      }

      // Deterministic pseudo-random height & footprint
      const seed = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
      const rand1 = seed - Math.floor(seed);
      const seed2 = Math.cos(x * 34.567 + z * 12.345) * 23456.789;
      const rand2 = seed2 - Math.floor(seed2);

      // Skyscraper dimensions
      const height = 15.0 + rand1 * 65.0; // Heights from 15m to 80m
      const width = 10.0 + rand2 * 4.0;  // 10m to 14m width, leaving 4-8m street canyons
      const depth = 10.0 + rand1 * 4.0;

      buildings.push({
        id: `${x}_${z}`,
        x: worldX,
        z: worldZ,
        posY: height / 2,
        height,
        width,
        depth,
        rooftopY: height
      });
    }
  }

  return buildings;
}

export function ProceduralCity({ onRooftopsGenerated = null, onPointerClickRooftop = null }) {
  const instancedMeshRef = useRef();

  // 1. Procedural Building Grid Data (500+ skyscrapers)
  const buildings = useMemo(() => {
    const data = generateCityGridData();
    if (onRooftopsGenerated) {
      onRooftopsGenerated(data);
    }
    return data;
  }, [onRooftopsGenerated]);

  const count = buildings.length;

  // 2. Base Geometry & Cyber-Noir Material (#0F141C, metalness 0.8)
  const boxGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const buildingMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#0F141C',
    metalness: 0.8,
    roughness: 0.25,
  }), []);

  // 3. Populate Instanced Matrices in a single pass
  useLayoutEffect(() => {
    if (!instancedMeshRef.current) return;
    const mesh = instancedMeshRef.current;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      dummy.position.set(b.x, b.posY, b.z);
      dummy.scale.set(b.width, b.height, b.depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  }, [buildings]);

  return (
    <group>
      {/* 500+ Skyscraper Procedural Grid in a SINGLE GPU Draw Call */}
      <instancedMesh
        ref={instancedMeshRef}
        args={[boxGeometry, buildingMaterial, count]}
        castShadow
        receiveShadow
        onClick={(e) => {
          if (onPointerClickRooftop && e.point) {
            e.stopPropagation();
            onPointerClickRooftop(e.point);
          }
        }}
      />

      {/* Ground Plane at Y=0 */}
      <mesh receiveShadow position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial
          color="#050505"
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      {/* Digital Street Grid Helper with Glowing Cyan Lines at Y=0.05 */}
      <gridHelper
        args={[1000, 100, '#00E5FF', '#0F141C']}
        position={[0, 0.05, 0]}
      />
    </group>
  );
}
