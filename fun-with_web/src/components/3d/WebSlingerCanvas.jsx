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

// ─────────────────────────────────────────────────────────────────
// Mission target positions (mirrors MissionTargets.jsx)
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
// Physics loop: inside Canvas — no React state mutations
// ─────────────────────────────────────────────────────────────────
function PhysicsLoop({
  playerPosRef,
  playerStateRef,
  tensionRef,
  velocityRef,
  lightGroupRef,
  playerFacingRef,
  cameraShakeRef,
  onTelemetryUpdate,
  villainProximity,
}) {
  const camTarget = useRef(new THREE.Vector3());
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

      // ── 2. AABB Wall Collision ───────────────────────────────────
      let collided = false;
      for (let i = 0; i < cityColliders.length; i++) {
        const c = cityColliders[i];
        const insideX = nextX > c.minX - COLLISION_RADIUS && nextX < c.maxX + COLLISION_RADIUS;
        const insideZ = nextZ > c.minZ - COLLISION_RADIUS && nextZ < c.maxZ + COLLISION_RADIUS;
        const aboveGround = nextY < c.height; // not above rooftop

        if (insideX && insideZ && aboveGround) {
          // Determine closest face normal
          const dLeft  = Math.abs(nextX - c.minX);
          const dRight = Math.abs(nextX - c.maxX);
          const dFront = Math.abs(nextZ - c.minZ);
          const dBack  = Math.abs(nextZ - c.maxZ);
          const minD   = Math.min(dLeft, dRight, dFront, dBack);

          let nx = 0, nz = 0;
          if (minD === dLeft)  nx = -1;
          else if (minD === dRight) nx = 1;
          else if (minD === dFront) nz = -1;
          else nz = 1;

          // Arrest inward velocity component
          const dot = vel.x * nx + vel.z * nz;
          if (dot < 0) {
            vel.x -= nx * dot * 1.1; // slight elastic bounce
            vel.z -= nz * dot * 1.1;
          }

          // Push player out of wall
          pos.x = c.cx + nx * (c.maxX - c.minX) * 0.5 + nx * (COLLISION_RADIUS + 0.5);
          pos.z = c.cz + nz * (c.maxZ - c.minZ) * 0.5 + nz * (COLLISION_RADIUS + 0.5);

          collided = true;
          cameraShakeRef.current = 0.6;
          break;
        }
      }

      if (!collided) {
        pos.x = nextX;
        pos.z = nextZ;
      }
      pos.y = nextY;

      // ── 3. Y boundary constraints ─────────────────────────────────
      vel.y -= 0.009 * dt * 60;
      if (pos.y > Y_CEILING) vel.y -= 0.05 * dt * 60; // strong pull back down
      if (pos.y <= Y_FLOOR)  { pos.y = Y_FLOOR; vel.y = Math.abs(vel.y) * 0.3; }

      // Damping
      vel.x *= Math.pow(0.965, dt * 60);
      vel.y *= Math.pow(0.965, dt * 60);
      vel.z *= Math.pow(0.965, dt * 60);

      const speed = vel.length();
      if (speed < 0.05 && pos.y <= Y_FLOOR + 0.2) {
        playerStateRef.current = 'IDLE';
        vel.set(0, 0, 0);
      }
    }

    // ── 4. Camera tracking ────────────────────────────────────────
    const speed = vel.length();
    const camZ  = pos.z + 6.8 + speed * 1.8;
    const camY  = pos.y + 2.8 + speed * 0.5;

    // Camera shake
    const shk = cameraShakeRef.current;
    const shakeDX = shk > 0.01 ? (Math.sin(state.clock.getElapsedTime() * 85) * shk * 0.8) : 0;
    const shakeDY = shk > 0.01 ? (Math.cos(state.clock.getElapsedTime() * 72) * shk * 0.8) : 0;
    cameraShakeRef.current = Math.max(0, shk - dt * 3.5);

    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, pos.x * 0.7 + shakeDX, 0.1);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, camY + shakeDY, 0.1);
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, camZ, 0.1);
    state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, 52 + Math.min(speed * 20, 26), 0.08);
    state.camera.updateProjectionMatrix();

    camTarget.current.set(pos.x, pos.y + 1.2, pos.z - 8);
    state.camera.lookAt(camTarget.current);

    // Export heading for radar
    playerFacingRef.current = state.camera.rotation.y;

    // ── 5. Chase light group ──────────────────────────────────────
    if (lightGroupRef.current) {
      lightGroupRef.current.position.set(pos.x, pos.y + 4, pos.z + 5);
    }

    // ── 6. Telemetry ──────────────────────────────────────────────
    frameCount.current++;
    const now = state.clock.getElapsedTime() * 1000;
    if (now - lastFpsMs.current >= 200) {
      fps.current = Math.round((frameCount.current * 1000) / (now - lastFpsMs.current));
      frameCount.current = 0;
      lastFpsMs.current  = now;
      onTelemetryUpdate({
        fps: fps.current,
        playerX: pos.x.toFixed(1),
        playerY: pos.y.toFixed(1),
        playerZ: pos.z.toFixed(1),
        speed: (speed * 12).toFixed(1),
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
  const [telemetry, setTelemetry]       = useState(null);
  const [villainProximity, setVProx]    = useState(120);

  // Core physics refs
  const playerPosRef   = useRef(new THREE.Vector3(0, 8, 0));
  const playerStateRef = useRef('IDLE');
  const tensionRef     = useRef(0);
  const velocityRef    = useRef(new THREE.Vector3());
  const mouseWorldRef  = useRef(new THREE.Vector3(0, 8, -10));

  // Anchor on building surface
  const anchorPointRef    = useRef(new THREE.Vector3(-52, 35, -35));
  const [anchorVis, setAnchorVis] = useState([-52, 35, -35]);

  // Wrist world position (output from SpiderManAvatar)
  const rightHandWorldPosRef = useRef(new THREE.Vector3(0, 8, 0));

  // Drag state
  const isDragging      = useRef(false);
  const dragStart       = useRef({ x: 0, y: 0 });

  // Scene refs
  const lightGroupRef   = useRef();
  const cameraShakeRef  = useRef(0);
  const playerFacingRef = useRef(0);

  // WebLine display state
  const [activeTension, setActiveTension] = useState(0);
  const [activeState,   setActiveState]   = useState('IDLE');
  const [handPos,       setHandPos]       = useState([0, 8, 0]);
  const [webSag,        setWebSag]        = useState([0, 0, 0]);

  // Villain posRefs for radar live tracking (created once)
  const villainPosRefs = useMemo(() => [
    { current: new THREE.Vector3(14, 25, -14) },
    { current: new THREE.Vector3(-16, 40, -10) },
    { current: new THREE.Vector3(10, 20, 16) },
  ], []);

  // ── Building surface click (precision raycast) ──────────────────
  const handleBuildingClick = useCallback((hitPoint) => {
    isDragging.current   = true;
    dragStart.current    = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    anchorPointRef.current.copy(hitPoint);
    setAnchorVis([hitPoint.x, hitPoint.y, hitPoint.z]);

    playerStateRef.current = 'AIMING';
    setActiveState('AIMING');
    tensionRef.current = 0.25;
    setActiveTension(0.25);

    const p = playerPosRef.current;
    setHandPos([p.x, p.y + 0.5, p.z]);
    setWebSag([0, -0.3, -0.6]);
  }, []);

  // ── Global pointer events ────────────────────────────────────────
  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return;
      const dx   = e.clientX - dragStart.current.x;
      const dy   = e.clientY - dragStart.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const t    = Math.min(Math.max(dist / 200, 0.15), 1.0);
      tensionRef.current = t;
      setActiveTension(t);

      const p    = playerPosRef.current;
      const pullZ = -t * 1.8;
      const pullY = -t * 0.5;
      setHandPos([p.x, p.y + 0.8 + pullY, p.z + pullZ]);
      setWebSag([0, -t * 1.0, -t * 2.4]);
      mouseWorldRef.current.set(p.x - dx * 0.03, p.y - dy * 0.03, p.z - 15);
    };

    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;

      const t   = tensionRef.current;
      const p   = playerPosRef.current;
      const a   = anchorPointRef.current;

      if (t > 0.12) {
        // 3D direction vector from player to anchor
        const dir = new THREE.Vector3().subVectors(a, p).normalize();
        const fwd = 0.9 + t * 1.9;
        const up  = 0.4 + t * 0.9;
        velocityRef.current.set(
          dir.x * fwd,
          Math.max(dir.y * up, 0.25),
          dir.z * fwd - (0.3 + t * 0.7),
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

  // Radar target descriptors
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
        camera={{ position: [0, 10.8, 7.2], fov: 52, near: 0.1, far: 2000 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        style={{ width: '100%', height: '100%', cursor: activeState === 'AIMING' ? 'grabbing' : 'crosshair' }}
      >
        {/* Fog */}
        <fogExp2 attach="fog" args={['#020814', 0.0035]} />

        {/* Ambient fill */}
        <ambientLight intensity={0.4} />

        {/* Dynamic chase lighting group — moved in PhysicsLoop */}
        <group ref={lightGroupRef} position={[0, 12, 5]}>
          <pointLight color="#00e5ff" intensity={3.5} distance={65} decay={2} />
          <directionalLight
            position={[12, 28, 12]}
            intensity={1.8}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-80}
            shadow-camera-right={80}
            shadow-camera-top={80}
            shadow-camera-bottom={-80}
            shadow-bias={-0.0001}
          />
        </group>

        <Suspense fallback={null}>
          {/* Avatar with wrist origin export */}
          <SpiderManAvatar
            state={activeState}
            tension={activeTension}
            playerPosRef={playerPosRef}
            velocityRef={velocityRef}
            anchorPointRef={anchorPointRef}
            rightHandWorldPosRef={rightHandWorldPosRef}
          />

          {/* Web strands from right wrist to building surface */}
          {activeState === 'AIMING' && (
            <>
              <WebLine start={anchorVis} end={handPos} tension={activeTension} pullSag={webSag} />
              {/* Second web from left hand mirrored */}
              <WebLine
                start={anchorVis}
                end={[handPos[0] - 0.8, handPos[1], handPos[2]]}
                tension={activeTension}
                pullSag={webSag}
              />

              {/* Impact marker at anchor */}
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

          {/* 2D infinite toroidal city grid with AABB colliders */}
          <CityGrid
            playerPosRef={playerPosRef}
            onBuildingPointerDown={handleBuildingClick}
          />

          {/* 4 mission targets */}
          <MissionTargets
            playerPosRef={playerPosRef}
            onProximityUpdate={setVProx}
          />

          {/* Physics + camera + lighting integration */}
          <PhysicsLoop
            playerPosRef={playerPosRef}
            playerStateRef={playerStateRef}
            tensionRef={tensionRef}
            velocityRef={velocityRef}
            lightGroupRef={lightGroupRef}
            playerFacingRef={playerFacingRef}
            cameraShakeRef={cameraShakeRef}
            onTelemetryUpdate={setTelemetry}
            villainProximity={villainProximity}
          />
        </Suspense>
      </Canvas>

      {/* Tactical Minimap Radar (top-center) */}
      <TacticalRadar
        playerPosRef={playerPosRef}
        playerFacingRef={playerFacingRef}
        targets={radarTargets}
      />

      {/* Main HUD */}
      <TacticalHUD telemetry={telemetry} />
    </div>
  );
}
