import React, { useRef, useEffect, useCallback } from 'react';

/**
 * TacticalRadar.jsx
 * Top-mounted circular minimap radar with:
 * - Scanning sweep line (CSS animation)
 * - White player triangle (heading-aware)
 * - 4-type mission target pings with edge-pinning for off-radar targets
 * - Pure DOM/Canvas overlay — zero R3F impact
 *
 * Props:
 *   playerPosRef   – THREE.Vector3 ref (x, z)
 *   playerFacingRef – number ref (radians, Y rotation)
 *   targets        – { emergencies, civilians, villains, destinations }
 */

const RADAR_PX  = 180;   // diameter in pixels
const RADAR_R   = RADAR_PX / 2;
const WORLD_R   = 1500;  // world units mapped to radar edge

const COLORS = {
  emergency:   '#FF1744',
  civilian:    '#00E5FF',
  villain:     '#D500F9',
  destination: '#00E676',
};

function projectToRadar(px, pz, tx, tz, heading) {
  // Vector from player to target
  let dx = tx - px;
  let dz = tz - pz;
  const dist = Math.sqrt(dx * dx + dz * dz);

  // Rotate by -heading so "up" on radar = player facing direction
  const cosH = Math.cos(-heading);
  const sinH = Math.sin(-heading);
  const rx = dx * cosH - dz * sinH;
  const rz = dx * sinH + dz * cosH;

  // Normalize to [-1, 1] based on WORLD_R
  const nx = rx / WORLD_R;
  const nz = rz / WORLD_R;

  const edgePinned = Math.sqrt(nx * nx + nz * nz) >= 1.0;
  const angle = Math.atan2(nz, nx); // atan2 in normalized space

  // Clamp to radar circle edge if out of range
  const clampLen = Math.min(Math.sqrt(nx * nx + nz * nz), 0.92);
  const cx = Math.cos(angle) * clampLen * RADAR_R + RADAR_R;
  const cy = Math.sin(angle) * clampLen * RADAR_R + RADAR_R;

  return { cx, cy, dist, edgePinned };
}

