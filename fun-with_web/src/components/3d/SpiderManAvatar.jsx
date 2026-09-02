import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * SpiderManAvatar.jsx
 * Full-body humanoid superhero rig with:
 * - Wrist-anchored web origin (exposes rightHandWorldPos via ref)
 * - Grapple & Aim stance: body slerp toward anchor, coiled crouch
 * - Flight aerodynamics: forward alignment + ±35° turn banking
 * - Procedural breathing idle
 */
export function SpiderManAvatar({
  state = 'IDLE',     // 'IDLE' | 'AIMING' | 'FLIGHT'
  tension = 0.0,
  playerPosRef = null,
  velocityRef = null,
  anchorPointRef = null,
  rightHandWorldPosRef = null, // OUTPUT: filled every frame
}) {
  const rootRef   = useRef();
  const hipsRef   = useRef();
  const spineRef  = useRef();
  const chestRef  = useRef();
  const neckRef   = useRef();
  const headRef   = useRef();

  const lShoulderRef = useRef(); const lUpperArmRef = useRef();
  const lForearmRef  = useRef(); const lHandRef     = useRef();
  const rShoulderRef = useRef(); const rUpperArmRef = useRef();
  const rForearmRef  = useRef(); const rHandRef     = useRef();

  const lThighRef = useRef(); const lShinRef = useRef(); const lFootRef = useRef();
  const rThighRef = useRef(); const rShinRef = useRef(); const rFootRef = useRef();

  const prevVel = useRef(new THREE.Vector3());
  const tmpVec  = useRef(new THREE.Vector3());

  // Suit materials
  const mats = useMemo(() => ({
    red:  new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.45, metalness: 0.2 }),
    blue: new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.4,  metalness: 0.3 }),
    blk:  new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.3,  metalness: 0.5 }),
    lens: new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: '#e0f2fe', emissiveIntensity: 0.8, roughness: 0.1, metalness: 0.9 }),
    rim:  new THREE.MeshStandardMaterial({ color: '#020617', roughness: 0.2 }),
  }), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);

    // Sync root to player physics position
    if (playerPosRef?.current && rootRef.current) {
      rootRef.current.position.copy(playerPosRef.current);
    }

    const time = performance.now() * 0.001;
    const breath = Math.sin(time * 2.2);

    // -------------------------------------------------------------------------
    // A. FLIGHT — align body with velocity, bank into turns
    // -------------------------------------------------------------------------
    if (state === 'FLIGHT' && velocityRef?.current && rootRef.current) {
      const vel = velocityRef.current;
      const speed = vel.length();

      if (speed > 0.05) {
        // Align body forward (-Z) with velocity direction
        tmpVec.current.copy(vel).normalize().negate();
        const angle = Math.atan2(tmpVec.current.x, tmpVec.current.z);
        rootRef.current.rotation.y = THREE.MathUtils.lerp(rootRef.current.rotation.y, angle, 8 * dt);

        // Pitch nose down proportional to speed
        const pitch = Math.min(speed * 0.12, 0.45);
        rootRef.current.rotation.x = THREE.MathUtils.lerp(rootRef.current.rotation.x, -pitch, 6 * dt);

        // Banking — cross velocity with previous velocity = angular change
        const cross = vel.z * prevVel.current.x - vel.x * prevVel.current.z;
        const bank = THREE.MathUtils.clamp(cross * 18, -0.61, 0.61); // ±35°
        rootRef.current.rotation.z = THREE.MathUtils.lerp(rootRef.current.rotation.z, bank, 6 * dt);
      }
      prevVel.current.copy(vel);

      // Aerodynamic dive pose
      if (hipsRef.current) { hipsRef.current.rotation.set(-0.6, 0, 0); hipsRef.current.position.set(0, 0.1, 0); }
      if (spineRef.current)  spineRef.current.rotation.set(0.25, 0, 0);
      if (chestRef.current)  chestRef.current.rotation.set(0.15, 0, 0);
      if (lShoulderRef.current) lShoulderRef.current.rotation.set(-0.75, 0.2, -0.3);
      if (lUpperArmRef.current) lUpperArmRef.current.rotation.set(0.35, -0.2, -0.35);
      if (rShoulderRef.current) rShoulderRef.current.rotation.set(-0.75, -0.2, 0.3);
      if (rUpperArmRef.current) rUpperArmRef.current.rotation.set(0.35, 0.2, 0.35);
      if (lThighRef.current) lThighRef.current.rotation.set(0.55, 0.18, -0.18);
      if (lShinRef.current)  lShinRef.current.rotation.set(-0.38, 0, 0);
      if (rThighRef.current) rThighRef.current.rotation.set(0.38, -0.18, 0.18);
      if (rShinRef.current)  rShinRef.current.rotation.set(-0.55, 0, 0);

    // -------------------------------------------------------------------------
    // B. AIMING — orient toward anchor, coiled crouch, raise right arm
    // -------------------------------------------------------------------------
    } else if (state === 'AIMING' && anchorPointRef?.current && rootRef.current) {
      const anchor = anchorPointRef.current;
      const p = playerPosRef?.current ?? rootRef.current.position;
      const t = THREE.MathUtils.clamp(tension, 0, 1);

      // Face anchor
      const dx = anchor.x - p.x;
      const dz = anchor.z - p.z;
      const targetY = Math.atan2(dx, dz);
      rootRef.current.rotation.y = THREE.MathUtils.lerp(rootRef.current.rotation.y, targetY, 10 * dt);
      rootRef.current.rotation.x = THREE.MathUtils.lerp(rootRef.current.rotation.x, 0, 6 * dt);
      rootRef.current.rotation.z = THREE.MathUtils.lerp(rootRef.current.rotation.z, 0, 6 * dt);

      // Coiled crouch
      if (hipsRef.current) { hipsRef.current.rotation.set(t * 0.35, 0, 0); hipsRef.current.position.set(0, -0.2 - t * 0.18, -t * 0.45); }
      if (spineRef.current)  spineRef.current.rotation.set(-0.15 + t * 0.3, 0, 0);
      if (chestRef.current)  chestRef.current.rotation.set(-0.25 + t * 0.38, 0, 0);

      // Right arm raised toward anchor (web-shooting arm)
      if (rShoulderRef.current) rShoulderRef.current.rotation.set(0.9 + t * 0.4, -0.55, 0.35);
      if (rUpperArmRef.current) rUpperArmRef.current.rotation.set(-1.1 - t * 0.45, 0.28, 0.55);
      if (rForearmRef.current)  rForearmRef.current.rotation.set(-0.5, -0.35, -0.75);

      // Left arm and legs pulled back
      if (lShoulderRef.current) lShoulderRef.current.rotation.set(-0.5 - t * 0.3, 0.55, -0.35);
      if (lUpperArmRef.current) lUpperArmRef.current.rotation.set(0.4 + t * 0.3, -0.25, -0.5);
      if (lThighRef.current) lThighRef.current.rotation.set(-1.1 - t * 0.35, 0.55, -0.55);
      if (lShinRef.current)  lShinRef.current.rotation.set(1.9 + t * 0.35, -0.18, 0.28);
      if (rThighRef.current) rThighRef.current.rotation.set(-1.1 - t * 0.35, -0.55, 0.55);
      if (rShinRef.current)  rShinRef.current.rotation.set(1.9 + t * 0.35, 0.18, -0.28);

    // -------------------------------------------------------------------------
    // C. IDLE — procedural breathing crouch
    // -------------------------------------------------------------------------
    } else {
      rootRef.current.rotation.x = THREE.MathUtils.lerp(rootRef.current.rotation.x, 0, 4 * dt);
      rootRef.current.rotation.z = THREE.MathUtils.lerp(rootRef.current.rotation.z, 0, 4 * dt);

      if (hipsRef.current)  { hipsRef.current.position.set(0, -0.14 + breath * 0.02, 0); hipsRef.current.rotation.set(0, 0, 0); }
      if (spineRef.current)  spineRef.current.rotation.set(-0.32 + breath * 0.03, 0, Math.sin(time * 1.1) * 0.015);
      if (chestRef.current)  chestRef.current.rotation.set(-0.12 + breath * 0.02, 0, 0);
      if (lShoulderRef.current) lShoulderRef.current.rotation.set(0.2,  0.28, -0.38);
      if (lUpperArmRef.current) lUpperArmRef.current.rotation.set(-0.55, -0.38, -0.65);
      if (rShoulderRef.current) rShoulderRef.current.rotation.set(0.2, -0.28, 0.38);
      if (rUpperArmRef.current) rUpperArmRef.current.rotation.set(-0.55,  0.38, 0.65);
      if (lThighRef.current) lThighRef.current.rotation.set(-0.65, 0.48, -0.55);
      if (lShinRef.current)  lShinRef.current.rotation.set(1.35, -0.18, 0.28);
      if (rThighRef.current) rThighRef.current.rotation.set(-0.65, -0.48, 0.55);
      if (rShinRef.current)  rShinRef.current.rotation.set(1.35, 0.18, -0.28);

      if (headRef.current) {
        headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, 0, 3 * dt);
        headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, 0, 3 * dt);
      }
    }

    // Export right-hand world position for wrist-anchored web origin
    if (rHandRef.current && rightHandWorldPosRef) {
      rHandRef.current.getWorldPosition(tmpVec.current);
      rightHandWorldPosRef.current.copy(tmpVec.current);
    }

    // Head look-at toward anchor during AIMING
    if (state === 'AIMING' && anchorPointRef?.current && headRef.current && rootRef.current) {
      const p = playerPosRef?.current ?? rootRef.current.position;
      const a = anchorPointRef.current;
      const ax = a.x - p.x; const ay = a.y - p.y; const az = a.z - p.z;
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, Math.atan2(ax, az) * 0.35, 8 * dt);
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, -Math.atan2(ay, Math.sqrt(ax*ax+az*az)) * 0.3, 8 * dt);
    }
  });

  // -----------------------------------------------------------------------
  // JSX Skeleton (identical geometry to original SpiderManRig)
  // -----------------------------------------------------------------------
  return (
    <group ref={rootRef}>
      <group ref={hipsRef}>
        {/* Pelvis */}
        <mesh castShadow material={mats.red}><boxGeometry args={[0.55, 0.32, 0.4]} /></mesh>

        <group ref={spineRef} position={[0, 0.22, 0]}>
          <mesh castShadow material={mats.blue}><cylinderGeometry args={[0.24, 0.22, 0.35, 12]} /></mesh>

          <group ref={chestRef} position={[0, 0.3, 0]}>
            <mesh castShadow material={mats.red} position={[0, 0.05, 0]}><boxGeometry args={[0.68, 0.48, 0.45]} /></mesh>
            <mesh castShadow material={mats.blue} position={[-0.28, 0, 0]}><boxGeometry args={[0.15, 0.45, 0.42]} /></mesh>
            <mesh castShadow material={mats.blue} position={[ 0.28, 0, 0]}><boxGeometry args={[0.15, 0.45, 0.42]} /></mesh>
            <mesh material={mats.blk} position={[0, 0.06, 0.235]}>
              <cylinderGeometry args={[0.08, 0.08, 0.02, 6]} rotation={[Math.PI / 2, 0, 0]} />
            </mesh>

            <group ref={neckRef} position={[0, 0.3, 0]}>
              <mesh castShadow material={mats.red}><cylinderGeometry args={[0.12, 0.14, 0.16, 12]} /></mesh>
              <group ref={headRef} position={[0, 0.18, 0.04]}>
                <mesh castShadow material={mats.red}><sphereGeometry args={[0.22, 24, 24]} scale={[1, 1.25, 1.15]} /></mesh>
                <group position={[-0.09, 0.04, 0.19]} rotation={[-0.1, -0.3, 0.15]}>
                  <mesh material={mats.rim}><coneGeometry args={[0.085, 0.03, 4]} rotation={[Math.PI/2, 0, Math.PI/4]} /></mesh>
                  <mesh material={mats.lens} position={[0, 0, 0.01]}><coneGeometry args={[0.07, 0.02, 4]} rotation={[Math.PI/2, 0, Math.PI/4]} /></mesh>
                </group>
                <group position={[0.09, 0.04, 0.19]} rotation={[-0.1, 0.3, -0.15]}>
                  <mesh material={mats.rim}><coneGeometry args={[0.085, 0.03, 4]} rotation={[Math.PI/2, 0, Math.PI/4]} /></mesh>
                  <mesh material={mats.lens} position={[0, 0, 0.01]}><coneGeometry args={[0.07, 0.02, 4]} rotation={[Math.PI/2, 0, Math.PI/4]} /></mesh>
                </group>
              </group>
            </group>

            {/* Left Arm */}
            <group ref={lShoulderRef} position={[-0.38, 0.18, 0]}>
              <mesh castShadow material={mats.red}><sphereGeometry args={[0.13, 14, 14]} /></mesh>
              <group ref={lUpperArmRef} position={[-0.12, -0.12, 0]}>
                <mesh castShadow material={mats.blue} position={[0, -0.15, 0]}><capsuleGeometry args={[0.09, 0.28, 8, 14]} /></mesh>
                <group ref={lForearmRef} position={[0, -0.34, 0]}>
                  <mesh castShadow material={mats.red} position={[0, -0.16, 0]}><capsuleGeometry args={[0.08, 0.30, 8, 14]} /></mesh>
                  <group ref={lHandRef} position={[0, -0.34, 0]}>
                    <mesh castShadow material={mats.red}><boxGeometry args={[0.10, 0.14, 0.06]} /></mesh>
                  </group>
                </group>
              </group>
            </group>

            {/* Right Arm */}
            <group ref={rShoulderRef} position={[0.38, 0.18, 0]}>
              <mesh castShadow material={mats.red}><sphereGeometry args={[0.13, 14, 14]} /></mesh>
              <group ref={rUpperArmRef} position={[0.12, -0.12, 0]}>
                <mesh castShadow material={mats.blue} position={[0, -0.15, 0]}><capsuleGeometry args={[0.09, 0.28, 8, 14]} /></mesh>
                <group ref={rForearmRef} position={[0, -0.34, 0]}>
                  <mesh castShadow material={mats.red} position={[0, -0.16, 0]}><capsuleGeometry args={[0.08, 0.30, 8, 14]} /></mesh>
                  <group ref={rHandRef} position={[0, -0.34, 0]}>
                    <mesh castShadow material={mats.red}><boxGeometry args={[0.10, 0.14, 0.06]} /></mesh>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>

        {/* Left Leg */}
        <group ref={lThighRef} position={[-0.22, -0.1, 0]}>
          <mesh castShadow material={mats.blue} position={[0, -0.25, 0]}><capsuleGeometry args={[0.12, 0.45, 8, 14]} /></mesh>
          <group ref={lShinRef} position={[0, -0.52, 0]}>
            <mesh castShadow material={mats.red} position={[0, -0.26, 0]}><capsuleGeometry args={[0.10, 0.46, 8, 14]} /></mesh>
            <group ref={lFootRef} position={[0, -0.52, 0.08]}>
              <mesh castShadow material={mats.red}><boxGeometry args={[0.12, 0.09, 0.24]} /></mesh>
            </group>
          </group>
        </group>

        {/* Right Leg */}
        <group ref={rThighRef} position={[0.22, -0.1, 0]}>
          <mesh castShadow material={mats.blue} position={[0, -0.25, 0]}><capsuleGeometry args={[0.12, 0.45, 8, 14]} /></mesh>
          <group ref={rShinRef} position={[0, -0.52, 0]}>
            <mesh castShadow material={mats.red} position={[0, -0.26, 0]}><capsuleGeometry args={[0.10, 0.46, 8, 14]} /></mesh>
            <group ref={rFootRef} position={[0, -0.52, 0.08]}>
              <mesh castShadow material={mats.red}><boxGeometry args={[0.12, 0.09, 0.24]} /></mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
