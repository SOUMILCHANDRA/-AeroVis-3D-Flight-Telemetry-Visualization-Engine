# AeroVis 3D - High-Fidelity Flight Motion Telemetry Visualizer

AeroVis 3D is a state-of-the-art telemetry visualization platform that converts raw accelerometer data into interactive 3D trajectories. Using physics-based motion reconstruction, it bridges the gap between raw time-series data and spatial understanding.

## 🚀 Key Features

### 🧩 Core Data Processing
- **Multi-Format Input**: Parses `.xlsx` and `.csv` files with flexible column mapping.
- **Physics Engine**: Double integration pipeline transforms Acceleration (g or m/s²) into Velocity and continuous 3D Position coordinates.
- **Kalman Filtering**: Integrated 1D Kalman Noise Filter for trajectory smoothing and drift reduction.
- **Zero-Bias Calibration**: Dynamic baseline detection to offset sensor gravity and drift.

### 📊 Advanced Telemetry & Analytics
- **Live Dashboard**: Synced `recharts` arrays for $A_x, A_y, A_z$, $V_x, V_y, V_z$, and $P_x, P_y, P_z$.
- **Real-Time Metrics**: Speed (km/h), G-Force magnitude, Total Displacement (m), and Altitude.
- **Accuracy Tracking**: Drift Awareness indicator warns when integration cumulative error increases.

### 🎮 Immersive 3D Visualization
- **Multi-Mode Visualization**: Toggle between a **WWII Kawasaki Ki-61 "Hien"** jet fighter and a minimalist **Glowing Orb**.
- **Dynamic Trails**: 3D motion trails with **Speed-based Color Mapping** (Cool blue for low speed, glowing amber for high thrust).
- **Cinematic Camera Modes**:
  - **Follow View**: Trails the aircraft with smooth lerp interpolation.
  - **Orbit View**: Allows free interactive 360° inspection.
  - **Top View**: Precision vertical "map" view.

### ⏯️ Playback & Control Suite
- **Interactive Timeline**: Scrub through entire flight recordings.
- **Tempo Control**: Variable playback speed from 0.1x to 5.0x.
- **Spatial Control**: Adjust spatial scaling to compensate for sensor sensitivity or high-displacement flights.
- **Data Export**: Export reconstructed flight data as a structured JSON replay for secondary analysis.

## 🛠️ Technology Stack
- **Frontend**: React 18 + Vite (Production-grade HMR)
- **3D Graphics**: Three.js, React Three Fiber (R3F), @react-three/drei
- **Motion & UI**: Framer Motion, Recharts
- **Data Handling**: SheetJS (XLSX), Numerical Integration, Kalman Filter

## 📦 Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Run Locally**:
   ```bash
   npm run dev
   ```
3. **Analyze Data**: Drag and drop your telemetry file or click **"Start with Sample"** to see the system in action with simulated flight data.

## 📈 Intended Use
Designed for researchers, drone pilots, and developers working with IMU/accelerometer sensors to visualize spatial movement from non-GPS time-series data. 

---
*Developed with ❤️ by the AeroVis 3D Engineering Team.*
