import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, Box, Float, MeshDistortMaterial, MeshWobbleMaterial, PerspectiveCamera, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

interface FaceProps {
  volume: number;
  isConnected: boolean;
  isConnecting: boolean;
}

function RobotFace({ volume, isConnected, isConnecting }: FaceProps) {
  const mouthRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const mouthYScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const eyeYScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    
    // Mouth animation based on volume
    const targetMouthScale = isConnected ? 0.1 + (volume / 255) * 3 : 0.1;
    if (mouthRef.current) {
      mouthRef.current.scale.y += (targetMouthScale - mouthRef.current.scale.y) * 12 * delta;
    }

    // Eyes blink and look around
    if (leftEyeRef.current && rightEyeRef.current) {
      if (Math.random() < 0.005) {
        leftEyeRef.current.scale.y = 0.1;
        rightEyeRef.current.scale.y = 0.1;
      } else {
        leftEyeRef.current.scale.y += (1 - leftEyeRef.current.scale.y) * 15 * delta;
        rightEyeRef.current.scale.y += (1 - rightEyeRef.current.scale.y) * 15 * delta;
      }
      
      // Subtle eye movement
      const eyeX = Math.sin(t * 0.5) * 0.1;
      const eyeY = Math.cos(t * 0.7) * 0.05;
      leftEyeRef.current.position.x = -0.7 + eyeX;
      leftEyeRef.current.position.y = 0.5 + eyeY;
      rightEyeRef.current.position.x = 0.7 + eyeX;
      rightEyeRef.current.position.y = 0.5 + eyeY;
    }

    // Head floating movement
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.4) * 0.15;
      headRef.current.rotation.x = Math.cos(t * 0.3) * 0.1;
      headRef.current.position.y = Math.sin(t * 0.8) * 0.1;
    }

    // Outer ring rotation
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.5;
      ringRef.current.rotation.x = Math.sin(t * 0.2) * 0.2;
    }
  });

  const accentColor = isConnecting ? "#F27D26" : isConnected ? "#00FFDD" : "#4A4B50";
  
  return (
    <group ref={headRef}>
      {/* Outer Halo Ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.5, 0.02, 16, 100]} />
        <meshStandardMaterial 
          color={accentColor} 
          emissive={accentColor} 
          emissiveIntensity={isConnected ? 2 : 0.5} 
          transparent 
          opacity={0.3}
        />
      </mesh>

      {/* Main Glass Head */}
      <Sphere args={[1.8, 64, 64]}>
        <meshPhysicalMaterial 
          color="#0a0a0a"
          roughness={0.1}
          metalness={0.9}
          transmission={0.5}
          thickness={1}
          envMapIntensity={1}
          clearcoat={1}
        />
      </Sphere>

      {/* Internal Core Glow */}
      <Sphere args={[1.2, 32, 32]}>
        <MeshDistortMaterial 
          color={accentColor}
          speed={isConnected ? 4 : 1}
          distort={0.4}
          radius={1}
          emissive={accentColor}
          emissiveIntensity={isConnected ? 0.5 : 0.1}
        />
      </Sphere>

      {/* Eyes */}
      <group>
        <Box ref={leftEyeRef} args={[0.5, 0.2, 0.1]} position={[-0.7, 0.5, 1.6]}>
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={isConnected ? 5 : 1} toneMapped={false} />
        </Box>
        <Box ref={rightEyeRef} args={[0.5, 0.2, 0.1]} position={[0.7, 0.5, 1.6]}>
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={isConnected ? 5 : 1} toneMapped={false} />
        </Box>
      </group>

      {/* Mouth Line */}
      <Box ref={mouthRef} args={[1, 0.1, 0.1]} position={[0, -0.6, 1.7]}>
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={isConnected ? 5 : 1} toneMapped={false} />
      </Box>

      {/* Decorative Panels */}
      <Box args={[0.1, 0.8, 0.1]} position={[-1.8, 0, 0]}>
        <meshStandardMaterial color="#333" />
      </Box>
      <Box args={[0.1, 0.8, 0.1]} position={[1.8, 0, 0]}>
        <meshStandardMaterial color="#333" />
      </Box>
    </group>
  );
}

export default function Face3D({ volume, isConnected, isConnecting, onClick }: FaceProps & { onClick: () => void }) {
  return (
    <div className="w-full aspect-square cursor-pointer relative group" onClick={onClick}>
      {/* Background Glow */}
      <div className={`absolute inset-0 rounded-full blur-[80px] transition-all duration-1000 ${
        isConnected ? 'bg-[#00FFDD]/20 opacity-100 scale-110' : 
        isConnecting ? 'bg-[#F27D26]/20 opacity-100 scale-105' : 
        'bg-white/5 opacity-0 scale-100'
      }`} />
      
      <Canvas shadows gl={{ antialias: true, toneMapping: THREE.ReinhardToneMapping }}>
        <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={40} />
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color={isConnected ? "#00FFDD" : "#fff"} />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        
        <Float speed={isConnected ? 3 : 1.5} rotationIntensity={0.5} floatIntensity={0.5}>
          <RobotFace volume={volume} isConnected={isConnected} isConnecting={isConnecting} />
        </Float>
        
        <Environment preset="city" />
        <ContactShadows position={[0, -2.5, 0]} opacity={0.4} scale={10} blur={2.5} far={4} />
      </Canvas>

      {/* Interaction Overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full text-xs font-mono tracking-widest text-white uppercase">
          {isConnected ? 'Disconnect' : 'Initiate Nexus'}
        </div>
      </div>
    </div>
  );
}

