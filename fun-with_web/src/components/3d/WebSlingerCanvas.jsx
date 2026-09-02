import React, { Suspense, useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cityColliders } from './cityColliders.js';
import { SpiderManAvatar } from './SpiderManAvatar.jsx';
import { CityGrid } from './CityGrid.jsx';
import { MissionTargets } from './MissionTargets.jsx';
import { WebLine } from './WebLine.jsx';
import { TacticalHUD } from '../TacticalHUD.jsx';
import { TacticalRadar } from '../TacticalRadar.jsx';

// ─────────────────────────────────────────────────────────────────
// Physics & collision constants
// ─────────────────────────────────────────────────────────────────
const COLLISION_RADIUS = 3.5;
const Y_FLOOR          = 1.0;
const Y_CEILING        = 95.0;
const SPRING_CONSTANT  = 2.8;
const DRAG_SENSITIVITY = 0.006;

// FOV constants (Section 3)
const FOV_BASE  = 70;
const FOV_MAX   = 110;

// Camera rig offset constants
const CAM_IDLE_BACK  = 18;  // units behind avatar in idle
const CAM_IDLE_UP    = 7;   // units above avatar in idle
const CAM_FLIGHT_BACK = 25; // units behind avatar during flight
const CAM_FLIGHT_UP   = 8;  // units above during flight
const CAM_AIM_FORWARD = 5;  // forward push toward anchor in aim shot
const CAM_AIM_SIDE    = 15; // lateral offset for 3/4 profile shot
const CAM_AIM_UP      = 4;  // height raise during aim shot

// Global Up vector (reused, never mutated)
const WORLD_UP = new THREE.Vector3(0, 1, 0);

// ─────────────────────────────────────────────────────────────────
// Mission target positions
// ─────────────────────────────────────────────────────────────────
const EMERGENCIES = [
  { id: 'em-1', pos: [60, 30, -80] },
  { id: 'em-2', pos: [-80, 45, 60] },
  { id: 'em-3', pos: [40, 25, 100] },
];
const CIVILIANS = [
  { id: 'civ-1', pos: [-50, 40, -60] },
  { id: 'civ-2', pos: [75, 55, 35] },
  { id: 'civ-3', pos: [-65, 35, 25] },
  { id: 'civ-4', pos: [30, 60, -90] },
  { id: 'civ-5', pos: [-30, 28, 85] },
];
const DESTINATIONS = [
  { id: 'dest-1', pos: [0, 80, -150],  name: 'Daily Bugle Tower' },
  { id: 'dest-2', pos: [-130, 90, -25], name: 'Oscorp Spire' },
];

