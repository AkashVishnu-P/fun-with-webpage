import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Procedural Texture Generator for Photorealistic Arachnid-Humanoid Suit
 */
function createSuitTextures() {
  // 1. Hexagonal Honeycomb Normal/Bump Canvas (Crimson Fabric)
  const hexCanvas = document.createElement('canvas');
  hexCanvas.width = 256;
  hexCanvas.height = 256;
  const hexCtx = hexCanvas.getContext('2d');
  hexCtx.fillStyle = '#8080ff'; // Flat normal base
  hexCtx.fillRect(0, 0, 256, 256);

  const hexRadius = 14;
  const hexW = Math.sqrt(3) * hexRadius;
  const hexH = 2 * hexRadius * 0.75;

  hexCtx.strokeStyle = 'rgba(20, 20, 160, 0.7)';
  hexCtx.lineWidth = 2.5;

  for (let y = -hexRadius; y < 256 + hexRadius; y += hexH) {
    const rowOffset = (Math.round(y / hexH) % 2 === 0) ? 0 : hexW / 2;
    for (let x = -hexRadius; x < 256 + hexRadius; x += hexW) {
      const cx = x + rowOffset;
      const cy = y;
      hexCtx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const hx = cx + hexRadius * Math.cos(angle);
        const hy = cy + hexRadius * Math.sin(angle);
        if (i === 0) hexCtx.moveTo(hx, hy);
        else hexCtx.lineTo(hx, hy);
      }
      hexCtx.closePath();
      hexCtx.stroke();
    }
  }

  const hexTexture = new THREE.CanvasTexture(hexCanvas);
  hexTexture.wrapS = THREE.RepeatWrapping;
  hexTexture.wrapT = THREE.RepeatWrapping;
  hexTexture.repeat.set(12, 12);

  // 2. Linear Porous Ripstop Weave (Midnight Navy Fabric)
  const ripCanvas = document.createElement('canvas');
  ripCanvas.width = 128;
  ripCanvas.height = 128;
  const ripCtx = ripCanvas.getContext('2d');
  ripCtx.fillStyle = '#8080ff';
  ripCtx.fillRect(0, 0, 128, 128);
  ripCtx.strokeStyle = 'rgba(40, 40, 140, 0.45)';
  ripCtx.lineWidth = 1.5;
  for (let i = 0; i < 128; i += 8) {
    ripCtx.beginPath();
    ripCtx.moveTo(i, 0); ripCtx.lineTo(i, 128);
    ripCtx.moveTo(0, i); ripCtx.lineTo(128, i);
    ripCtx.stroke();
  }
  const ripTexture = new THREE.CanvasTexture(ripCanvas);
  ripTexture.wrapS = THREE.RepeatWrapping;
  ripTexture.wrapT = THREE.RepeatWrapping;
  ripTexture.repeat.set(16, 16);

  // 3. Micro-Perforated One-Way Mirror Mesh (Ocular Lenses)
  const lensCanvas = document.createElement('canvas');
  lensCanvas.width = 64;
  lensCanvas.height = 64;
  const lensCtx = lensCanvas.getContext('2d');
  lensCtx.fillStyle = '#ffffff';
  lensCtx.fillRect(0, 0, 64, 64);
  lensCtx.fillStyle = '#d0d8e8';
  for (let y = 2; y < 64; y += 6) {
    for (let x = 2; x < 64; x += 6) {
      lensCtx.beginPath();
      lensCtx.arc(x, y, 1.5, 0, Math.PI * 2);
      lensCtx.fill();
    }
  }
  const lensTexture = new THREE.CanvasTexture(lensCanvas);
  lensTexture.wrapS = THREE.RepeatWrapping;
  lensTexture.wrapT = THREE.RepeatWrapping;
  lensTexture.repeat.set(8, 8);

  return { hexTexture, ripTexture, lensTexture };
}

