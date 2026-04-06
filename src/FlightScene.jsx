import React, { useRef, useMemo, Suspense } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { 
  OrbitControls, 
  PerspectiveCamera, 
  Stars, 
  Line, 
  Environment,
  Grid,
  ContactShadows,
  useGLTF
} from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader'

// Fallback high-quality custom model
const StylizedPlane = ({ rotation, position }) => {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <capsuleGeometry args={[0.3, 1.2, 8, 24]} />
        <meshStandardMaterial color="#ffffff" metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.1]}>
        <boxGeometry args={[3.0, 0.05, 0.6]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
    </group>
  )
}

// Airbus A330neo Model (Modern Simulation Look)
const AirbusModel = ({ rotation, position }) => {
  const { scene } = useGLTF('/models/a330.glb')
  
  return (
    <group position={position} rotation={rotation}>
      <primitive 
        object={scene} 
        scale={0.5} 
        rotation={[0, Math.PI, 0]} // rotate to face forward if needed
      />
    </group>
  )
}

// World War Aircraft Model (Alternative)
const WorldWarModel = ({ rotation, position }) => {
  const materials = useLoader(MTLLoader, '/models/plane.mtl')
  const obj = useLoader(OBJLoader, '/models/plane.obj', (loader) => {
    materials.preload()
    loader.setMaterials(materials)
  })

  return (
    <group position={position} rotation={rotation}>
      <primitive 
        object={obj} 
        scale={0.015} 
        rotation={[-Math.PI / 2, 0, 0]} 
      />
    </group>
  )
}

// Orb Visualization (Minimalist Mode)
const OrbModel = ({ position }) => {
  return (
    <group position={position}>
      <mesh castShadow>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={5} />
      </mesh>
      <pointLight color="#3b82f6" intensity={10} distance={15} />
    </group>
  )
}

const Trajectory = ({ points, colors, visible }) => {
  if (!visible || !points || points.length < 2) return null
  return (
    <group>
      {/* Primary Glowing Core */}
      <Line 
        points={points} 
        vertexColors={colors} 
        lineWidth={4} 
        transparent 
        opacity={1} 
      />
      {/* Secondary Outer Bloom Glow */}
      <Line 
        points={points} 
        vertexColors={colors} 
        lineWidth={12} 
        transparent 
        opacity={0.15} 
      />
    </group>
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

  const currentPos = useMemo(() => {
    if (!trajectory || trajectory.length === 0) return [0, 0, 0]
    const p = trajectory[Math.min(currentIndex, trajectory.length - 1)]
    return [p.x * playbackScale, p.z * playbackScale, -p.y * playbackScale]
  }, [trajectory, currentIndex, playbackScale])

  const currentRot = useMemo(() => {
    if (!trajectory || trajectory.length < 2) return [0, 0, 0]
    const idx = Math.min(currentIndex, trajectory.length - 2)
    const p1 = trajectory[idx]
    const p2 = trajectory[idx + 1]
    const dir = new THREE.Vector3(p2.x - p1.x, p2.z - p1.z, -(p2.y - p1.y)).normalize()
    const matrix = new THREE.Matrix4()
    matrix.lookAt(dir, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0))
    const euler = new THREE.Euler().setFromRotationMatrix(matrix)
    return [euler.x, euler.y, euler.z]
  }, [trajectory, currentIndex])

  const { trailPoints, trailColors } = useMemo(() => {
    if (!trajectory || trajectory.length === 0) return { trailPoints: [], trailColors: [] }
    
    const slice = trajectory.slice(0, currentIndex + 1)
    const filtered = slice.filter((_, i) => i % 2 === 0 || i === currentIndex)
    
    const pts = filtered.map(p => new THREE.Vector3(p.x * playbackScale, p.z * playbackScale, -p.y * playbackScale))
    const cls = filtered.map(p => {
        const speed = p.speed || 0
        const hue = Math.min(1, speed / 20) * 0.6
        return new THREE.Color().setHSL(0.6 - hue, 1.0, 0.5)
    })
    
    return { trailPoints: pts, trailColors: cls }
  }, [trajectory, currentIndex, playbackScale])

  useFrame((state) => {
    if (cameraMode === 'follow') {
      const offset = new THREE.Vector3(-15, 10, 15)
      const targetPos = new THREE.Vector3(...currentPos).add(offset)
      state.camera.position.lerp(targetPos, 0.05)
      state.camera.lookAt(...currentPos)
      if (controlsRef.current) {
        controlsRef.current.target.lerp(new THREE.Vector3(...currentPos), 0.1)
      }
    } else if (cameraMode === 'top') {
      const topPos = new THREE.Vector3(currentPos[0], 50, currentPos[2])
      state.camera.position.lerp(topPos, 0.05)
      state.camera.lookAt(...currentPos)
      if (controlsRef.current) {
        controlsRef.current.target.lerp(new THREE.Vector3(...currentPos), 0.1)
      }
    }
  })

  return (
    <>
      <PerspectiveCamera 
        makeDefault 
        position={[18, 12, 18]} 
        fov={40} 
      />
      <OrbitControls 
        ref={controlsRef} 
        makeDefault 
        enableDamping 
        enabled={cameraMode === 'free'}
      />
      
      <color attach="background" args={['#010409']} />
      <Stars radius={150} depth={60} count={6000} factor={4} saturation={0.5} fade speed={1} />
      <Environment preset="night" />
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 10]} intensity={1.5} castShadow />

      <Grid
        infiniteGrid
        fadeDistance={120}
        fadeStrength={6}
        sectionSize={10}
        sectionColor="#1e293b"
        cellSize={2}
        cellColor="#0f172a"
        position={[0, -8, 0]}
      />

      <ContactShadows 
        position={[0, -7.9, 0]} 
        opacity={0.4} 
        scale={60} 
        blur={2} 
        far={10} 
      />

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
      
      {/* Post-Processing Effects for Simulation Look */}
      <EffectComposer disableNormalPass>
        <Bloom 
          intensity={1.5} 
          luminanceThreshold={0.2} 
          luminanceSmoothing={0.9} 
          height={300} 
        />
        <Noise opacity={0.02} />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>

      <axesHelper args={[2]} />
    </>
  )
}