// ─────────────────────────────────────────────────────────────────
// AAA CINEMATIC ACTION CAMERA RIG
// Section 1: 3/4 Profile Shot while grappling
// Section 2: Slingshot Swoop trailing velocity
// Section 3: Adrenaline FOV speed-warp
// Section 4: OrbitControls NOT used — full cinematic override
// ─────────────────────────────────────────────────────────────────
function ActionCameraRig({
  playerPosRef,
  velocityRef,
  anchorPointRef,
  isGrappling,
  playerStateRef,
  cameraShakeRef,
  playerFacingRef,
}) {
  // Reusable scratch vectors — allocated once, never re-created
  const _aimDir     = useRef(new THREE.Vector3());
  const _rightVec   = useRef(new THREE.Vector3());
  const _flightDir  = useRef(new THREE.Vector3());
  const _targetPos  = useRef(new THREE.Vector3());
  const _lookTarget = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const dt  = Math.min(delta, 0.08);
    const cam = state.camera;
    const pos = playerPosRef.current;   // avatar world position
    const vel = velocityRef.current;    // current velocity vector
    const shk = cameraShakeRef.current;

    const speed = vel.length();

    // ── Section 3: Adrenaline FOV ──────────────────────────────────
    // Base 70°, warps up to 110° at high speed
    const targetFov = THREE.MathUtils.clamp(FOV_BASE + speed * 26, FOV_BASE, FOV_MAX);
    cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 0.1);
    cam.updateProjectionMatrix();

    // ── Section 4: Cinematic camera position logic ─────────────────
    if (isGrappling.current || playerStateRef.current === 'AIMING') {
      // ─────────────────────────────────────────────────────────────
      // SECTION 1: 3/4 PROFILE SHOT — GRAPPLE / AIMING
      // Camera swoops to the side to show the avatar catching the wall
      // ─────────────────────────────────────────────────────────────
      const anchor = anchorPointRef.current;

      // Step 1: aimDir = normalize(anchor - avatar)
      _aimDir.current.subVectors(anchor, pos).normalize();

      // Step 2: rightVec = cross(WorldUp, aimDir).normalize()
      _rightVec.current.crossVectors(WORLD_UP, _aimDir.current);
      const rLen = _rightVec.current.length();
      if (rLen > 0.001) _rightVec.current.divideScalar(rLen); // safe normalize

      // Step 3: targetCamPos = avatar + aimDir*5 + rightVec*15 + up*4
      _targetPos.current
        .copy(pos)
        .addScaledVector(_aimDir.current, CAM_AIM_FORWARD)
        .addScaledVector(_rightVec.current, CAM_AIM_SIDE)
        .addScaledVector(WORLD_UP, CAM_AIM_UP);

      // Step 4: Smoothly lerp camera to 3/4 profile position
      cam.position.lerp(_targetPos.current, Math.min(0.08 + dt * 2, 0.15));

      // Step 5: Always look directly at the avatar
      _lookTarget.current.copy(pos).addScaledVector(WORLD_UP, 1.0);
      cam.lookAt(_lookTarget.current);

    } else if (playerStateRef.current === 'FLIGHT' && speed > 0.08) {
      // ─────────────────────────────────────────────────────────────
      // SECTION 2: SLINGSHOT SWOOP — FLIGHT CHASE
      // Camera trails the velocity vector, looking ahead of flight path
      // ─────────────────────────────────────────────────────────────

      // flightDir = normalize(velocity)
      _flightDir.current.copy(vel).normalize();

      // targetCamPos = avatar - flightDir*25 + up*8
      _targetPos.current
        .copy(pos)
        .addScaledVector(_flightDir.current, -CAM_FLIGHT_BACK)
        .addScaledVector(WORLD_UP, CAM_FLIGHT_UP);

      // Faster lerp during the slingshot swoop for cinematic snap
      cam.position.lerp(_targetPos.current, 0.1);

      // lookTarget = avatar + flightDir*10 (slightly ahead of travel direction)
      _lookTarget.current
        .copy(pos)
        .addScaledVector(_flightDir.current, 10);
      cam.lookAt(_lookTarget.current);

    } else {
      // ─────────────────────────────────────────────────────────────
      // IDLE — Standard behind-above chase position
      // ─────────────────────────────────────────────────────────────
      _targetPos.current.set(pos.x, pos.y + CAM_IDLE_UP, pos.z + CAM_IDLE_BACK);
      cam.position.lerp(_targetPos.current, 0.06);

      _lookTarget.current.set(pos.x, pos.y + 1.5, pos.z);
      cam.lookAt(_lookTarget.current);
    }

    // ── Camera shake injection (collision impulse) ─────────────────
    if (shk > 0.01) {
      const t = state.clock.getElapsedTime();
      cam.position.x += Math.sin(t * 92) * shk * 0.65;
      cam.position.y += Math.cos(t * 77) * shk * 0.45;
    }
    cameraShakeRef.current = Math.max(0, shk - dt * 3.5);

    // ── Export camera heading for radar ───────────────────────────
    playerFacingRef.current = cam.rotation.y;
  });

  return null;
}

