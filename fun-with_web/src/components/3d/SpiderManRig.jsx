import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * SpiderManRig.jsx
 * Fully articulated 3D humanoid superhero avatar with dynamic states:
 * - IDLE_CROUCH: Procedural breathing wall-crawling stance
 * - AIMING_SLINGSHOT: Arms raised gripping dual web strands, body pulled back under tension
 * - FLIGHT_SLINGSHOT: Aerodynamic mid-air dive/swing pose during transit
 * - 3D Mouse Look-At tracking for Head, Neck, and Torso
 */
export function SpiderManRig({
  state = 'IDLE', // 'IDLE' | 'AIMING' | 'FLIGHT' | 'LANDING'
  tension = 0.0,
  playerPosRef = null,
  mouseWorldRef = null,
  ...props
}) {
  const rootGroupRef = useRef();

  // Skeletal Hierarchy References
  const hipsRef = useRef();
  const spineRef = useRef();
  const chestRef = useRef();
  const neckRef = useRef();
  const headRef = useRef();

  const leftShoulderRef = useRef();
  const leftUpperArmRef = useRef();
  const leftForearmRef = useRef();
  const leftHandRef = useRef();

  const rightShoulderRef = useRef();
  const rightUpperArmRef = useRef();
  const rightForearmRef = useRef();
  const rightHandRef = useRef();

  const leftThighRef = useRef();
  const leftShinRef = useRef();
  const leftFootRef = useRef();

  const rightThighRef = useRef();
  const rightShinRef = useRef();
  const rightFootRef = useRef();

  // Suit Materials
  const materials = useMemo(() => {
    const redSuit = new THREE.MeshStandardMaterial({
      color: '#dc2626',
      roughness: 0.45,
      metalness: 0.2,
    });

    const blueSuit = new THREE.MeshStandardMaterial({
      color: '#1e3a8a',
      roughness: 0.4,
      metalness: 0.3,
    });

    const blackEmblem = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.3,
      metalness: 0.5,
    });

    const ocularLens = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      emissive: '#e0f2fe',
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.9,
    });

    const eyeRim = new THREE.MeshStandardMaterial({
      color: '#020617',
      roughness: 0.2,
    });

    return { redSuit, blueSuit, blackEmblem, ocularLens, eyeRim };
  }, []);

  useFrame((r3fState) => {
    const time = r3fState.clock.getElapsedTime();
    const breath = Math.sin(time * 2.2);

    // Sync root position directly from physical ref without React rerender
    if (playerPosRef && playerPosRef.current && rootGroupRef.current) {
      rootGroupRef.current.position.copy(playerPosRef.current);
    }

    // --- 1. MOUSE LOOK-AT TRACKING ---
    if (mouseWorldRef && mouseWorldRef.current && rootGroupRef.current) {
      const rootPos = rootGroupRef.current.position;
      const mousePos = mouseWorldRef.current;
      const dx = mousePos.x - rootPos.x;
      const dz = mousePos.z - rootPos.z;
      const dy = mousePos.y - rootPos.y;

      const targetAngleY = Math.atan2(dx, dz);
      const targetAngleX = -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));

      if (headRef.current) {
        headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, targetAngleY * 0.45, 0.1);
        headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, targetAngleX * 0.4, 0.1);
      }
      if (chestRef.current && state === 'AIMING') {
        chestRef.current.rotation.y = THREE.MathUtils.lerp(chestRef.current.rotation.y, targetAngleY * 0.2, 0.1);
      }
    }

    // --- 2. DYNAMIC STATE POSING ---

    if (state === 'AIMING') {
      // Slingshot Tension Pose: Body compressed backwards, dual arms gripping web lines
      const t = THREE.MathUtils.clamp(tension, 0, 1);

      if (hipsRef.current) {
        hipsRef.current.position.set(0, -0.25 - t * 0.2, -t * 0.6);
        hipsRef.current.rotation.x = t * 0.4;
      }
      if (spineRef.current) {
        spineRef.current.rotation.set(-0.2 + t * 0.35, 0, 0);
      }
      if (chestRef.current) {
        chestRef.current.rotation.set(-0.3 + t * 0.4, 0, 0);
      }

      // Left Arm gripping left web line
      if (leftShoulderRef.current) leftShoulderRef.current.rotation.set(0.8 + t * 0.3, 0.6, -0.4);
      if (leftUpperArmRef.current) leftUpperArmRef.current.rotation.set(-1.2 - t * 0.4, -0.3, -0.6);
      if (leftForearmRef.current) leftForearmRef.current.rotation.set(-0.6, 0.4, 0.8);

      // Right Arm gripping right web line
      if (rightShoulderRef.current) rightShoulderRef.current.rotation.set(0.8 + t * 0.3, -0.6, 0.4);
      if (rightUpperArmRef.current) rightUpperArmRef.current.rotation.set(-1.2 - t * 0.4, 0.3, 0.6);
      if (rightForearmRef.current) rightForearmRef.current.rotation.set(-0.6, -0.4, -0.8);

      // Deep crouch leg compression
      if (leftThighRef.current) leftThighRef.current.rotation.set(-1.2 - t * 0.4, 0.6, -0.6);
      if (leftShinRef.current) leftShinRef.current.rotation.set(2.0 + t * 0.4, -0.2, 0.3);
      if (rightThighRef.current) rightThighRef.current.rotation.set(-1.2 - t * 0.4, -0.6, 0.6);
      if (rightShinRef.current) rightShinRef.current.rotation.set(2.0 + t * 0.4, 0.2, -0.3);

    } else if (state === 'FLIGHT') {
      // Aerodynamic Mid-Air Dive / Swing Pose
      if (hipsRef.current) {
        hipsRef.current.position.set(0, 0.1, 0);
        hipsRef.current.rotation.set(-0.6, 0, 0);
      }
      if (spineRef.current) spineRef.current.rotation.set(0.3, 0, 0);
      if (chestRef.current) chestRef.current.rotation.set(0.2, 0, 0);

      // Arms trailing aerodynamically
      if (leftShoulderRef.current) leftShoulderRef.current.rotation.set(-0.8, 0.2, -0.3);
      if (leftUpperArmRef.current) leftUpperArmRef.current.rotation.set(0.4, -0.2, -0.4);
      if (leftForearmRef.current) leftForearmRef.current.rotation.set(0.3, 0, 0);

      if (rightShoulderRef.current) rightShoulderRef.current.rotation.set(-0.8, -0.2, 0.3);
      if (rightUpperArmRef.current) rightUpperArmRef.current.rotation.set(0.4, 0.2, 0.4);
      if (rightForearmRef.current) rightForearmRef.current.rotation.set(0.3, 0, 0);

      // Legs angled back
      if (leftThighRef.current) leftThighRef.current.rotation.set(0.6, 0.2, -0.2);
      if (leftShinRef.current) leftShinRef.current.rotation.set(-0.4, 0, 0);
      if (rightThighRef.current) rightThighRef.current.rotation.set(0.4, -0.2, 0.2);
      if (rightShinRef.current) rightShinRef.current.rotation.set(-0.6, 0, 0);

    } else {
      // IDLE_CROUCH with procedural harmonic breathing
      if (hipsRef.current) {
        hipsRef.current.position.set(0, -0.15 + breath * 0.02, 0);
        hipsRef.current.rotation.set(0, 0, 0);
      }
      if (spineRef.current) {
        spineRef.current.rotation.set(-0.35 + breath * 0.03, 0, Math.sin(time * 1.1) * 0.015);
      }
      if (chestRef.current) {
        chestRef.current.rotation.set(-0.15 + breath * 0.02, 0, 0);
        const chestScale = 1.0 + breath * 0.02;
        chestRef.current.scale.set(chestScale, chestScale, chestScale);
      }

      // Rest pose limbs
      if (leftShoulderRef.current) leftShoulderRef.current.rotation.set(0.2, 0.3, -0.4 + breath * 0.02);
      if (leftUpperArmRef.current) leftUpperArmRef.current.rotation.set(-0.6, -0.4, -0.7);
      if (leftForearmRef.current) leftForearmRef.current.rotation.set(-0.8, 0.2, 0.4);

      if (rightShoulderRef.current) rightShoulderRef.current.rotation.set(0.2, -0.3, 0.4 - breath * 0.02);
      if (rightUpperArmRef.current) rightUpperArmRef.current.rotation.set(-0.6, 0.4, 0.7);
      if (rightForearmRef.current) rightForearmRef.current.rotation.set(-0.8, -0.2, -0.4);

      if (leftThighRef.current) leftThighRef.current.rotation.set(-0.7, 0.5, -0.6);
      if (leftShinRef.current) leftShinRef.current.rotation.set(1.4, -0.2, 0.3);
      if (leftFootRef.current) leftFootRef.current.rotation.set(-0.4, 0.1, 0.2);

      if (rightThighRef.current) rightThighRef.current.rotation.set(-0.7, -0.5, 0.6);
      if (rightShinRef.current) rightShinRef.current.rotation.set(1.4, 0.2, -0.3);
      if (rightFootRef.current) rightFootRef.current.rotation.set(-0.4, -0.1, -0.2);
    }
  });

  return (
    <group ref={rootGroupRef} {...props}>
      {/* --- HIPS ROOT BONE --- */}
      <group ref={hipsRef} position={[0, 0, 0]}>
        {/* Pelvis / Belt */}
        <mesh castShadow receiveShadow material={materials.redSuit}>
          <boxGeometry args={[0.55, 0.32, 0.4]} />
        </mesh>

        {/* --- SPINE BONE --- */}
        <group ref={spineRef} position={[0, 0.22, 0]}>
          <mesh castShadow receiveShadow material={materials.blueSuit}>
            <cylinderGeometry args={[0.24, 0.22, 0.35, 12]} />
          </mesh>

          {/* --- CHEST / THORAX BONE --- */}
          <group ref={chestRef} position={[0, 0.3, 0]}>
            {/* Muscular V-Taper Torso */}
            <mesh castShadow receiveShadow material={materials.redSuit} position={[0, 0.05, 0]}>
              <boxGeometry args={[0.68, 0.48, 0.45]} />
            </mesh>

            {/* Blue Side Panels */}
            <mesh castShadow material={materials.blueSuit} position={[-0.28, 0, 0]}>
              <boxGeometry args={[0.15, 0.45, 0.42]} />
            </mesh>
            <mesh castShadow material={materials.blueSuit} position={[0.28, 0, 0]}>
              <boxGeometry args={[0.15, 0.45, 0.42]} />
            </mesh>

            {/* Chest Spider Emblem */}
            <mesh material={materials.blackEmblem} position={[0, 0.06, 0.235]}>
              <cylinderGeometry args={[0.08, 0.08, 0.02, 6]} rotation={[Math.PI / 2, 0, 0]} />
            </mesh>

            {/* --- NECK BONE --- */}
            <group ref={neckRef} position={[0, 0.3, 0]}>
              <mesh castShadow material={materials.redSuit}>
                <cylinderGeometry args={[0.12, 0.14, 0.16, 12]} />
              </mesh>

              {/* --- HEAD BONE --- */}
              <group ref={headRef} position={[0, 0.18, 0.04]}>
                <mesh castShadow material={materials.redSuit}>
                  <sphereGeometry args={[0.22, 24, 24]} scale={[1, 1.25, 1.15]} />
                </mesh>

                {/* Left Ocular Lens */}
                <group position={[-0.09, 0.04, 0.19]} rotation={[-0.1, -0.3, 0.15]}>
                  <mesh material={materials.eyeRim}>
                    <coneGeometry args={[0.085, 0.03, 4]} rotation={[Math.PI / 2, 0, Math.PI / 4]} />
                  </mesh>
                  <mesh material={materials.ocularLens} position={[0, 0, 0.01]}>
                    <coneGeometry args={[0.07, 0.02, 4]} rotation={[Math.PI / 2, 0, Math.PI / 4]} />
                  </mesh>
                </group>

                {/* Right Ocular Lens */}
                <group position={[0.09, 0.04, 0.19]} rotation={[-0.1, 0.3, -0.15]}>
                  <mesh material={materials.eyeRim}>
                    <coneGeometry args={[0.085, 0.03, 4]} rotation={[Math.PI / 2, 0, Math.PI / 4]} />
                  </mesh>
                  <mesh material={materials.ocularLens} position={[0, 0, 0.01]}>
                    <coneGeometry args={[0.07, 0.02, 4]} rotation={[Math.PI / 2, 0, Math.PI / 4]} />
                  </mesh>
                </group>
              </group>
            </group>

            {/* --- LEFT ARM HIERARCHY --- */}
            <group ref={leftShoulderRef} position={[-0.38, 0.18, 0]}>
              <mesh castShadow material={materials.redSuit}>
                <sphereGeometry args={[0.13, 16, 16]} />
              </mesh>

              <group ref={leftUpperArmRef} position={[-0.12, -0.12, 0]}>
                <mesh castShadow material={materials.blueSuit} position={[0, -0.15, 0]}>
                  <capsuleGeometry args={[0.09, 0.28, 8, 16]} />
                </mesh>

                <group ref={leftForearmRef} position={[0, -0.34, 0]}>
                  <mesh castShadow material={materials.redSuit} position={[0, -0.16, 0]}>
                    <capsuleGeometry args={[0.08, 0.3, 8, 16]} />
                  </mesh>

                  {/* Left Hand */}
                  <group ref={leftHandRef} position={[0, -0.34, 0]}>
                    <mesh castShadow material={materials.redSuit}>
                      <boxGeometry args={[0.1, 0.14, 0.06]} />
                    </mesh>
                  </group>
                </group>
              </group>
            </group>

            {/* --- RIGHT ARM HIERARCHY --- */}
            <group ref={rightShoulderRef} position={[0.38, 0.18, 0]}>
              <mesh castShadow material={materials.redSuit}>
                <sphereGeometry args={[0.13, 16, 16]} />
              </mesh>

              <group ref={rightUpperArmRef} position={[0.12, -0.12, 0]}>
                <mesh castShadow material={materials.blueSuit} position={[0, -0.15, 0]}>
                  <capsuleGeometry args={[0.09, 0.28, 8, 16]} />
                </mesh>

                <group ref={rightForearmRef} position={[0, -0.34, 0]}>
                  <mesh castShadow material={materials.redSuit} position={[0, -0.16, 0]}>
                    <capsuleGeometry args={[0.08, 0.3, 8, 16]} />
                  </mesh>

                  {/* Right Hand */}
                  <group ref={rightHandRef} position={[0, -0.34, 0]}>
                    <mesh castShadow material={materials.redSuit}>
                      <boxGeometry args={[0.1, 0.14, 0.06]} />
                    </mesh>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>

        {/* --- LEFT LEG HIERARCHY --- */}
        <group ref={leftThighRef} position={[-0.22, -0.1, 0]}>
          <mesh castShadow material={materials.blueSuit} position={[0, -0.25, 0]}>
            <capsuleGeometry args={[0.12, 0.45, 8, 16]} />
          </mesh>

          <group ref={leftShinRef} position={[0, -0.52, 0]}>
            <mesh castShadow material={materials.redSuit} position={[0, -0.26, 0]}>
              <capsuleGeometry args={[0.1, 0.46, 8, 16]} />
            </mesh>

            <group ref={leftFootRef} position={[0, -0.52, 0.08]}>
              <mesh castShadow material={materials.redSuit}>
                <boxGeometry args={[0.12, 0.09, 0.24]} />
              </mesh>
            </group>
          </group>
        </group>

        {/* --- RIGHT LEG HIERARCHY --- */}
        <group ref={rightThighRef} position={[0.22, -0.1, 0]}>
          <mesh castShadow material={materials.blueSuit} position={[0, -0.25, 0]}>
            <capsuleGeometry args={[0.12, 0.45, 8, 16]} />
          </mesh>

          <group ref={rightShinRef} position={[0, -0.52, 0]}>
            <mesh castShadow material={materials.redSuit} position={[0, -0.26, 0]}>
              <capsuleGeometry args={[0.1, 0.46, 8, 16]} />
            </mesh>

            <group ref={rightFootRef} position={[0, -0.52, 0.08]}>
              <mesh castShadow material={materials.redSuit}>
                <boxGeometry args={[0.12, 0.09, 0.24]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
