import React from 'react';

export function TacticalHUD({ telemetry }) {
  if (!telemetry) return null;

  const tensionPercent = parseInt(telemetry.tension, 10) || 0;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '24px',
      color: '#38bdf8',
      fontFamily: "'JetBrains Mono', monospace",
      textShadow: '0 0 10px rgba(56, 189, 248, 0.5)'
    }}>
      {/* Top Header & Mission Radar Readout */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }}>
        {/* Left: Mission Objectives Card */}
        <div style={{
          background: 'rgba(3, 7, 18, 0.88)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderLeft: '4px solid #ef4444',
          padding: '14px 20px',
          borderRadius: '4px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)'
        }}>
          <div style={{
            fontSize: '11px',
            letterSpacing: '2px',
            color: '#f87171',
            fontWeight: 700,
            marginBottom: '4px'
          }}>
            TACTICAL MISSION DISPATCH // NYC SECTOR 7
          </div>
          <div style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: '22px',
            fontWeight: 700,
            color: '#f8fafc',
            letterSpacing: '1px'
          }}>
            ACTIVE THREAT MATRIX
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            marginTop: '10px',
            fontSize: '13px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: '#94a3b8' }}>🚨 ACTIVE THREATS:</span>
              <span style={{ color: '#ef4444', fontWeight: 700 }}>3 EMERGENCIES</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: '#94a3b8' }}>👥 CIVILIANS DETECTED:</span>
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>5 DISTRESS BEACONS</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: '#94a3b8' }}>🦹 VILLAIN PROXIMITY:</span>
              <span style={{
                color: telemetry.villainDist < 60 ? '#f43f5e' : (telemetry.villainDist < 120 ? '#fbbf24' : '#a855f7'),
                fontWeight: 700
              }}>
                {telemetry.villainDist || 120}m {telemetry.villainDist < 60 ? '⚠️ IMMINENT' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Flight Telemetry & Slingshot Meter */}
        <div style={{
          background: 'rgba(3, 7, 18, 0.88)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRight: '4px solid #38bdf8',
          padding: '14px 20px',
          borderRadius: '4px',
          minWidth: '240px',
          textAlign: 'right',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)'
        }}>
          <div style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: '28px',
            fontWeight: 700,
            color: telemetry.fps >= 55 ? '#4ade80' : '#fbbf24'
          }}>
            {telemetry.fps} <span style={{ fontSize: '14px', color: '#94a3b8' }}>FPS</span>
          </div>

          <div style={{ fontSize: '12px', marginTop: '8px', color: '#cbd5e1' }}>
            <div>
              <span style={{ color: '#64748b' }}>AVATAR COORDS: </span>
              <span style={{ color: '#f8fafc' }}>[{telemetry.playerX}, {telemetry.playerY}, {telemetry.playerZ}]</span>
            </div>
            <div style={{ marginTop: '3px' }}>
              <span style={{ color: '#64748b' }}>SLINGSHOT SPEED: </span>
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>{telemetry.speed} m/s</span>
            </div>
            <div style={{ marginTop: '3px' }}>
              <span style={{ color: '#64748b' }}>NAV STATE: </span>
              <span style={{
                color: telemetry.state === 'FLIGHT' ? '#4ade80' : (telemetry.state === 'AIMING' ? '#ef4444' : '#94a3b8'),
                fontWeight: 700
              }}>
                {telemetry.state}
              </span>
            </div>
          </div>

          {/* Elastic Tension Bar */}
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginBottom: '3px' }}>
              <span>WEB ELASTIC TENSION</span>
              <span style={{ color: tensionPercent > 80 ? '#ef4444' : '#38bdf8' }}>{tensionPercent}%</span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              background: 'rgba(15, 23, 42, 0.8)',
              borderRadius: '2px',
              overflow: 'hidden',
              border: '1px solid rgba(56, 189, 248, 0.2)'
            }}>
              <div style={{
                width: `${tensionPercent}%`,
                height: '100%',
                background: tensionPercent > 75
                  ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                  : 'linear-gradient(90deg, #0284c7, #38bdf8)',
                transition: 'width 0.05s ease-out'
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Center: Slingshot Action Prompt */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%'
      }}>
        <div style={{
          background: 'rgba(3, 7, 18, 0.9)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          boxShadow: '0 0 30px rgba(56, 189, 248, 0.25)',
          padding: '14px 28px',
          borderRadius: '6px',
          textAlign: 'center',
          pointerEvents: 'auto'
        }}>
          <div style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: '18px',
            fontWeight: 700,
            letterSpacing: '2px',
            color: tensionPercent > 0 ? '#ef4444' : '#f8fafc'
          }}>
            {tensionPercent > 0 ? 'RELEASE TO SLINGSHOT AVATAR' : 'CLICK & PULL WEBS TO LAUNCH'}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
            Click & drag backwards to accumulate Hooke's Law elastic potential energy. Release to slingshot across the city graph.
          </div>
        </div>
      </div>
    </div>
  );
}
