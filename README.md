# 🕸️ SPIDER-SLINGER OS // PROJECT OS-SPIDER

> **"With great potential energy comes great kinetic launch acceleration."**

[![Live Demo](https://img.shields.io/badge/PLAY_LIVE-NETLIFY-00E5FF?style=for-the-badge&logo=netlify&logoColor=black)](https://fun-with-webpage.netlify.app/)
[![Engine](https://img.shields.io/badge/Three.js-WebGL_2.0-FF1744?style=for-the-badge&logo=three.js)](https://threejs.org/)
[![Framework](https://img.shields.io/badge/React_Three_Fiber-v9.7-A855F7?style=for-the-badge&logo=react)](https://docs.pmnd.rs/react-three-fiber)

---

## 🌐 Live Experience
Play the interactive 3D Spider-Man Web Slinger experience directly in your browser:  
👉 **[https://fun-with-webpage.netlify.app/](https://fun-with-webpage.netlify.app/)**

---

## 🌆 Overview

**SPIDER-SLINGER OS** is an interactive, AAA-grade 3D WebGL web-slinging simulation built with **React Three Fiber (R3F)**, **Three.js**, and custom **GLSL shaders**. 

Navigate a procedural, infinite-wrapping 2D toroidal Manhattan skyline, land flush on skyscraper rooftops, shoot web strands dynamically, and launch yourself across the city canyon using Hooke's Law elastic potential physics!

---

## ✨ Key Features & Technical Highlights

### 🕷️ Dynamic Hooke's Law Web Slingshot
- **Elastic Potential Mechanics**: Drag backwards from any skyscraper or rooftop beacon to build up spring tension energy, then release to launch Spider-Man across the city graph.
- **Dynamic Strain Shader**: Web strands dynamically shift from translucent cyan (`#e0f7fa`) to warning crimson red (`#ff1744`) under mechanical strain.

### 🏙️ Procedural NYC Skyline & Color Themes
- **Infinite Toroidal Chunk Grid**: 64 skyscrapers continuously wrap around Spider-Man in 3D world space.
- **Custom Per-Building Shader Themes**: Skyscrapers feature unified window matrix themes:
  - 🩵 **Neon Cyan / Ice Blue**
  - 🔴 **Crimson / Coral Ember**
  - 💜 **Cyberpunk Amber & Magenta**
- **Procedural Sky Dome**: Atmospheric gradient with 2,000 deterministic stars.

### 🎯 Rooftop Landing & Standing Spots
- **Y-Axis Spatial Collision**: Feet lock cleanly onto rooftop landing pads (`pos.y = roofHeight`) with momentum arrest (`velocity.y = 0`).
- **Interactive Rooftop Beacons**: Every building features a central target disk, glowing ring, and vertical hologram column marker for precision landing and launch targeting.

### 📹 Action Camera Rig & Anti-Gimbal Lock
- **3/4 Profile Aiming Shots**: Dynamic side-profile camera swoops when grappling buildings.
- **Planar 2D Trailing**: Camera isolates horizontal X-Z velocity during high-speed flight, completely eliminating Gimbal Lock and 360° camera flips.
- **Adrenaline Speed FOV**: Camera Field of View warps dynamically from 70° up to 110° at top velocity.
- drivelink - https://drive.google.com/drive/folders/1Cu89K8JMduuMq5dh-LMLFydzwvN6nmKb?usp=sharing

---

## 🎮 Controls

| Action | Controls |
|---|---|
| **Grapple & Drag** | Left-Click building / rooftop beacon + Drag backwards |
| **Slingshot Launch** | Release Left Mouse Button |
| **Tactical Map OS** | Press `[M]` or click the floating `TACTICAL MAP` button |
| **Rotate Camera** | Drag environment |

---

## 🛠️ Tech Stack & Architecture

- **Core**: React 19, Vite 8
- **3D Graphics Engine**: Three.js, React Three Fiber (R3F)
- **Shaders**: Custom GLSL (Procedural Window Matrix, Tension Glow, Edge Detection)
- **State & Physics**: Custom 60FPS `useFrame` physics loop, pre-allocated zero-GC vector math

---

## 🚀 Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/AkashVishnu-P/fun-with-webpage.git
   cd fun-with-webpage/fun-with_web
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run local dev server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

---

<p align="center">
  <i>Developed with 🕸️ by Akash Vishnu P</i>
</p>
