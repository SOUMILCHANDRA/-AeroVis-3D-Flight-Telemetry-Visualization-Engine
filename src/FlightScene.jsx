import React, { useRef, useMemo, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { 
  OrbitControls, 
  Stars, 
  Line, 
  Environment,
  Grid,
  ContactShadows,
  useGLTF,
  Float
} from '@react-three/drei'
import * as THREE from 'three'

// Clean and simple Stylized Placeholder
const StylizedPlane = ({ rotation, position }) => {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <capsuleGeometry args={[0.3, 1.2, 16, 16]} />
        <meshStandardMaterial color="#ffffff" metalness={0.6} roughness={0.2} />
      </mesh>
      <group position={[0, -0.1, 0]}>
        <mesh receiveShadow>
            <boxGeometry args={[3.0, 0.05, 0.5]} />
            <meshStandardMaterial color="#3b82f6" />
        </mesh>
      </group>
    </group>
  )
}

// Airbus A330 Model - Simplified and robust
const AirbusModel = ({ rotation, position }) => {
  // useGLTF handles caching automatically
  const { scene } = useGLTF('/models/a330.glb')
  
  return (
    <primitive 
        object={scene} 
        position={position}
        rotation={rotation}
        scale={0.4} 
        // Note: we don't apply rotation=[0, PI, 0] here to avoid complexity, 
        // we'll handle it in the parent if needed or just let it be.
    />
  )
}

// Orb Visualization
const OrbModel = ({ position }) => {
  return (
    <Float speed={3} rotationIntensity={1} floatIntensity={1}>
        <mesh position={position}>
            <sphereGeometry args={[0.6, 32, 32]} />
            <meshStandardMaterial 
                color="#6366f1" 
                emissive="#6366f1" 
                emissiveIntensity={4} 
            />
            <pointLight intensity={10} distance={15} color="#6366f1" />
        </mesh>
    </Float>
  )
}

const Trajectory = ({ points, colors, visible }) => {
  if (!visible || !points || points.length < 2) return null
  return (
    <Line 
        points={points} 
        vertexColors={colors} 
        lineWidth={3} 
        transparent 
        opacity={0.8} 
    />
  )
}

export default function FlightScene({ 
  trajectory, 
  currentIndex, 
  playbackScale = 1,
  cameraMode = 'follow',
  showTrail = true,
  showPlane = true,
  vizMode = 'aircraft'
}) {
  const controlsRef = useRef()
  const groupRef = useRef()

  const currentPos = useMemo(() => {
    if (!trajectory || trajectory.length === 0) return [0, 0, 0]
    const p = trajectory[Math.min(currentIndex, trajectory.length - 1)]
    // Consistent Y-Up mapping
    return [p.x * playbackScale, p.z * playbackScale, -p.y * playbackScale]
  }, [trajectory, currentIndex, playbackScale])

  const currentRot = useMemo(() => {
    if (!trajectory || trajectory.length < 2) return [0, 0, 0]
    const idx = Math.min(currentIndex, trajectory.length - 2)
    const p1 = trajectory[idx]
    const p2 = trajectory[idx + 1]
    
    const dir = new THREE.Vector3(
        (p2.x - p1.x), 
        (p2.z - p1.z), 
        -(p2.y - p1.y)
    ).normalize()
    
    if (dir.lengthSq() < 0.0001) return [0, 0, 0]

    const matrix = new THREE.Matrix4()
    // Align forward vector (-Z for models) with direction
    matrix.lookAt(new THREE.Vector3(0,0,0), dir, new THREE.Vector3(0, 1, 0))
    const euler = new THREE.Euler().setFromRotationMatrix(matrix)
    return [euler.x, euler.y, euler.z]
  }, [trajectory, currentIndex])

  const { trailPoints, trailColors } = useMemo(() => {
    if (!trajectory || trajectory.length === 0) return { trailPoints: [], trailColors: [] }
    
    const slice = trajectory.slice(0, currentIndex + 1)
    // Dynamic subsampling for performance
    const step = Math.ceil(slice.length / 500) || 1
    const filtered = slice.filter((_, i) => i % step === 0 || i === currentIndex)
    
    const pts = filtered.map(p => new THREE.Vector3(p.x * playbackScale, p.z * playbackScale, -p.y * playbackScale))
    const cls = filtered.map(p => {
        const speed = p.speed || 0
        const hue = Math.min(1, speed / 50) * 0.7
        return new THREE.Color().setHSL(0.7 - hue, 1.0, 0.5)
    })
    
    return { trailPoints: pts, trailColors: cls }
  }, [trajectory, currentIndex, playbackScale])

  useFrame((state) => {
    if (trajectory.length === 0) return

    const tPos = new THREE.Vector3(...currentPos)
    
    if (cameraMode === 'follow') {
      const idealOffset = new THREE.Vector3(-20, 10, 20)
      const targetCamPos = tPos.clone().add(idealOffset)
      state.camera.position.lerp(targetCamPos, 0.05)
      state.camera.lookAt(tPos)
      if (controlsRef.current) controlsRef.current.target.lerp(tPos, 0.1)
    } else if (cameraMode === 'top') {
      const topPos = new THREE.Vector3(tPos.x, tPos.y + 100, tPos.z)
      state.camera.position.lerp(topPos, 0.05)
      state.camera.lookAt(tPos)
      if (controlsRef.current) controlsRef.current.target.lerp(tPos, 0.1)
    }
  })

  return (
    <>
      <OrbitControls 
        ref={controlsRef} 
        makeDefault 
        enabled={cameraMode === 'free'}
      />
      
      <color attach="background" args={['#030408']} />
      <Stars radius={300} depth={50} count={5000} factor={4} saturation={1} fade speed={1} />
      <Environment preset="night" />
      
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 50, 20]} intensity={2} castShadow />
      <pointLight position={[-20, 30, -20]} intensity={1.5} color="#3b82f6" />

      <Grid
        infiniteGrid
        fadeDistance={300}
        sectionSize={10}
        sectionColor="#1e293b"
        cellSize={2}
        cellColor="#0f172a"
        position={[0, -20, 0]}
      />

      <ContactShadows 
        position={[0, -19.9, 0]} 
        opacity={0.4} 
        scale={100} 
        blur={2} 
        far={20} 
      />

      <group ref={groupRef}>
        {showPlane && (
            <Suspense fallback={<StylizedPlane position={currentPos} rotation={currentRot} />}>
            {vizMode === 'aircraft' ? (
                <AirbusModel position={currentPos} rotation={currentRot} />
            ) : (
                <OrbModel position={currentPos} />
            )}
            </Suspense>
        )}
        <Trajectory points={trailPoints} colors={trailColors} visible={showTrail} />
      </group>

      <axesHelper args={[5]} />
    </>
  )
}
