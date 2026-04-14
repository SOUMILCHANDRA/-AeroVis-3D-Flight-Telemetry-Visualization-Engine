import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { 
  FileUp, 
  Play, 
  Pause, 
  RotateCcw, 
  Settings, 
  Activity, 
  ChevronRight,
  Info 
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceArea
} from 'recharts'
import FlightScene from './FlightScene'
import { motion, AnimatePresence } from 'framer-motion'

const App = () => {
  const [data, setData] = useState([])
  const [trajectory, setTrajectory] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [playbackScale, setPlaybackScale] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const [isCalibrated, setIsCalibrated] = useState(true)
  const [useKalman, setUseKalman] = useState(true)
  const [cameraMode, setCameraMode] = useState('follow') // 'follow', 'free', 'top'
  const [showTrail, setShowTrail] = useState(true)
  const [showPlane, setShowPlane] = useState(true)
  const [vizMode, setVizMode] = useState('aircraft') // 'aircraft', 'orb'
  
  const timerRef = useRef(null)

  // Simple Kalman Filter Implementation for 1D
  const applyKalmanFilter = (samples, processNoise = 0.05, measurementNoise = 0.1) => {
    let x = samples[0] || 0
    let p = 1.0
    return samples.map(z => {
      // Prediction
      p = p + processNoise
      // Update
      const k = p / (p + measurementNoise)
      x = x + k * (z - x)
      p = (1 - k) * p
      return x
    })
  }

  // Double integration logic
  const processRawData = (rows, calibrate = false) => {
    let vx = 0, vy = 0, vz = 0
    let px = 0, py = 0, pz = 0
    let lastT = rows[0].t

    // If calibrated, calculate mean of first 10 samples to subtract bias
    let biasX = 0, biasY = 0, biasZ = 0
    if (calibrate) {
      const samples = rows.slice(0, 10)
      biasX = samples.reduce((acc, r) => acc + r.ax, 0) / samples.length
      biasY = samples.reduce((acc, r) => acc + r.ay, 0) / samples.length
      biasZ = samples.reduce((acc, r) => acc + r.az, 0) / samples.length
    }

    // Apply Kalman if enabled
    let rawAX = rows.map(r => r.ax)
    let rawAY = rows.map(r => r.ay)
    let rawAZ = rows.map(r => r.az)

    if (useKalman) {
      rawAX = applyKalmanFilter(rawAX)
      rawAY = applyKalmanFilter(rawAY)
      rawAZ = applyKalmanFilter(rawAZ)
    }

    return rows.map((row, i) => {
      const dt = i === 0 ? 0 : row.t - lastT
      lastT = row.t

      const ax = rawAX[i] - biasX
      const ay = rawAY[i] - biasY
      const az = rawAZ[i] - biasZ

      // Simple Trapezoidal/Cumulative summation
      vx += ax * dt
      vy += ay * dt
      vz += az * dt

      px += vx * dt
      py += vy * dt
      pz += vz * dt

      // Additional Telemetry
      const speed = Math.sqrt(vx*vx + vy*vy + vz*vz)
      const gMagnitude = Math.sqrt(ax*ax + ay*ay + az*az) / 9.81 // approximate G-force
      
      // Cumulative distance
      const segmentDist = i === 0 ? 0 : Math.sqrt((vx*dt)**2 + (vy*dt)**2 + (vz*dt)**2)
      const totalDistance = i === 0 ? 0 : rows[i-1].totalDistance + segmentDist

      return {
        ...row,
        ax_c: ax, ay_c: ay, az_c: az,
        vx, vy, vz,
        px, py, pz,
        speed,
        gMagnitude,
        totalDistance,
        x: px, y: py, z: pz // for 3D mapping
      }
    })
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setIsLoading(true)
    setError(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const bstr = event.target.result
        const workbook = XLSX.read(bstr, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(sheet)

        // Map column names flexibly
        const mappedData = jsonData.map(row => {
          // Find standard names in row
          const findVal = (keys) => {
            const match = Object.keys(row).find(k => keys.some(key => k.toLowerCase().includes(key)))
            return match ? parseFloat(row[match]) : 0
          }

          return {
            t: findVal(['time', 'sec']),
            ax: findVal(['acc x', 'acc_x', 'acceleration x']),
            ay: findVal(['acc y', 'acc_y', 'acceleration y']),
            az: findVal(['acc z', 'acc_z', 'acceleration z'])
          }
        })

        if (mappedData.length < 2) throw new Error("File must contain at least 2 rows of data.")
        
        const processed = processRawData(mappedData, isCalibrated)
        setTrajectory(processed)
        setData(processed)
        setCurrentIndex(0)
      } catch (err) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }
    reader.onerror = () => {
      setError("Failed to read file.")
      setIsLoading(false)
    }
    reader.readAsBinaryString(file)
  }

  const loadSample = async () => {
    setIsLoading(true)
    try {
      // Simulate fetching or generating dummy data
      const response = await fetch('/dummy_flight.xlsx')
      const arrayBuffer = await response.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(sheet)
      
      let cumulativeDist = 0
      const mappedData = jsonData.map((row, i) => {
        const t = parseFloat(Object.values(row)[0])
        const ax = parseFloat(Object.values(row)[1])
        const ay = parseFloat(Object.values(row)[2])
        const az = parseFloat(Object.values(row)[3])
        
        // This is a simple sample mapping, it'll use processRawData for the full calc
        return { t, ax, ay, az }
      })

      const processed = processRawData(mappedData, isCalibrated)
      setTrajectory(processed)
      setData(processed)
      setCurrentIndex(0)
    } catch (err) {
      // Fallback: Generate if file not found
      setError("Sample file not found in public folder. Generating simulated data...")
      const fs = 50, duration = 10
      const genData = Array.from({ length: fs * duration }, (_, i) => {
        const t = i / fs
        return {
          t,
          ax: 2 * Math.cos(t * 0.5),
          ay: 1.5 * Math.sin(t * 0.5), // Utility to simulate
          az: 0.8 * t
        }
      })
      
      const processed = processRawData(genData, isCalibrated)
      setTrajectory(processed)
      setData(processed)
      setCurrentIndex(0)
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const np_sin = (x) => Math.sin(x)

  // Playback loop
  useEffect(() => {
    if (isPlaying && currentIndex < data.length - 1) {
      const interval = 20 / playbackSpeed // Aiming for 50fps but limited by data rate
      timerRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= data.length - 1) {
            setIsPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, interval)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isPlaying, currentIndex, data, playbackSpeed])

  const reset = () => {
    setCurrentIndex(0)
    setIsPlaying(false)
  }

  const exportData = () => {
    if (!data || data.length === 0) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flight_telemetry_${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const currentStats = data[currentIndex] || { ax:0, ay:0, az:0, px:0, py:0, pz:0, speed:0, gMagnitude:0, totalDistance:0 }

  return (
    <div className="app-container">
      <AnimatePresence>
        {isLoading && (
          <div className="loading-overlay">
            <div className="loader"></div>
          </div>
        )}
      </AnimatePresence>

      <aside>
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '2rem' }}
        >
          <h1><Activity size={28} color="var(--primary)" /> AeroVis <span style={{ color: 'var(--accent)' }}>3D</span></h1>
          <span className="subtitle">High-fidelity flight motion telemetry engine</span>
        </motion.header>

        <section className="glass-card" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)' }}>
          <div className="upload-zone">
            <FileUp size={32} />
            <div>
              <p style={{ fontWeight: 600, color: '#fff' }}>Import Flight Data</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Drag & drop XLSX / CSV</p>
            </div>
            <input type="file" onChange={handleFileUpload} accept=".xlsx, .xls, .csv" />
          </div>
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', marginTop: '1rem' }}
            onClick={loadSample}
          >
            Run Advanced Simulation
          </button>
          {error && <p style={{ color: '#fb7185', fontSize: '0.75rem', marginTop: '0.75rem', textAlign: 'center' }}>{error}</p>}
        </section>

        <section className="glass-card control-group">
          <div className="control-label">Playback Timeline</div>
          <input 
            type="range" 
            min="0" 
            max={Math.max(0, data.length - 1)} 
            value={currentIndex} 
            onChange={(e) => {
              setCurrentIndex(parseInt(e.target.value))
              setIsPlaying(false)
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button className="btn" style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)' }} onClick={reset}>
              <RotateCcw size={18} />
            </button>
          </div>
        </section>

        <section className="glass-card">
          <div className="control-label">Visualization Settings</div>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Zero-Bias Calibration
                <div className="tooltip-container">
                  <Info size={12} color="var(--muted)" />
                  <span className="tooltip-text">Offsets sensor gravity/drift based on the first few samples.</span>
                </div>
              </div>
              <button 
                className={`btn ${isCalibrated ? 'active' : ''}`} 
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.7rem', background: isCalibrated ? 'var(--accent)' : 'var(--glass)' }}
                onClick={() => {
                  const newState = !isCalibrated
                  setIsCalibrated(newState)
                  if (data.length > 0) {
                    const processed = processRawData(data, newState)
                    setTrajectory(processed)
                    setData(processed)
                  }
                }}
              >
                {isCalibrated ? 'On' : 'Off'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <div className="stat-label">Playback Speed ({playbackSpeed}x)</div>
                <input 
                  type="range" min="0.1" max="5" step="0.1" 
                  value={playbackSpeed} onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))} 
                />
              </div>
              <div>
                <div className="stat-label">Spatial Scale ({playbackScale}x)</div>
                <input 
                  type="range" min="0.5" max="20" step="0.5" 
                  value={playbackScale} onChange={(e) => setPlaybackScale(parseFloat(e.target.value))} 
                />
              </div>
            </div>

            <div className="control-separator"></div>

            <div className="button-group-row">
              <button 
                className={`btn btn-sm ${cameraMode === 'follow' ? 'active' : ''}`}
                onClick={() => setCameraMode('follow')}
              >Follow</button>
              <button 
                className={`btn btn-sm ${cameraMode === 'free' ? 'active' : ''}`}
                onClick={() => setCameraMode('free')}
              >Orbit</button>
              <button 
                className={`btn btn-sm ${cameraMode === 'top' ? 'active' : ''}`}
                onClick={() => setCameraMode('top')}
              >Top</button>
            </div>

            <div className="control-separator"></div>

            <div className="toggles-grid">
              <label className="toggle-label">
                <span>Kalman Noise Filter</span>
                <input type="checkbox" checked={useKalman} onChange={() => setUseKalman(!useKalman)} />
              </label>
              <label className="toggle-label">
                <span>Show Trail</span>
                <input type="checkbox" checked={showTrail} onChange={() => setShowTrail(!showTrail)} />
              </label>
              <label className="toggle-label">
                <span>{vizMode === 'aircraft' ? 'Aircraft' : 'Orb'} Mode</span>
                <button 
                  className="btn btn-icon-sm"
                  onClick={() => setVizMode(prev => prev === 'aircraft' ? 'orb' : 'aircraft')}
                >
                  <RotateCcw size={12} />
                </button>
              </label>
            </div>
          </div>
        </section>

        <section className="glass-card" style={{ flex: 1 }}>
          <div className="control-label">Live Telemetry</div>
          <div className="stats-grid">
            <div className="stat-box accent">
              <div className="stat-label">Speed</div>
              <div className="stat-value">{(currentStats.speed * 3.6).toFixed(1)} <small>km/h</small></div>
            </div>
            <div className="stat-box primary">
              <div className="stat-label">Current G</div>
              <div className="stat-value">{currentStats.gMagnitude.toFixed(2)} <small>G</small></div>
            </div>
            <div className="stat-box secondary">
              <div className="stat-label">Displacement</div>
              <div className="stat-value">{currentStats.totalDistance.toFixed(1)} <small>m</small></div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Altitude</div>
              <div className="stat-value">{Math.abs(currentStats.pz).toFixed(1)} <small>m</small></div>
            </div>
          </div>
          
          <div className="accuracy-box" style={{ marginTop: '1rem' }}>
            <div className="accuracy-label">
              <span>Drift Awareness</span>
              <span className={currentIndex > data.length * 0.7 ? 'warn' : 'ok'}>
                {currentIndex > data.length * 0.7 ? 'High' : 'Low'}
              </span>
            </div>
            <div className="accuracy-bar">
              <div 
                className="accuracy-fill" 
                style={{ width: `${(currentIndex / Math.max(1, data.length)) * 100}%` }}
              ></div>
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '1rem', background: 'var(--primary-glow)', border: '1px solid var(--primary)' }}
            disabled={data.length === 0}
            onClick={exportData}
          >
            Export Reconstructed Replay (.json)
          </button>
          <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '1rem', fontStyle: 'italic' }}>
            *Note: Accuracy depends on sensor zero-bias calibration.
          </p>
        </section>
      </aside>

      <main>
        {data.length === 0 && (
          <div className="empty-state-overlay">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-card" 
              style={{ maxWidth: '400px', textAlign: 'center', pointerEvents: 'auto' }}
            >
              <Activity size={48} color="var(--primary)" style={{ marginBottom: '1rem' }} />
              <h3>Welcome to AeroVis 3D</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '1rem 0' }}>
                Transform your accelerometer telemetry into an immersive 3D motion path. 
                Upload your flight data or try the sample to begin.
              </p>
              <button className="btn" onClick={loadSample}>Start with Sample</button>
            </motion.div>
          </div>
        )}
        <div className="canvas-container">
          <Canvas shadows>
            <FlightScene 
              trajectory={trajectory} 
              currentIndex={currentIndex} 
              playbackScale={playbackScale}
              cameraMode={cameraMode}
              showTrail={showTrail}
              showPlane={showPlane}
              vizMode={vizMode}
            />
          </Canvas>
        </div>
      </main>

      <div className="graph-area">
        <div className="chart-panel">
          <div className="chart-title">Acceleration <ChevronRight size={14} /></div>
          <div className="canvas-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.slice(Math.max(0, currentIndex - 50), currentIndex + 50)}>
                <defs>
                  <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="ax" stroke="var(--primary)" fillOpacity={1} fill="url(#colorAcc)" isAnimationActive={false} />
                <Area type="monotone" dataKey="ay" stroke="var(--accent)" fillOpacity={0} isAnimationActive={false} />
                <Area type="monotone" dataKey="az" stroke="var(--secondary)" fillOpacity={0} isAnimationActive={false} />
                <ReferenceArea x={currentIndex} />
                <XAxis hide />
                <YAxis hide />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="chart-panel">
          <div className="chart-title">Velocity <ChevronRight size={14} /></div>
          <div className="canvas-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.slice(Math.max(0, currentIndex - 50), currentIndex + 50)}>
                <Area type="monotone" dataKey="vx" stroke="var(--primary)" fill="none" strokeWidth={2} isAnimationActive={false} />
                <XAxis hide />
                <YAxis hide />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-panel">
          <div className="chart-title">Position <ChevronRight size={14} /></div>
          <div className="canvas-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.slice(Math.max(0, currentIndex - 50), currentIndex + 50)}>
                <Area type="monotone" dataKey="px" stroke="var(--accent)" fill="none" strokeWidth={2} isAnimationActive={false} />
                <XAxis hide />
                <YAxis hide />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
