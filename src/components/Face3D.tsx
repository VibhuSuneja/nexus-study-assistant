import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useTexture, PerspectiveCamera, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';

interface FaceProps {
  volume: number;
  isConnected: boolean;
  isConnecting: boolean;
}

function AvatarFace({ volume, isConnected, isConnecting }: FaceProps) {
  const texture = useTexture('/avatar.png');
  const groupRef = useRef<THREE.Group>(null);
  const upperFaceRef = useRef<THREE.Mesh>(null);
  const lowerJawRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const isSpeaking = volume > 10;
    
    if (groupRef.current) {
      // Gentle floating animation
      groupRef.current.position.y = Math.sin(t * 0.8) * 0.1;
      groupRef.current.rotation.y = Math.sin(t * 0.4) * 0.05;

      // "Speaking" jitters
      if (isSpeaking) {
        groupRef.current.rotation.z = Math.sin(t * 20) * 0.02; // Fast subtle shake
        groupRef.current.position.x = Math.sin(t * 15) * 0.02;
      } else {
        groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, 0.1);
        groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, 0, 0.1);
      }
    }

    if (lowerJawRef.current) {
      // Animate the jaw dropping based on volume
      const jawDrop = isConnected && isSpeaking ? (volume / 255) * 0.4 : 0;
      lowerJawRef.current.position.y = THREE.MathUtils.lerp(lowerJawRef.current.position.y, -jawDrop, 0.3);
      
      // Slight scale pulse for the whole jaw
      const jawScale = 1 + jawDrop * 0.2;
      lowerJawRef.current.scale.set(1, jawScale, 1);
    }
    
    if (upperFaceRef.current) {
      // Subtle pulse for the upper face too
      const upperPulse = isConnected && isSpeaking ? (volume / 255) * 0.05 : 0;
      const s = 1 + upperPulse;
      upperFaceRef.current.scale.lerp(new THREE.Vector3(s, s, s), 0.2);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Upper Face Segment (0 to 180 degrees, rotated to top) */}
      <mesh ref={upperFaceRef} rotation={[0, 0, 0]}>
        <circleGeometry args={[2, 64, 0, Math.PI]} />
        <meshBasicMaterial map={texture} side={THREE.DoubleSide} transparent />
      </mesh>

      {/* Lower Jaw Segment (180 to 360 degrees, rotated to bottom) */}
      <mesh ref={lowerJawRef} rotation={[0, 0, 0]}>
        <circleGeometry args={[2, 64, Math.PI, Math.PI]} />
        <meshBasicMaterial map={texture} side={THREE.DoubleSide} transparent />
      </mesh>
      
      {/* Outer Glow Ring (Solid behind the split face) */}
      <mesh position={[0, 0, -0.05]}>
        <circleGeometry args={[2.1, 64]} />
        <meshBasicMaterial 
          color={isConnected ? "#00FFDD" : isConnecting ? "#F27D26" : "#ffffff"} 
          transparent 
          opacity={0.15}
        />
      </mesh>
    </group>
  );
}

export default function Face3D({ volume, isConnected, isConnecting, onClick }: FaceProps & { onClick: () => void }) {
  return (
    <div className="w-full aspect-square cursor-pointer relative group" onClick={onClick}>
      {/* Background Ambient Glow */}
      <div className={`absolute inset-0 rounded-full blur-[100px] transition-all duration-1000 ${
        isConnected ? 'bg-[#00FFDD]/15 opacity-100 scale-125' : 
        isConnecting ? 'bg-[#F27D26]/15 opacity-100 scale-110' : 
        'bg-white/5 opacity-20 scale-100'
      }`} />
      
      <Canvas gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={45} />
        <ambientLight intensity={1} />
        
        <React.Suspense fallback={null}>
          <AvatarFace volume={volume} isConnected={isConnected} isConnecting={isConnecting} />
        </React.Suspense>
        
        <Environment preset="city" />
        <ContactShadows position={[0, -2, 0]} opacity={0.3} scale={8} blur={2.5} far={4} />
      </Canvas>

      {/* Interaction UI Overlay */}
      <AnimatePresence>
        {!isConnected && !isConnecting && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 flex items-center justify-center"
          >
             <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-6 py-2.5 rounded-full text-[10px] font-mono tracking-[0.3em] text-white uppercase shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300">
               Initiate_Nexus
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Indicators */}
      <div className="absolute top-0 right-0 p-4 flex flex-col items-end gap-1">
        {isConnected && (
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-mono text-[#00FFDD] uppercase tracking-widest">Live_Pulse</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#00FFDD] animate-ping" />
          </div>
        )}
        {isConnecting && (
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-mono text-[#F27D26] uppercase tracking-widest">Uplinking</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#F27D26] animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}