// ─────────────────────────────────────────────────────────────────
// Physics + Collision + Telemetry loop
// ─────────────────────────────────────────────────────────────────
function PhysicsLoop({
  playerPosRef,
  playerStateRef,
  tensionRef,
  velocityRef,
  lightGroupRef,
  cameraShakeRef,
  onTelemetryUpdate,
  villainProximity,
}) {
  const frameCount = useRef(0);
  const lastFpsMs  = useRef(0);
  const fps        = useRef(60);

  useFrame((state, delta) => {
    const dt  = Math.min(delta, 0.1);
    const pos = playerPosRef.current;
    const vel = velocityRef.current;

    // ── 1. Integrate velocity ──────────────────────────────────────
    if (playerStateRef.current === 'FLIGHT') {
      const nextX = pos.x + vel.x * dt * 60;
      const nextY = pos.y + vel.y * dt * 60;
      const nextZ = pos.z + vel.z * dt * 60;

      // ── 2. AABB Wall & Rooftop Collision ─────────────────────────
      let collided = false;
      let landedOnRoof = false;

      for (let i = 0; i < cityColliders.length; i++) {
        const c = cityColliders[i];
        const insideX = nextX >= c.minX && nextX <= c.maxX;
        const insideZ = nextZ >= c.minZ && nextZ <= c.maxZ;
        const roofHeight = c.height;

        // 2.1 Rooftop Landing Detection: if avatar falls onto rooftop plane
        if (insideX && insideZ && pos.y >= roofHeight - 1.0 && nextY <= roofHeight + 0.5) {
          pos.x = nextX;
          pos.z = nextZ;
          pos.y = roofHeight;
          vel.set(0, 0, 0);
          landedOnRoof = true;
          playerStateRef.current = 'IDLE';
          cameraShakeRef.current = 0.35;
          break;
        }

        // 2.2 Side Wall Collision Check
        const nearX = nextX > c.minX - COLLISION_RADIUS && nextX < c.maxX + COLLISION_RADIUS;
        const nearZ = nextZ > c.minZ - COLLISION_RADIUS && nextZ < c.maxZ + COLLISION_RADIUS;
        const belowRoof = nextY < roofHeight;

        if (nearX && nearZ && belowRoof) {
          const dLeft  = Math.abs(nextX - c.minX);
          const dRight = Math.abs(nextX - c.maxX);
          const dFront = Math.abs(nextZ - c.minZ);
          const dBack  = Math.abs(nextZ - c.maxZ);
          const minD   = Math.min(dLeft, dRight, dFront, dBack);

          let nx = 0, nz = 0;
          if (minD === dLeft)       nx = -1;
          else if (minD === dRight) nx =  1;
          else if (minD === dFront) nz = -1;
          else                      nz =  1;

          const dot = vel.x * nx + vel.z * nz;
          if (dot < 0) {
            vel.x -= nx * dot * 1.1;
            vel.z -= nz * dot * 1.1;
          }
          pos.x = c.cx + nx * (c.maxX - c.minX) * 0.5 + nx * (COLLISION_RADIUS + 0.5);
          pos.z = c.cz + nz * (c.maxZ - c.minZ) * 0.5 + nz * (COLLISION_RADIUS + 0.5);
          collided = true;
          cameraShakeRef.current = 0.65;
          break;
        }
      }

      if (!landedOnRoof) {
        if (!collided) { pos.x = nextX; pos.z = nextZ; }
        pos.y = nextY;

        // ── 3. Y boundaries ──────────────────────────────────────────
        vel.y -= 0.009 * dt * 60;
        if (pos.y > Y_CEILING) vel.y -= 0.05 * dt * 60;
        if (pos.y <= Y_FLOOR)  { pos.y = Y_FLOOR; vel.y = Math.abs(vel.y) * 0.3; }

        vel.x *= Math.pow(0.965, dt * 60);
        vel.y *= Math.pow(0.965, dt * 60);
        vel.z *= Math.pow(0.965, dt * 60);

        const spd = vel.length();
        if (spd < 0.05 && pos.y <= Y_FLOOR + 0.2) {
          playerStateRef.current = 'IDLE';
          vel.set(0, 0, 0);
        }
      }
    } else if (playerStateRef.current === 'IDLE') {
      // Check if player is standing on roof and steps off or if gravity should pull
      let onAnyRoof = false;
      for (let i = 0; i < cityColliders.length; i++) {
        const c = cityColliders[i];
        if (pos.x >= c.minX && pos.x <= c.maxX && pos.z >= c.minZ && pos.z <= c.maxZ) {
          if (Math.abs(pos.y - c.height) <= 1.5) {
            pos.y = c.height; // Lock cleanly to rooftop
            onAnyRoof = true;
            break;
          }
        }
      }
      if (!onAnyRoof && pos.y > Y_FLOOR) {
        // Falling off building
        pos.y = Math.max(Y_FLOOR, pos.y - 0.25 * dt * 60);
      }
    }

    // ── 4. Chase lights follow avatar ─────────────────────────────
    if (lightGroupRef.current) {
      lightGroupRef.current.position.set(pos.x, pos.y + 4, pos.z + 5);
    }

    // ── 5. Telemetry (200ms throttle) ─────────────────────────────
    frameCount.current++;
    const now = state.clock.getElapsedTime() * 1000;
    if (now - lastFpsMs.current >= 200) {
      fps.current = Math.round((frameCount.current * 1000) / (now - lastFpsMs.current));
      frameCount.current = 0;
      lastFpsMs.current  = now;
      const spd = vel.length();
      onTelemetryUpdate({
        fps: fps.current,
        playerX: pos.x.toFixed(1),
        playerY: pos.y.toFixed(1),
        playerZ: pos.z.toFixed(1),
        speed: (spd * 12).toFixed(1),
        tension: (tensionRef.current * 100).toFixed(0),
        state: playerStateRef.current,
        villainDist: villainProximity,
      });
    }
  });
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Main Canvas Component
// ─────────────────────────────────────────────────────────────────
export function WebSlingerCanvas() {
  const [telemetry, setTelemetry]    = useState(null);
  const [villainProximity, setVProx] = useState(120);

  // Core physics refs
  const playerPosRef   = useRef(new THREE.Vector3(0, 8, 0));
  const playerStateRef = useRef('IDLE');
  const tensionRef     = useRef(0);
  const velocityRef    = useRef(new THREE.Vector3());

  // Anchor on building surface
  const anchorPointRef = useRef(new THREE.Vector3(-52, 35, -35));
  const [anchorVis, setAnchorVis] = useState([-52, 35, -35]);

  // Wrist world position (output from SpiderManAvatar)
  const rightHandWorldPosRef = useRef(new THREE.Vector3(0, 8, 0));

  // Dual-State Input
  const isGrappling = useRef(false);
  const dragStart   = useRef({ x: 0, y: 0 });

  // Scene refs
  const lightGroupRef   = useRef();
  const cameraShakeRef  = useRef(0);
  const playerFacingRef = useRef(0);

  // JSX-driven display state
  const [activeTension, setActiveTension] = useState(0);
  const [activeState,   setActiveState]   = useState('IDLE');
  const [handPos,       setHandPos]       = useState([0, 8, 0]);
  const [webSag,        setWebSag]        = useState([0, 0, 0]);

  const villainPosRefs = useMemo(() => [
    { current: new THREE.Vector3(14, 25, -14) },
    { current: new THREE.Vector3(-16, 40, -10) },
    { current: new THREE.Vector3(10, 20, 16) },
  ], []);

  // ── Building surface click → enter GRAPPLE state ────────────────
  const handleBuildingClick = useCallback((hitPoint, clientX, clientY) => {
    isGrappling.current   = true;
    dragStart.current     = { x: clientX, y: clientY };
    anchorPointRef.current.copy(hitPoint);
    setAnchorVis([hitPoint.x, hitPoint.y, hitPoint.z]);

    playerStateRef.current = 'AIMING';
    setActiveState('AIMING');
    tensionRef.current = 0.15;
    setActiveTension(0.15);

    const p = playerPosRef.current;
    setHandPos([p.x, p.y + 0.6, p.z]);
    setWebSag([0, -0.3, -0.6]);
  }, []);

  // ── Pointer move / up (Hooke's Law, camera-agnostic) ────────────
  useEffect(() => {
    const onMove = (e) => {
      if (!isGrappling.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      const mag = Math.sqrt(dx * dx + dy * dy) * DRAG_SENSITIVITY;
      const t   = THREE.MathUtils.clamp(mag, 0.1, 1.0);
      tensionRef.current = t;
      setActiveTension(t);

      const p = playerPosRef.current;
      setHandPos([p.x, p.y + 0.8 - t * 0.4, p.z - t * 1.6]);
      setWebSag([0, -t, -t * 2.2]);
    };

    const onUp = (e) => {
      if (!isGrappling.current) return;
      isGrappling.current = false;

      const t = tensionRef.current;
      const p = playerPosRef.current;
      const a = anchorPointRef.current;

      if (t > 0.1) {
        // 3D direction always: anchor → avatar (camera-agnostic)
        const dir = new THREE.Vector3().subVectors(a, p).normalize();
        const dx  = e.clientX - dragStart.current.x;
        const dy  = e.clientY - dragStart.current.y;
        const mag = THREE.MathUtils.clamp(
          Math.sqrt(dx * dx + dy * dy) * DRAG_SENSITIVITY, 0, 1.0
        );
        const impulse = mag * SPRING_CONSTANT;

        velocityRef.current.set(
          dir.x * impulse,
          Math.max(dir.y * impulse, 0.2 + mag * 0.6),
          dir.z * impulse,
        );
        playerStateRef.current = 'FLIGHT';
        setActiveState('FLIGHT');
      } else {
        playerStateRef.current = 'IDLE';
        setActiveState('IDLE');
      }

      tensionRef.current = 0;
      setActiveTension(0);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    };
  }, []);

  const radarTargets = useMemo(() => ({
    emergencies:  EMERGENCIES,
    civilians:    CIVILIANS,
    destinations: DESTINATIONS,
    villains: villainPosRefs.map((ref) => ({ posRef: ref })),
  }), [villainPosRefs]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#020814' }}>
      <Canvas
        shadows
        camera={{ position: [0, 14, 22], fov: FOV_BASE, near: 0.1, far: 2000 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        style={{
          width: '100%', height: '100%',
          cursor: activeState === 'AIMING' ? 'grabbing' : 'crosshair',
        }}
      >
        <fogExp2 attach="fog" args={['#020814', 0.0035]} />
        <ambientLight intensity={0.45} />

        {/* Dynamic chase lighting group (position mutated in PhysicsLoop) */}
        <group ref={lightGroupRef} position={[0, 12, 5]}>
          {/* Key Light: Stark cyan neon on right flank */}
          <pointLight position={[6, 3, -2]} color="#00e5ff" intensity={4.2} distance={70} decay={1.8} />
          {/* Rim Light: Aggressive magenta/red on left edge */}
          <pointLight position={[-6, 3, -2]} color="#ff1744" intensity={3.8} distance={70} decay={1.8} />
          <directionalLight
            position={[14, 30, 14]}
            intensity={1.9}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-80}
            shadow-camera-right={80}
            shadow-camera-top={80}
            shadow-camera-bottom={-80}
            shadow-bias={-0.0001}
          />
        </group>

        {/*
          Section 4: OrbitControls REMOVED — ActionCameraRig has full
          exclusive control of camera.position and camera.lookAt every frame.
          No other system fights it.
        */}
        <ActionCameraRig
          playerPosRef={playerPosRef}
          velocityRef={velocityRef}
          anchorPointRef={anchorPointRef}
          isGrappling={isGrappling}
          playerStateRef={playerStateRef}
          cameraShakeRef={cameraShakeRef}
          playerFacingRef={playerFacingRef}
        />

        <Suspense fallback={null}>
          {/* Avatar: body slerps toward anchor, wrist-anchored web origin */}
          <SpiderManAvatar
            state={activeState}
            tension={activeTension}
            playerPosRef={playerPosRef}
            velocityRef={velocityRef}
            anchorPointRef={anchorPointRef}
            rightHandWorldPosRef={rightHandWorldPosRef}
          />

          {/* Dual web strands while AIMING */}
          {activeState === 'AIMING' && (
            <>
              <WebLine start={anchorVis} end={handPos} tension={activeTension} pullSag={webSag} />
              <WebLine
                start={anchorVis}
                end={[handPos[0] - 0.9, handPos[1], handPos[2]]}
                tension={activeTension}
                pullSag={webSag}
              />
              {/* Anchor surface impact marker */}
              <group position={anchorVis}>
                <pointLight color="#ff0000" intensity={5} distance={22} />
                <mesh>
                  <sphereGeometry args={[0.45, 14, 14]} />
                  <meshBasicMaterial color="#ff1744" />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.65, 1.05, 22]} />
                  <meshBasicMaterial color="#00e5ff" side={THREE.DoubleSide} />
                </mesh>
              </group>
            </>
          )}

          {/* Infinite 2D toroidal city + AABB collision */}
          <CityGrid
            playerPosRef={playerPosRef}
            onBuildingPointerDown={(hitPoint, clientX, clientY) =>
              handleBuildingClick(hitPoint, clientX, clientY)
            }
          />

          {/* Mission targets */}
          <MissionTargets
            playerPosRef={playerPosRef}
            onProximityUpdate={setVProx}
          />

          {/* Physics: collision, Y-bounds, gravity, lights, telemetry */}
          <PhysicsLoop
            playerPosRef={playerPosRef}
            playerStateRef={playerStateRef}
            tensionRef={tensionRef}
            velocityRef={velocityRef}
            lightGroupRef={lightGroupRef}
            cameraShakeRef={cameraShakeRef}
            onTelemetryUpdate={setTelemetry}
            villainProximity={villainProximity}
          />
        </Suspense>
      </Canvas>

      <TacticalRadar
        playerPosRef={playerPosRef}
        playerFacingRef={playerFacingRef}
        targets={radarTargets}
      />

      <TacticalHUD telemetry={telemetry} />

      {/* Contextual control hint */}
      <div style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '10px',
        color: 'rgba(0,229,255,0.5)',
        letterSpacing: '1.5px',
        pointerEvents: 'none',
        lineHeight: '1.8',
        textAlign: 'right',
      }}>
        <div>🕸️ CLICK BUILDING → GRAPPLE + DRAG</div>
        <div>⚡ RELEASE → SLINGSHOT LAUNCH</div>
      </div>
    </div>
  );
}
