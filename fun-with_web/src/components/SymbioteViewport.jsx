import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WebGLRenderer } from '../engine/WebGLRenderer.js';
import { TacticalHUD } from './TacticalHUD.jsx';

export function SymbioteViewport() {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const [telemetry, setTelemetry] = useState(null);

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer;
    try {
      renderer = new WebGLRenderer(canvas);
      rendererRef.current = renderer;

      // Telemetry callback to update HUD without stalling render loop
      renderer.onTelemetry = (data) => {
        setTelemetry(data);
      };

      const handleResize = () => {
        renderer.resize(window.innerWidth, window.innerHeight);
      };

      window.addEventListener('resize', handleResize);
      handleResize();

      renderer.start();

      return () => {
        window.removeEventListener('resize', handleResize);
        renderer.destroy();
      };
    } catch (err) {
      console.error('Failed to initialize WebGLRenderer:', err);
    }
  }, []);

  // Pointer input handling for inertial panning in Phase 1
  const handlePointerDown = useCallback((e) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    if (e.target && e.target.setPointerCapture) {
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch {
        // Safe fallback
      }
    }
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!isDraggingRef.current || !rendererRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    const camera = rendererRef.current.camera;
    // Move camera in opposition to drag (panning the view)
    camera.x -= dx / camera.zoom;
    camera.y -= dy / camera.zoom;
    camera.vx = -dx * 0.75;
    camera.vy = -dy * 0.75;
  }, []);

  const handlePointerUp = useCallback((e) => {
    isDraggingRef.current = false;
    setIsDragging(false);
    if (e.target && e.target.releasePointerCapture) {
      try {
        e.target.releasePointerCapture(e.pointerId);
      } catch {
        // Safe fallback
      }
    }
  }, []);

  const handleWheel = useCallback((e) => {
    if (!rendererRef.current) return;
    const camera = rendererRef.current.camera;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    camera.targetZoom = Math.min(Math.max(camera.targetZoom * zoomFactor, 0.4), 2.5);
  }, []);

  const handleImpulse = useCallback((fx, fy) => {
    if (rendererRef.current) {
      rendererRef.current.camera.applyImpulse(fx, fy);
    }
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: isDragging ? 'grabbing' : 'crosshair'
        }}
      />
      <TacticalHUD telemetry={telemetry} onImpulse={handleImpulse} />
    </div>
  );
}