/**
 * SpiderManAvatar.jsx
 * Photorealistic Arachnid-Humanoid Superhero Model
 * Specifications:
 * - High-tensile Kevlar-Spandex crimson fabric (#B30000) with hexagonal micro-weave & subtle sheen
 * - Deep midnight navy ripstop fabric (#0A1128) with high light absorption
 * - 3D raised black polyurethane webbing with sharp specular highlights
 * - Expressive angular teardrop mask lenses with micro-aperture shutter rims & one-way mirror mesh
 * - Geometric chest insignia & classic back spider logo
 * - Exposed wrist web-shooters (brushed gunmetal, machined aluminum & brass nozzles)
 * - Athletic arachnid crouch, realistic kinesthesis, turn banking, and wrist-anchored grapple
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

  // ── Module-level scratch objects (no per-frame allocations) ─────────────────
  // These are defined here as refs so they survive re-renders without
  // triggering React Compiler immutability warnings.
  const _flatTarget  = useRef(new THREE.Vector3());
  const _flightDir   = useRef(new THREE.Vector3());
  const _flightTgt   = useRef(new THREE.Vector3());
  const _lookMat     = useRef(new THREE.Matrix4());
  const _targetQuat  = useRef(new THREE.Quaternion());
  const _wristOffset = useRef(new THREE.Vector3());
  const _worldUp     = useRef(new THREE.Vector3(0, 1, 0));

  // Photorealistic Materials with Procedural Weaves & High-Precision PBR
  const mats = useMemo(() => {
    const { hexTexture, ripTexture, lensTexture } = createSuitTextures();

    // SECTION 2: Crimson Fabric (Red Suit Panels)
    const crimsonFabric = new THREE.MeshStandardMaterial({
      color: '#B30000',
      roughness: 0.42,
      metalness: 0.12,
      bumpMap: hexTexture,
      bumpScale: 0.04,
    });

    // SECTION 3: Midnight Navy Fabric (Blue Suit Panels)
    const navyFabric = new THREE.MeshStandardMaterial({
      color: '#0A1128',
      roughness: 0.65,
      metalness: 0.25,
      bumpMap: ripTexture,
      bumpScale: 0.03,
    });

    // SECTION 4: 3D Raised Polyurethane Webbing (Vantablack + high gloss)
    const raisedWebbing = new THREE.MeshStandardMaterial({
      color: '#030305',
      roughness: 0.12,
      metalness: 0.88,
    });

    // SECTION 5: Ocular Lenses (Micro-perforated one-way mirror)
    const ocularGlass = new THREE.MeshPhysicalMaterial({
      color: '#f8fafc',
      emissive: '#cbe7f8',
      emissiveIntensity: 0.5,
      roughness: 0.08,
      metalness: 0.95,
      map: lensTexture,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });

    const lensRimFrame = new THREE.MeshStandardMaterial({
      color: '#08080a',
      roughness: 0.35,
      metalness: 0.8,
    });

    // SECTION 6: Insignias (Carbon fiber chest logo & Matte-red back logo)
    const chestEmblem = new THREE.MeshStandardMaterial({
      color: '#020204',
      roughness: 0.18,
      metalness: 0.85,
    });

    const backEmblem = new THREE.MeshStandardMaterial({
      color: '#B30000',
      roughness: 0.5,
      metalness: 0.1,
    });

    // SECTION 7: Practical Hardware (Brushed gunmetal, machined aluminum, brass)
    const gunmetalHardware = new THREE.MeshStandardMaterial({
      color: '#2a2d34',
      roughness: 0.28,
      metalness: 0.92,
    });

    const brassNozzle = new THREE.MeshStandardMaterial({
      color: '#d4af37',
      roughness: 0.22,
      metalness: 0.85,
    });

    const triggerPad = new THREE.MeshStandardMaterial({
      color: '#0a0a0c',
      roughness: 0.5,
      metalness: 0.4,
    });

    return {
      crimsonFabric,
      navyFabric,
      raisedWebbing,
      ocularGlass,
      lensRimFrame,
      chestEmblem,
      backEmblem,
      gunmetalHardware,
      brassNozzle,
      triggerPad,
    };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);

    // Sync root to player physics position
    if (playerPosRef?.current && rootRef.current) {
      rootRef.current.position.copy(playerPosRef.current);
    }

    const time  = performance.now() * 0.001;
    const breath = Math.sin(time * 2.2);

    // ─────────────────────────────────────────────────────────────────────
    // A. FLIGHT — Section 2: Pitch-Clamped Aerodynamic Flight Quaternion
    // ─────────────────────────────────────────────────────────────────────
    if (state === 'FLIGHT' && velocityRef?.current && rootRef.current) {
      const vel   = velocityRef.current;
      const speed = vel.length();

      if (speed > 0.5) {
        // Section 2-008: Copy and clamp the downward pitch component
        _flightDir.current.copy(vel).normalize();
        _flightDir.current.y = Math.max(_flightDir.current.y, -0.5); // clamp: never straight-down faceplant
        _flightDir.current.normalize(); // re-normalize after clamping

        // Section 2-009/010: Look-target slightly ahead along clamped flight direction
        _flightTgt.current
          .copy(rootRef.current.position)
          .add(_flightDir.current);

        // Build quaternion via Matrix4.lookAt — strict Up so head stays up, never inverts
        _lookMat.current.lookAt(
          rootRef.current.position,
          _flightTgt.current,
          _worldUp.current, // Section 2-010: strict (0,1,0) prevents roll/flip
        );
        _targetQuat.current.setFromRotationMatrix(_lookMat.current);

        // Smooth slerp — 0.1 factor for cinematic motion
        rootRef.current.quaternion.slerp(_targetQuat.current, 0.1);

        // Section 2 addendum: Turn banking via cross product (lateral feel ±35°)
        // Applied as a LOCAL Z-axis rotation AFTER the quaternion slerp so it
        // doesn't fight the quaternion's Up constraint.
        const cross = vel.z * prevVel.current.x - vel.x * prevVel.current.z;
        const bank  = THREE.MathUtils.clamp(cross * 20, -0.61, 0.61);
        // Inject bank as a local Euler Z on the root — this composites on top of
        // the quaternion yaw/pitch without overriding the constrained Up
        const currentEuler = new THREE.Euler().setFromQuaternion(rootRef.current.quaternion, 'YXZ');
        currentEuler.z = THREE.MathUtils.lerp(currentEuler.z, bank, 6 * dt);
        rootRef.current.quaternion.setFromEuler(currentEuler);
      } else {
        // Low-speed: gently restore upright
        rootRef.current.quaternion.slerp(
          _targetQuat.current.set(0, 0, 0, 1), // identity
          2 * dt,
        );
      }
      prevVel.current.copy(vel);

      // Aerodynamic limb streamline pose
      if (hipsRef.current) { hipsRef.current.rotation.set(-0.65, 0, 0); hipsRef.current.position.set(0, 0.1, 0); }
      if (spineRef.current)  spineRef.current.rotation.set(0.28, 0, 0);
      if (chestRef.current)  chestRef.current.rotation.set(0.18, 0, 0);
      if (lShoulderRef.current) lShoulderRef.current.rotation.set(-0.82, 0.2, -0.28);
      if (lUpperArmRef.current) lUpperArmRef.current.rotation.set(0.38, -0.2, -0.32);
      if (rShoulderRef.current) rShoulderRef.current.rotation.set(-0.82, -0.2, 0.28);
      if (rUpperArmRef.current) rUpperArmRef.current.rotation.set(0.38, 0.2, 0.32);
      if (lThighRef.current) lThighRef.current.rotation.set(0.6, 0.18, -0.16);
      if (lShinRef.current)  lShinRef.current.rotation.set(-0.4, 0, 0);
      if (rThighRef.current) rThighRef.current.rotation.set(0.42, -0.18, 0.16);
      if (rShinRef.current)  rShinRef.current.rotation.set(-0.58, 0, 0);

    // ─────────────────────────────────────────────────────────────────────
    // B. AIMING — Section 1: Flat-Plane Yaw-Only Quaternion (no pitch/roll)
    // ─────────────────────────────────────────────────────────────────────
    } else if (state === 'AIMING' && anchorPointRef?.current && rootRef.current) {
      const anchor = anchorPointRef.current;
      const p = playerPosRef?.current ?? rootRef.current.position;
      const t = THREE.MathUtils.clamp(tension, 0, 1);

      // Section 1-003: Flatten the target to avatar's Y — eliminates all pitch/roll
      _flatTarget.current.set(
        anchor.x,
        p.y, // <- critical: shares exact Y so lookAt never tilts the body
        anchor.z,
      );

      // Guard: skip if avatar is already on top of the anchor (avoid NaN lookAt)
      const horizDist = Math.sqrt(
        (anchor.x - p.x) ** 2 + (anchor.z - p.z) ** 2
      );
      if (horizDist > 0.1) {
        // Section 1-004: Build flat-plane lookAt quaternion
        _lookMat.current.lookAt(
          p,                  // from: avatar position
          _flatTarget.current, // to: anchor projected flat
          _worldUp.current,   // up: strict (0,1,0)
        );
        _targetQuat.current.setFromRotationMatrix(_lookMat.current);

        // Smooth yaw slerp — 0.15 for responsive but not snappy tracking
        rootRef.current.quaternion.slerp(_targetQuat.current, Math.min(0.15, 12 * dt));
      }

      // Section 1-005: Optional backward lean based on tension (clamped ±0.2 rad)
      // Extract current Euler, inject lean only on X, re-apply to avoid fighting quat
      const e = new THREE.Euler().setFromQuaternion(rootRef.current.quaternion, 'YXZ');
      e.x = THREE.MathUtils.clamp(THREE.MathUtils.lerp(e.x, -t * 0.18, 8 * dt), -0.2, 0.2);
      rootRef.current.quaternion.setFromEuler(e);

      // Coiled predatory slingshot tension crouch
      if (hipsRef.current) { hipsRef.current.rotation.set(t * 0.42, 0, 0); hipsRef.current.position.set(0, -0.24 - t * 0.22, -t * 0.55); }
      if (spineRef.current)  spineRef.current.rotation.set(-0.18 + t * 0.35, 0, 0);
      if (chestRef.current)  chestRef.current.rotation.set(-0.28 + t * 0.42, 0, 0);

      // Right arm raised aiming toward anchor
      if (rShoulderRef.current) rShoulderRef.current.rotation.set(0.95 + t * 0.45, -0.58, 0.35);
      if (rUpperArmRef.current) rUpperArmRef.current.rotation.set(-1.15 - t * 0.45, 0.28, 0.55);
      if (rForearmRef.current)  rForearmRef.current.rotation.set(-0.5, -0.35, -0.75);

      // Left arm and legs compressed under kinetic strain
      if (lShoulderRef.current) lShoulderRef.current.rotation.set(-0.55 - t * 0.35, 0.58, -0.35);
      if (lUpperArmRef.current) lUpperArmRef.current.rotation.set(0.45 + t * 0.35, -0.25, -0.5);
      if (lThighRef.current) lThighRef.current.rotation.set(-1.18 - t * 0.38, 0.58, -0.58);
      if (lShinRef.current)  lShinRef.current.rotation.set(2.0 + t * 0.38, -0.18, 0.28);
      if (rThighRef.current) rThighRef.current.rotation.set(-1.18 - t * 0.38, -0.58, 0.58);
      if (rShinRef.current)  rShinRef.current.rotation.set(2.0 + t * 0.38, 0.18, -0.28);

    // ─────────────────────────────────────────────────────────────────────
    // C. IDLE — Predatory Low Arachnid Crouch with Micro-Breathing
    // ─────────────────────────────────────────────────────────────────────
    } else if (rootRef.current) {
      // Smoothly restore rotation toward identity (upright)
      rootRef.current.quaternion.slerp(
        _targetQuat.current.set(0, 0, 0, 1),
        4 * dt,
      );

      // Deep athletic crouch posture
      if (hipsRef.current)  { hipsRef.current.position.set(0, -0.22 + breath * 0.02, 0); hipsRef.current.rotation.set(0.1, 0, 0); }
      if (spineRef.current)  spineRef.current.rotation.set(-0.4 + breath * 0.03, 0, Math.sin(time * 1.1) * 0.015);
      if (chestRef.current)  chestRef.current.rotation.set(-0.2 + breath * 0.02, 0, 0);

      // Arms in athletic defensive poise
      if (lShoulderRef.current) lShoulderRef.current.rotation.set(0.35,  0.32, -0.42);
      if (lUpperArmRef.current) lUpperArmRef.current.rotation.set(-0.65, -0.42, -0.72);
      if (lForearmRef.current)  lForearmRef.current.rotation.set(-0.75, 0.25, 0.35);

      if (rShoulderRef.current) rShoulderRef.current.rotation.set(0.35, -0.32, 0.42);
      if (rUpperArmRef.current) rUpperArmRef.current.rotation.set(-0.65,  0.42, 0.72);
      if (rForearmRef.current)  rForearmRef.current.rotation.set(-0.75, -0.25, -0.35);

      // Wide low-stance bent legs
      if (lThighRef.current) lThighRef.current.rotation.set(-0.85, 0.55, -0.65);
      if (lShinRef.current)  lShinRef.current.rotation.set(1.65, -0.2, 0.32);
      if (lFootRef.current)  lFootRef.current.rotation.set(-0.55, 0.12, 0.22);

      if (rThighRef.current) rThighRef.current.rotation.set(-0.85, -0.55, 0.65);
      if (rShinRef.current)  rShinRef.current.rotation.set(1.65, 0.2, -0.32);
      if (rFootRef.current)  rFootRef.current.rotation.set(-0.55, -0.12, -0.22);

      if (headRef.current) {
        headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, 0, 3 * dt);
        headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, 0.15, 3 * dt);
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Section 3: Wrist Web Origin — rotated local offset, NOT chest center
    // ─────────────────────────────────────────────────────────────────────
    if (rootRef.current && rightHandWorldPosRef) {
      // Local right-wrist offset: x+1 (right side), y+1 (raised arm), z-0.5 (forward)
      _wristOffset.current.set(1.0, 1.0, -0.5);
      // Rotate the local offset by the root's current world quaternion
      _wristOffset.current.applyQuaternion(rootRef.current.quaternion);
      // Add to avatar's world position → true wrist world position
      rightHandWorldPosRef.current
        .copy(rootRef.current.position)
        .add(_wristOffset.current);
    }

    // Head tracking toward anchor (AIMING only)
    if (state === 'AIMING' && anchorPointRef?.current && headRef.current && rootRef.current) {
      const p  = playerPosRef?.current ?? rootRef.current.position;
      const a  = anchorPointRef.current;
      const ax = a.x - p.x;
      const ay = a.y - p.y;
      const az = a.z - p.z;
      headRef.current.rotation.y = THREE.MathUtils.lerp(
        headRef.current.rotation.y,
        Math.atan2(ax, az) * 0.45,
        8 * dt,
      );
      headRef.current.rotation.x = THREE.MathUtils.lerp(
        headRef.current.rotation.x,
        -Math.atan2(ay, Math.sqrt(ax * ax + az * az)) * 0.35,
        8 * dt,
      );
    }
  });


  return (
    <group ref={rootRef}>
      {/* --- PELVIS & HIPS ROOT --- */}
      <group ref={hipsRef}>
        {/* Crimson Pelvis Block */}
        <mesh castShadow receiveShadow material={mats.crimsonFabric}>
          <boxGeometry args={[0.56, 0.32, 0.42]} />
        </mesh>

        {/* 3D Raised Webbing Over Hips */}
        <mesh position={[0, 0, 0.215]} material={mats.raisedWebbing}>
          <boxGeometry args={[0.54, 0.02, 0.015]} />
        </mesh>
        <mesh position={[0, -0.08, 0.215]} material={mats.raisedWebbing}>
          <boxGeometry args={[0.54, 0.02, 0.015]} />
        </mesh>

        {/* --- SPINE & ABDOMINAL WAIST --- */}
        <group ref={spineRef} position={[0, 0.22, 0]}>
          <mesh castShadow receiveShadow material={mats.navyFabric}>
            <cylinderGeometry args={[0.23, 0.22, 0.35, 16]} />
          </mesh>

          {/* Lateral Abdominal Web Accents */}
          <mesh position={[0, 0, 0.12]} material={mats.raisedWebbing}>
            <cylinderGeometry args={[0.235, 0.225, 0.02, 16]} />
          </mesh>

          {/* --- THORAX & MUSCULAR V-TAPER CHEST --- */}
          <group ref={chestRef} position={[0, 0.3, 0]}>
            {/* Crimson Pectoral Block */}
            <mesh castShadow receiveShadow material={mats.crimsonFabric} position={[0, 0.05, 0]}>
              <boxGeometry args={[0.68, 0.48, 0.46]} />
            </mesh>

            {/* Midnight Navy Lat Side Panels */}
            <mesh castShadow material={mats.navyFabric} position={[-0.29, 0, 0]}>
              <boxGeometry args={[0.14, 0.46, 0.44]} />
            </mesh>
            <mesh castShadow material={mats.navyFabric} position={[0.29, 0, 0]}>
              <boxGeometry args={[0.14, 0.46, 0.44]} />
            </mesh>

            {/* SECTION 4: 3D Raised Black Webbing on Chest */}
            {/* Horizontal concentric lines */}
            <mesh position={[0, 0.16, 0.236]} material={mats.raisedWebbing}>
              <boxGeometry args={[0.66, 0.02, 0.015]} />
            </mesh>
            <mesh position={[0, 0.06, 0.236]} material={mats.raisedWebbing}>
              <boxGeometry args={[0.66, 0.02, 0.015]} />
            </mesh>
            <mesh position={[0, -0.04, 0.236]} material={mats.raisedWebbing}>
              <boxGeometry args={[0.66, 0.02, 0.015]} />
            </mesh>
            <mesh position={[0, -0.14, 0.236]} material={mats.raisedWebbing}>
              <boxGeometry args={[0.66, 0.02, 0.015]} />
            </mesh>
            {/* Radiating diagonal web lines */}
            <mesh position={[-0.18, 0.05, 0.236]} rotation={[0, 0, 0.4]} material={mats.raisedWebbing}>
              <boxGeometry args={[0.02, 0.46, 0.015]} />
            </mesh>
            <mesh position={[0.18, 0.05, 0.236]} rotation={[0, 0, -0.4]} material={mats.raisedWebbing}>
              <boxGeometry args={[0.02, 0.46, 0.015]} />
            </mesh>

            {/* SECTION 6: Front Chest Emblem (Aggressive Geometric Black Spider) */}
            <group position={[0, 0.06, 0.245]}>
              {/* Spider Thorax & Abdomen */}
              <mesh material={mats.chestEmblem}>
                <boxGeometry args={[0.07, 0.14, 0.02]} />
              </mesh>
              {/* Top 4 Legs (Angled Sharp Upward) */}
              <mesh position={[-0.1, 0.06, 0]} rotation={[0, 0, 0.7]} material={mats.chestEmblem}>
                <boxGeometry args={[0.14, 0.02, 0.018]} />
              </mesh>
              <mesh position={[-0.14, 0.1, 0]} rotation={[0, 0, 1.2]} material={mats.chestEmblem}>
                <boxGeometry args={[0.12, 0.02, 0.018]} />
              </mesh>
              <mesh position={[0.1, 0.06, 0]} rotation={[0, 0, -0.7]} material={mats.chestEmblem}>
                <boxGeometry args={[0.14, 0.02, 0.018]} />
              </mesh>
              <mesh position={[0.14, 0.1, 0]} rotation={[0, 0, -1.2]} material={mats.chestEmblem}>
                <boxGeometry args={[0.12, 0.02, 0.018]} />
              </mesh>
              {/* Bottom 4 Legs (Angled Sharp Downward) */}
              <mesh position={[-0.09, -0.06, 0]} rotation={[0, 0, -0.6]} material={mats.chestEmblem}>
                <boxGeometry args={[0.14, 0.02, 0.018]} />
              </mesh>
              <mesh position={[-0.13, -0.1, 0]} rotation={[0, 0, -1.1]} material={mats.chestEmblem}>
                <boxGeometry args={[0.13, 0.02, 0.018]} />
              </mesh>
              <mesh position={[0.09, -0.06, 0]} rotation={[0, 0, 0.6]} material={mats.chestEmblem}>
                <boxGeometry args={[0.14, 0.02, 0.018]} />
              </mesh>
              <mesh position={[0.13, -0.1, 0]} rotation={[0, 0, 1.1]} material={mats.chestEmblem}>
                <boxGeometry args={[0.13, 0.02, 0.018]} />
              </mesh>
            </group>

            {/* SECTION 6: Back Emblem (Classic Tick-like Red Spider on Navy Back Panel) */}
            <group position={[0, 0.05, -0.24]}>
              <mesh material={mats.backEmblem}>
                <capsuleGeometry args={[0.08, 0.12, 8, 16]} />
              </mesh>
              <mesh position={[-0.1, 0.04, 0]} rotation={[0, 0, 0.5]} material={mats.backEmblem}>
                <boxGeometry args={[0.12, 0.03, 0.015]} />
              </mesh>
              <mesh position={[0.1, 0.04, 0]} rotation={[0, 0, -0.5]} material={mats.backEmblem}>
                <boxGeometry args={[0.12, 0.03, 0.015]} />
              </mesh>
              <mesh position={[-0.09, -0.05, 0]} rotation={[0, 0, -0.5]} material={mats.backEmblem}>
                <boxGeometry args={[0.11, 0.03, 0.015]} />
              </mesh>
              <mesh position={[0.09, -0.05, 0]} rotation={[0, 0, 0.5]} material={mats.backEmblem}>
                <boxGeometry args={[0.11, 0.03, 0.015]} />
              </mesh>
            </group>

            {/* --- NECK --- */}
            <group ref={neckRef} position={[0, 0.3, 0]}>
              <mesh castShadow material={mats.crimsonFabric}>
                <cylinderGeometry args={[0.12, 0.14, 0.16, 16]} />
              </mesh>

              {/* --- HEAD & VACUUM-SEALED MASK --- */}
              <group ref={headRef} position={[0, 0.18, 0.04]}>
                {/* Skull Base with Defined Jawline Contour */}
                <mesh castShadow material={mats.crimsonFabric}>
                  <sphereGeometry args={[0.22, 28, 28]} scale={[1, 1.25, 1.15]} />
                </mesh>

                {/* 3D Raised Concentric Web Lines Over Skull */}
                <mesh position={[0, 0, 0.22]} material={mats.raisedWebbing}>
                  <torusGeometry args={[0.12, 0.007, 8, 24]} />
                </mesh>
                <mesh position={[0, 0, 0.2]} material={mats.raisedWebbing}>
                  <torusGeometry args={[0.18, 0.007, 8, 24]} />
                </mesh>
                <mesh position={[0, 0.12, 0.14]} rotation={[0.4, 0, 0]} material={mats.raisedWebbing}>
                  <torusGeometry args={[0.16, 0.007, 8, 24]} />
                </mesh>

                {/* SECTION 5: Left Ocular Lens (Angular Teardrop + Micro-Shutter Rim) */}
                <group position={[-0.09, 0.04, 0.2]} rotation={[-0.1, -0.3, 0.15]}>
                  {/* Outer Mechanical Rim Frame */}
                  <mesh material={mats.lensRimFrame}>
                    <coneGeometry args={[0.088, 0.03, 4]} rotation={[Math.PI / 2, 0, Math.PI / 4]} />
                  </mesh>
                  {/* Micro-Perforated Mirror Glass */}
                  <mesh material={mats.ocularGlass} position={[0, 0, 0.012]}>
                    <coneGeometry args={[0.075, 0.02, 4]} rotation={[Math.PI / 2, 0, Math.PI / 4]} />
                  </mesh>
                </group>

                {/* SECTION 5: Right Ocular Lens */}
                <group position={[0.09, 0.04, 0.2]} rotation={[-0.1, 0.3, -0.15]}>
                  <mesh material={mats.lensRimFrame}>
                    <coneGeometry args={[0.088, 0.03, 4]} rotation={[Math.PI / 2, 0, Math.PI / 4]} />
                  </mesh>
                  <mesh material={mats.ocularGlass} position={[0, 0, 0.012]}>
                    <coneGeometry args={[0.075, 0.02, 4]} rotation={[Math.PI / 2, 0, Math.PI / 4]} />
                  </mesh>
                </group>
              </group>
            </group>

            {/* --- LEFT ARM & WEB-SHOOTER --- */}
            <group ref={lShoulderRef} position={[-0.38, 0.18, 0]}>
              <mesh castShadow material={mats.crimsonFabric}>
                <sphereGeometry args={[0.13, 16, 16]} />
              </mesh>
              <group ref={lUpperArmRef} position={[-0.12, -0.12, 0]}>
                <mesh castShadow material={mats.navyFabric} position={[0, -0.15, 0]}>
                  <capsuleGeometry args={[0.09, 0.28, 8, 16]} />
                </mesh>
                <group ref={lForearmRef} position={[0, -0.34, 0]}>
                  {/* Crimson Forearm Gauntlet */}
                  <mesh castShadow material={mats.crimsonFabric} position={[0, -0.16, 0]}>
                    <capsuleGeometry args={[0.08, 0.30, 8, 16]} />
                  </mesh>

                  {/* Left Hand */}
                  <group ref={lHandRef} position={[0, -0.34, 0]}>
                    <mesh castShadow material={mats.crimsonFabric}>
                      <boxGeometry args={[0.10, 0.14, 0.06]} />
                    </mesh>

                    {/* SECTION 7: Left Mechanical Web-Shooter Hardware */}
                    <group position={[-0.04, 0.03, 0]}>
                      {/* Gunmetal Base Bracket */}
                      <mesh material={mats.gunmetalHardware}>
                        <boxGeometry args={[0.04, 0.06, 0.07]} />
                      </mesh>
                      {/* Fluid Cartridge Cylinder */}
                      <mesh position={[-0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.gunmetalHardware}>
                        <cylinderGeometry args={[0.012, 0.012, 0.05, 12]} />
                      </mesh>
                      {/* Machined Brass Ejection Nozzle */}
                      <mesh position={[-0.01, -0.04, 0]} material={mats.brassNozzle}>
                        <cylinderGeometry args={[0.008, 0.012, 0.02, 12]} />
                      </mesh>
                    </group>

                    {/* Palm Pressure Trigger Pad */}
                    <mesh position={[0, -0.02, 0.032]} material={mats.triggerPad}>
                      <boxGeometry args={[0.04, 0.04, 0.008]} />
                    </mesh>
                  </group>
                </group>
              </group>
            </group>

            {/* --- RIGHT ARM & WEB-SHOOTER --- */}
            <group ref={rShoulderRef} position={[0.38, 0.18, 0]}>
              <mesh castShadow material={mats.crimsonFabric}>
                <sphereGeometry args={[0.13, 16, 16]} />
              </mesh>
              <group ref={rUpperArmRef} position={[0.12, -0.12, 0]}>
                <mesh castShadow material={mats.navyFabric} position={[0, -0.15, 0]}>
                  <capsuleGeometry args={[0.09, 0.28, 8, 16]} />
                </mesh>
                <group ref={rForearmRef} position={[0, -0.34, 0]}>
                  {/* Crimson Forearm Gauntlet */}
                  <mesh castShadow material={mats.crimsonFabric} position={[0, -0.16, 0]}>
                    <capsuleGeometry args={[0.08, 0.30, 8, 16]} />
                  </mesh>

                  {/* Right Hand (Shooting Hand) */}
                  <group ref={rHandRef} position={[0, -0.34, 0]}>
                    <mesh castShadow material={mats.crimsonFabric}>
                      <boxGeometry args={[0.10, 0.14, 0.06]} />
                    </mesh>

                    {/* SECTION 7: Right Mechanical Web-Shooter Hardware */}
                    <group position={[0.04, 0.03, 0]}>
                      {/* Gunmetal Base Bracket */}
                      <mesh material={mats.gunmetalHardware}>
                        <boxGeometry args={[0.04, 0.06, 0.07]} />
                      </mesh>
                      {/* Fluid Cartridge Cylinder */}
                      <mesh position={[0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.gunmetalHardware}>
                        <cylinderGeometry args={[0.012, 0.012, 0.05, 12]} />
                      </mesh>
                      {/* Machined Brass Ejection Nozzle */}
                      <mesh position={[0.01, -0.04, 0]} material={mats.brassNozzle}>
                        <cylinderGeometry args={[0.008, 0.012, 0.02, 12]} />
                      </mesh>
                    </group>

                    {/* Palm Pressure Trigger Pad */}
                    <mesh position={[0, -0.02, 0.032]} material={mats.triggerPad}>
                      <boxGeometry args={[0.04, 0.04, 0.008]} />
                    </mesh>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>

        {/* --- LEFT LEG & TACTICAL BOOT --- */}
        <group ref={lThighRef} position={[-0.22, -0.1, 0]}>
          <mesh castShadow material={mats.navyFabric} position={[0, -0.25, 0]}>
            <capsuleGeometry args={[0.12, 0.45, 8, 16]} />
          </mesh>
          <group ref={lShinRef} position={[0, -0.52, 0]}>
            {/* Crimson Tactical Boot Paneling */}
            <mesh castShadow material={mats.crimsonFabric} position={[0, -0.26, 0]}>
              <capsuleGeometry args={[0.10, 0.46, 8, 16]} />
            </mesh>
            <group ref={lFootRef} position={[0, -0.52, 0.08]}>
              <mesh castShadow material={mats.crimsonFabric}>
                <boxGeometry args={[0.12, 0.09, 0.24]} />
              </mesh>
            </group>
          </group>
        </group>

        {/* --- RIGHT LEG & TACTICAL BOOT --- */}
        <group ref={rThighRef} position={[0.22, -0.1, 0]}>
          <mesh castShadow material={mats.navyFabric} position={[0, -0.25, 0]}>
            <capsuleGeometry args={[0.12, 0.45, 8, 16]} />
          </mesh>
          <group ref={rShinRef} position={[0, -0.52, 0]}>
            {/* Crimson Tactical Boot Paneling */}
            <mesh castShadow material={mats.crimsonFabric} position={[0, -0.26, 0]}>
              <capsuleGeometry args={[0.10, 0.46, 8, 16]} />
            </mesh>
            <group ref={rFootRef} position={[0, -0.52, 0.08]}>
              <mesh castShadow material={mats.crimsonFabric}>
                <boxGeometry args={[0.12, 0.09, 0.24]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