function drawTarget(ctx, cx, cy, color, type, pulseFactor, edgePinned) {
  ctx.save();
  ctx.translate(cx, cy);

  if (edgePinned) {
    // Chevron arrow pointing inward
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    const a = Math.atan2(cy - RADAR_R, cx - RADAR_R) + Math.PI;
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.globalAlpha = 0.85 + pulseFactor * 0.15;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8 + pulseFactor * 8;

  switch (type) {
    case 'emergency':
      ctx.beginPath();
      ctx.arc(0, 0, 4 + pulseFactor * 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'civilian':
      // Crosshair
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      break;
    case 'villain': {
      // Diamond
      const s = 5 + pulseFactor;
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'destination': {
      // Hexagon
      ctx.beginPath();
      const hs = 5;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        if (i === 0) ctx.moveTo(Math.cos(a) * hs, Math.sin(a) * hs);
        else ctx.lineTo(Math.cos(a) * hs, Math.sin(a) * hs);
      }
      ctx.closePath(); ctx.fill();
      break;
    }
    default: break;
  }
  ctx.restore();
}

export function TacticalRadar({ playerPosRef, playerFacingRef, targets }) {
  const canvasRef = useRef(null);
  const sweepAngleRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, RADAR_PX, RADAR_PX);

    const px = playerPosRef?.current?.x ?? 0;
    const pz = playerPosRef?.current?.z ?? 0;
    const heading = playerFacingRef?.current ?? 0;

    // -----------------------------------------------------------------------
    // 1. Background circle
    // -----------------------------------------------------------------------
    ctx.save();
    ctx.beginPath();
    ctx.arc(RADAR_R, RADAR_R, RADAR_R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(2, 8, 20, 0.82)';
    ctx.fill();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.clip();

    // -----------------------------------------------------------------------
    // 2. Concentric range rings
    // -----------------------------------------------------------------------
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
    ctx.lineWidth = 1;
    [0.33, 0.66, 1.0].forEach((frac) => {
      ctx.beginPath();
      ctx.arc(RADAR_R, RADAR_R, RADAR_R * frac, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Cross hair
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
    ctx.beginPath(); ctx.moveTo(RADAR_R, 0); ctx.lineTo(RADAR_R, RADAR_PX); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, RADAR_R); ctx.lineTo(RADAR_PX, RADAR_R); ctx.stroke();

    sweepAngleRef.current += 0.025;
    const sweep = sweepAngleRef.current;

    // Manual sweep wedge (arc approximation)
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.moveTo(RADAR_R, RADAR_R);
    ctx.arc(RADAR_R, RADAR_R, RADAR_R, sweep - 0.45, sweep);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Sweep leading edge
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(RADAR_R, RADAR_R);
    ctx.lineTo(RADAR_R + Math.cos(sweep) * RADAR_R, RADAR_R + Math.sin(sweep) * RADAR_R);
    ctx.stroke();
    ctx.restore();

    // -----------------------------------------------------------------------
    // 4. Mission Target Pings
    // -----------------------------------------------------------------------
    const t = performance.now() * 0.001;

    if (targets) {
      // Emergencies — high-frequency pulse
      (targets.emergencies ?? []).forEach((em) => {
        const { cx, cy, edgePinned } = projectToRadar(px, pz, em.pos[0], em.pos[2], heading);
        const pulse = Math.sin(t * 6.5) * 0.5 + 0.5;
        drawTarget(ctx, cx, cy, COLORS.emergency, 'emergency', pulse, edgePinned);
      });

      // Civilians — soft pulse
      (targets.civilians ?? []).forEach((civ) => {
        const { cx, cy, edgePinned } = projectToRadar(px, pz, civ.pos[0], civ.pos[2], heading);
        const pulse = Math.sin(t * 1.6) * 0.5 + 0.5;
        drawTarget(ctx, cx, cy, COLORS.civilian, 'civilian', pulse, edgePinned);
      });

      // Villains — aggressive fast pulse, live positions from ref
      (targets.villains ?? []).forEach((v) => {
        const vp = v.posRef?.current;
        if (!vp) return;
        const { cx, cy, edgePinned } = projectToRadar(px, pz, vp.x, vp.z, heading);
        const pulse = Math.sin(t * 4.2) * 0.5 + 0.5;
        drawTarget(ctx, cx, cy, COLORS.villain, 'villain', pulse, edgePinned);
      });

      // Destinations — steady
      (targets.destinations ?? []).forEach((dest) => {
        const { cx, cy, edgePinned } = projectToRadar(px, pz, dest.pos[0], dest.pos[2], heading);
        drawTarget(ctx, cx, cy, COLORS.destination, 'destination', 0.5, edgePinned);
      });
    }

    // -----------------------------------------------------------------------
    // 5. Player triangle (center, heading-relative — always points UP on radar)
    // -----------------------------------------------------------------------
    ctx.save();
    ctx.translate(RADAR_R, RADAR_R);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(0, -7);    // nose
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore(); // end clip
  }, [playerPosRef, playerFacingRef, targets]);

  useEffect(() => {
    let id;
    const loop = () => { draw(); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [draw]);

  return (
    <div style={{
      position: 'fixed',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
      pointerEvents: 'none',
    }}>
      {/* Radar label */}
      <div style={{
        textAlign: 'center',
        color: '#00e5ff',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '9px',
        letterSpacing: '2px',
        marginBottom: '3px',
        textTransform: 'uppercase',
        opacity: 0.7,
      }}>
        SPIDEY·SENSE RADAR
      </div>

      <canvas
        ref={canvasRef}
        width={RADAR_PX}
        height={RADAR_PX}
        style={{
          display: 'block',
          borderRadius: '50%',
          boxShadow: '0 0 18px rgba(0,229,255,0.5), 0 0 4px rgba(0,229,255,0.8)',
        }}
      />

      {/* Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '8px',
        marginTop: '4px',
        fontSize: '7px',
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '1px',
      }}>
        {[
          { color: COLORS.emergency,   label: 'EM' },
          { color: COLORS.civilian,    label: 'CIV' },
          { color: COLORS.villain,     label: 'VIL' },
          { color: COLORS.destination, label: 'DEST' },
        ].map(({ color, label }) => (
          <span key={label} style={{ color, opacity: 0.85 }}>● {label}</span>
        ))}
      </div>
    </div>
  );
}
