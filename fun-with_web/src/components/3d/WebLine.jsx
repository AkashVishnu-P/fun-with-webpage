import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * WebLine.jsx
 * Dynamic 3D Web Strand with Custom GLSL Tension Shader.
 * Features center necking (thinning under stress) and dynamic iridescent-to-red emissive color shift.
 */
export function WebLine({ start = [0, 0, 0], end = [0, 0, 0], tension = 0.0, pullSag = [0, 0, 0] }) {
  const materialRef = useRef();

  // Custom GLSL Tension Material
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTension: { value: 0.0 },
        uColorRest: { value: new THREE.Color('#f8fafc') },     // Iridescent White/Cyan
        uColorStretch: { value: new THREE.Color('#ef4444') },  // Stressed Glowing Red
        uTime: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTension;
        uniform vec3 uColorRest;
        uniform vec3 uColorStretch;
        uniform float uTime;
        varying vec2 vUv;

        void main() {
          // Thin the web at the center as mechanical tension increases (necking)
          float necking = sin(vUv.y * 3.14159);
          float thickness = mix(1.0, 0.25, uTension * necking);

          // Color gradient shifts from translucent iridescent white to glowing red
          vec3 finalColor = mix(uColorRest, uColorStretch, uTension);

          // Emissive bloom glow under stress
          float glow = 1.0 + uTension * 3.5;

          // Subtle pulse along strand
          float pulse = sin(vUv.y * 20.0 - uTime * 6.0) * 0.15 * (1.0 - uTension);

          gl_FragColor = vec4((finalColor + pulse) * glow, 0.9 * thickness);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
  }, []);

  // Update uniforms in useFrame
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTension.value = tension;
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  // Construct dynamic curved tube geometry
  const tubeGeometry = useMemo(() => {
    const p1 = new THREE.Vector3(...start);
    const p2 = new THREE.Vector3(...end);
    
    // Midpoint bowed by pullSag
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    mid.add(new THREE.Vector3(...pullSag));

    const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
    return new THREE.TubeGeometry(curve, 20, 0.035, 8, false);
  }, [start, end, pullSag]);

  return (
    <mesh geometry={tubeGeometry}>
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  );
}
