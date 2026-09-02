import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * MissionTargets.jsx
 * Spawns the 4 mandatory mission objectives across the 3D city:
 * 1. 🚨 Emergencies: Red pulsing beacons with particle spark rings.
 * 2. 👥 Civilians: Blue glowing distress beacons on building rooftops.
 * 3. 🦹 Villains: Moving purple targets patrolling between buildings.
 * 4. 🎯 Destinations: Tall green waypoint beacons.
 */
export function MissionTargets({ playerPosRef = null, onProximityUpdate }) {
  // 1. Emergencies (3 Red high-priority zones)
  const emergencies = useMemo(() => [
    { id: 'em-1', pos: [12, 4.5, -8], name: 'Bank Heist in Progress' },
    { id: 'em-2', pos: [-18, 6.0, 14], name: 'Armored Truck Ambush' },
    { id: 'em-3', pos: [8, 3.2, 22], name: 'Structural Collapse' },
  ], []);

  // 2. Civilians (5 Blue rooftop distress points)
  const civilians = useMemo(() => [
    { id: 'civ-1', pos: [-9, 3.8, -12] },
    { id: 'civ-2', pos: [15, 5.2, 6] },
    { id: 'civ-3', pos: [-14, 4.0, 4] },
    { id: 'civ-4', pos: [5, 6.5, -18] },
    { id: 'civ-5', pos: [-6, 3.0, 18] },
  ], []);

  // 3. Destinations (2 Green primary waypoints)
  const destinations = useMemo(() => [
    { id: 'dest-1', pos: [0, 8.0, -32], name: 'Daily Bugle Tower' },
    { id: 'dest-2', pos: [-28, 9.5, -5], name: 'Oscorp Spire' },
  ], []);

  // 4. Moving Villains (3 Patrolling Purple Bosses)
  const villains = useMemo(() => [
    { id: 'vil-1', name: 'Green Goblin', origin: [14, 5.5, -14], radius: 6.0, speed: 0.8, phase: 0 },
    { id: 'vil-2', name: 'Electro', origin: [-16, 7.0, -10], radius: 8.0, speed: 1.2, phase: Math.PI / 2 },
    { id: 'vil-3', name: 'Venom', origin: [10, 4.0, 16], radius: 5.0, speed: 0.6, phase: Math.PI },
  ], []);

  const villainMeshesRef = useRef([]);

  // Animate Villains & Calculate Real-Time Proximity to Spider-Man
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    let minDistance = Infinity;

    villains.forEach((v, i) => {
      const mesh = villainMeshesRef.current[i];
      if (mesh) {
        // Patrol path around building hubs
        const currentAngle = time * v.speed + v.phase;
        mesh.position.x = v.origin[0] + Math.cos(currentAngle) * v.radius;
        mesh.position.z = v.origin[2] + Math.sin(currentAngle) * v.radius;
        mesh.position.y = v.origin[1] + Math.sin(time * 2.0 + i) * 0.4;
        mesh.rotation.y = -currentAngle;

        // Proximity calculation to Spider-Man
        if (playerPosRef && playerPosRef.current) {
          const p = playerPosRef.current;
          const dx = mesh.position.x - p.x;
          const dy = mesh.position.y - p.y;
          const dz = mesh.position.z - p.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < minDistance) {
            minDistance = dist;
          }
        }
      }
    });

    if (onProximityUpdate && isFinite(minDistance)) {
      onProximityUpdate(Math.round(minDistance * 10)); // Scale to realistic meters
    }
  });

  return (
    <group>
      {/* 🚨 1. Emergencies (Red Pulsing Beacons) */}
      {emergencies.map((em) => (
        <group key={em.id} position={em.pos}>
          {/* Beacon Core */}
          <mesh>
            <sphereGeometry args={[0.45, 16, 16]} />
            <meshStandardMaterial
              color="#ef4444"
              emissive="#ef4444"
              emissiveIntensity={3.0}
            />
          </mesh>

          {/* Pulse Ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.7, 0.9, 32]} />
            <meshBasicMaterial
              color="#f87171"
              side={THREE.DoubleSide}
              transparent
              opacity={0.8}
            />
          </mesh>

          {/* Tactical Warning Hologram Column */}
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.1, 0.6, 2.4, 16, 1, true]} />
            <meshBasicMaterial
              color="#ef4444"
              transparent
              opacity={0.35}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}

      {/* 👥 2. Civilians (Blue Rooftop Distress Beacons) */}
      {civilians.map((civ) => (
        <group key={civ.id} position={civ.pos}>
          {/* Blue Distress Hologram */}
          <mesh>
            <octahedronGeometry args={[0.35]} />
            <meshStandardMaterial
              color="#06b6d4"
              emissive="#38bdf8"
              emissiveIntensity={2.5}
            />
          </mesh>

          {/* Ground Marker */}
          <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.5, 0.65, 24]} />
            <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* 🎯 3. Destinations (Green Tall Waypoint Beacons) */}
      {destinations.map((dest) => (
        <group key={dest.id} position={dest.pos}>
          {/* Top Diamond */}
          <mesh position={[0, 3.5, 0]}>
            <octahedronGeometry args={[0.8]} />
            <meshStandardMaterial
              color="#10b981"
              emissive="#34d399"
              emissiveIntensity={3.2}
            />
          </mesh>

          {/* Sky Light Beam Shaft */}
          <mesh position={[0, 15, 0]}>
            <cylinderGeometry args={[0.25, 0.4, 30, 16, 1, true]} />
            <meshBasicMaterial
              color="#10b981"
              transparent
              opacity={0.25}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}

      {/* 🦹 4. Patrolling Villains (Purple Menaces) */}
      {villains.map((v, i) => (
        <group
          key={v.id}
          ref={(el) => { villainMeshesRef.current[i] = el; }}
          position={v.origin}
        >
          {/* Villain Core Aura */}
          <mesh castShadow>
            <dodecahedronGeometry args={[0.65]} />
            <meshStandardMaterial
              color="#7e22ce"
              emissive="#a855f7"
              emissiveIntensity={2.8}
              roughness={0.2}
              metalness={0.8}
            />
          </mesh>

          {/* Orbiting Threat Ring */}
          <mesh rotation={[Math.PI / 3, 0, 0]}>
            <torusGeometry args={[0.95, 0.04, 8, 24]} />
            <meshStandardMaterial
              color="#c084fc"
              emissive="#e879f9"
              emissiveIntensity={3.0}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
