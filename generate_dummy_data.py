import pandas as pd
import numpy as np

def generate_flight_data(filename='dummy_flight.xlsx'):
    fs = 50  # 50 Hz sampling rate
    duration = 20  # 20 seconds of flight
    t = np.arange(0, duration, 1/fs)
    
    # Simulate a sophisticated flight path:
    # 1. Takeoff (Acc Z up, progressive speed)
    # 2. Banked turn (Acc X side, Acc Y forward)
    # 3. Descent / Spiral (Acc Z down, rotation)
    
    # Base acceleration (m/s^2)
    # Z: Lift/Climb
    ax = 0.5 * np.sin(t * 0.8)  # Gentle sway
    ay = 1.2 * np.ones_like(t)    # Constant thrust
    az = 0.4 * t                 # Increasing lift

    # Add a banked turn maneuver from 8s to 14s
    turn_mask = (t > 8) & (t < 14)
    ax[turn_mask] += 2.0 * np.sin((t[turn_mask]-8) * np.pi / 6)
    az[turn_mask] += 0.5 * np.cos((t[turn_mask]-8) * np.pi / 6)
    
    # Add sensor noise
    noise_level = 0.05
    ax += np.random.normal(0, noise_level, len(t))
    ay += np.random.normal(0, noise_level, len(t))
    az += np.random.normal(0, noise_level, len(t))
    
    # Convert to a DataFrame (assuming units are m/s^2 for the visualizer)
    df = pd.DataFrame({
        'time (s)': t,
        'acc_x (m/s2)': ax,
        'acc_y (m/s2)': ay,
        'acc_z (m/s2)': az
    })
    
    # Save to Excel in the public folder so the app can fetch it
    # We'll use public/ for static assets in Vite
    import os
    if not os.path.exists('public'):
        os.makedirs('public')
        
    df.to_excel('public/dummy_flight.xlsx', index=False)
    print(f"Generated advanced flight data to public/dummy_flight.xlsx ({len(df)} rows)")

if __name__ == "__main__":
    generate_flight_data()
