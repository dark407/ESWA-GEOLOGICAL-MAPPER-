# 3D Tunnel Pull-Length Canvas (Half-In / Half-Out Joint Plane) & Visual Screen Top-to-Bottom True-North Compass Plan

This plan updates the Real-Time Mobile Compass & Inclinometer modal so that:
1. **Left Screen (3D Tunnel with Pull Length & Face Behind Walls/Crown)**: Renders the **exact tunnel shape and dimensions** (Width, Height, Arch Profile, and **Pull Length**) in its ideal 3D viewing position—with the **Left Wall, Right Wall, and Crown** extending along the pull length and the **Tunnel Face positioned at the back** behind the walls and crown.
2. **Traced-Length-Only Joint Plane (Half Inside Tunnel / Half Outside Tunnel)**: Renders the 3D joint plane **strictly along the traced joint length only**, extending **50% inside the tunnel excavation** and **50% outside the tunnel** into the surrounding rock mass.
3. **Right Screen (True-North Compass & Visual Screen Top-to-Bottom Guide)**: Fixes Android False North by locking strictly to the **Hardware Magnetometer (`deviceorientationabsolute`)** with full 3D East-North-Up (`ENU`) rotation math, where the **Bottom direction of the visual screen** gives the **Dip Direction (`000°–360°`)** and the **angle between Visual Screen Top and Bottom** gives the **Dip Amount (`00°–90°`)**.

---

## User Review & Confirmed Specifications

> [!IMPORTANT]
> This updated plan incorporates all of your exact geometric and sensor requirements:

- **Exact 3D Tunnel Shape, Size & Pull Length (Face Behind Wall & Crown)**:
  - The 3D viewport constructs the exact tunnel cross-section (`excavationWidthM`, `excavationHeightM`, `excavationShape` such as Horseshoe, D-Shaped, Circular, or Rectangular) extruded along the **Pull Length** (`pullLengthM`), with the **Left Wall**, **Right Wall**, and **Crown** forming the 3D tunnel bay in front and the **Face** positioned at the back end of the pull length.
- **Traced-Length-Only 3D Joint Plane (Half Inside / Half Outside Tunnel)**:
  - Instead of a full-tunnel disc, the 3D joint plane is sized **strictly to the length of your traced joint line**.
  - The traced joint line sits at the center of the plane so **half of the plane extends inside the tunnel void** (semi-transparent amber with grid lines) and **half extends outside the tunnel shell** into the rock mass (distinct outer-rock wireframe/tint), clearly showing how the discontinuity cuts through the excavation boundary.
- **True Magnetic North & Visual Screen Top-to-Bottom Orientation**:
  - Eliminates False North by separating `deviceorientationabsolute` (True/Magnetic North hardware magnetometer) from relative `deviceorientation` (which uses an arbitrary startup angle on Android).
  - Uses the **Visual Screen Top-to-Bottom axis** (automatically adapting to Portrait or Horizontal/Landscape screen orientation):
    - **Visual Screen Bottom Direction** = **Dip Direction (`000°–360°` from North)**.
    - **Angle Between Visual Screen Top and Bottom** = **Dip Amount (`00°–90°`)**.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Left Screen — 3D Tunnel Bay (Walls + Crown along Pull Length + Face at Back)**:
     - Displays the 3D tunnel with its exact width, height, and pull length in an ideal isometric/perspective camera position looking into the tunnel drive so the **Left Wall**, **Right Wall**, and **Crown** frame the pull length and the **Tunnel Face sits cleanly behind them**.
     - Maps the user's drawn trace onto the active panel (Face, Left Wall, Right Wall, or Crown) at its exact traced coordinates and length.
     - Builds a **Traced-Length 3D Joint Plane** centered on the trace line that projects **half inside the tunnel** and **half outside the tunnel**.
  2. **Right Screen — Visual Screen Top-to-Bottom Compass & Inclinometer**:
     - Displays a True-North 360° Compass (`N 000°`, `E 090°`, `S 180°`, `W 270°`) and a `0°–90°` Top-to-Bottom Inclinometer, plus an on-screen visual guide showing how **Screen Top → Screen Bottom** drives Dip Direction and Dip Amount in real time.
- **Target Audience / Persona**: Tunnel geologists, rock mechanics engineers, and mining face mappers using Android phones or tablets in the field.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Trace Joint & Open Real-Time Compass**: The user traces a joint of any length on the Face, Wall, or Crown and opens the Real-Time Compass window.
  2. **Inspect 3D Tunnel & Half-In / Half-Out Joint Plane (Left Screen)**:
     - The Left Screen immediately shows the 3D tunnel with its exact width, height, and pull length, with the **Face positioned behind the Left Wall, Right Wall, and Crown**.
     - The 3D joint plane matches the **exact length of the traced line** and bisects the tunnel boundary: **half inside the tunnel** and **half outside the tunnel**.
  3. **Orient Visual Screen Top-to-Bottom (Right Screen)**:
     - As the user tilts and rotates their Android device (in either Portrait or Horizontal mode), the **Visual Screen Bottom direction** points to the **Dip Direction (`000°–360°`)** on the True-North compass, and the **tilt angle between Visual Screen Top and Bottom** sets the **Dip Amount (`00°–90°`)** on the inclinometer.
  4. **True North Verification & One-Tap Calibration**:
     - If local tunnel steel ribs or magnetic declination offset the magnetometer compared to a handheld compass, the user can adjust the **North Calibration Offset** or tap **Match Real Compass** so the app's North matches their physical compass.
  5. **Lock, Fine-Tune & Confirm OK**:
     - Tapping the compass locks the reading for optional `-5° / -1° / +1° / +5°` fine-tuning; clicking **OK** updates only the orientation text (`Dip Direction / Dip Amount`) on the main face canvas.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Precision underground geotechnical CAD & field instrument HUD.
  - *Color Palette & Mood*: Deep obsidian 3D viewport (`#070b14`), translucent slate-blue tunnel Crown & Walls (`#1e293b` with `#38bdf8` structural rib edges along the pull length), highlighted back Face plane, glowing yellow-white traced joint line (`#fef08a`), dual-zone 3D Joint Plane (**Inner-Tunnel Half** in warm amber `#f59e0b` and **Outer-Rock Half** in cyan-emerald `#10b981` / `#22d3ee`), and True-North crimson (`#ef4444`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Ideal 3D Tunnel Camera & Geometry (Face Behind Wall & Crown with Pull Length)**
  - *Chosen Approach*: Build the 3D tunnel bay from $z = +\frac{L_{\text{pull}}}{2}$ (front portal entrance of the current pull round) to $z = -\frac{L_{\text{pull}}}{2}$ (the **Tunnel Face** at the back of the pull length), with the **Left Wall**, **Right Wall**, and **Crown** spanning the pull length in front of the Face and graduated pull-length station rings every $1\text{ m}$.
  - *Why*: Matches the real-world perspective of standing in front of the tunnel round looking toward the advancing face behind the newly excavated walls and crown.
- **Decision 2: Half-Inside / Half-Outside Traced-Length 3D Joint Plane**
  - *Chosen Approach*: For the user's traced 3D polyline $\mathbf{P}_0, \mathbf{P}_1, \dots, \mathbf{P}_n$ of total length $L_{\text{trace}}$, construct a two-part 3D ribbon mesh centered on $\mathbf{P}_i$:
    - **Inner-Tunnel Half**: Extends from $\mathbf{P}_i$ by $+\frac{D}{2}$ into the tunnel interior along the plane's dip-parallel vector.
    - **Outer-Rock Half**: Extends from $\mathbf{P}_i$ by $-\frac{D}{2}$ outside the tunnel into the rock mass behind the face/wall/crown.
    - Width along the trace is strictly bounded by $\mathbf{P}_0 \dots \mathbf{P}_n$ ("traced length only").
  - *Why*: Clearly visualizes both the traced length on the rock surface and the 3D attitude of the joint plane Half-In and Half-Out of the tunnel boundary.
- **Decision 3: Solving False North on Android via Strict `deviceorientationabsolute` & Visual Screen Top-to-Bottom 3D Matrix**
  - *Chosen Approach*:
    - Never allow uncalibrated `deviceorientation` (`absolute: false`) events to overwrite `deviceorientationabsolute` magnetometer readings on Android.
    - Construct the full W3C 3D orthogonal rotation matrix $\mathbf{R}_{\text{ENU}}(\alpha, \beta, \gamma)$ mapping Device coordinates to Earth **East (`+X`), North (`+Y`), Up (`+Z`)**.
    - Determine the **Visual Screen Top-to-Bottom unit vector** $\mathbf{u}_{\text{top}\to\text{bottom}}$ in device space using the active screen orientation angle (`0°`, `90°`, `180°`, `270°`), transform it into Earth ENU space $\mathbf{v} = \mathbf{R}_{\text{ENU}}\,\mathbf{u}_{\text{top}\to\text{bottom}} = (v_E, v_N, v_U)$, and compute:
      - **Dip Direction (`0°–360°`)**: Direction of Visual Screen Bottom in the horizontal East-North plane, $\text{atan2}(v_E, v_N) \pmod{360^\circ}$, blended smoothly with the screen's downward face normal when near vertical ($85^\circ\text{–}90^\circ$) to prevent gimbal flip.
      - **Dip Amount (`0°–90°`)**: Tilt angle between Visual Screen Top and Visual Screen Bottom, $\arcsin(\min(1, |v_U|))$.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Geometry Diagram**:
```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                    RealtimeMobileSplitCompassModal (50/50 Split)                   │
├──────────────────────────────────────────┬─────────────────────────────────────────┤
│ LEFT SCREEN: 3D Tunnel + Pull Length     │ RIGHT SCREEN: Visual Screen Compass     │
│                                          │                                         │
│      [CROWN / ARCH ALONG PULL LENGTH]    │  ┌───────────────────────────────────┐  │
│         ╱──────────────────────╲         │  │   VISUAL SCREEN TOP (HIGH EDGE)   │  │
│        ╱   ┌────────────────┐   ╲        │  │                 │                 │  │
│  LEFT │    │  TUNNEL FACE   │    │ RIGHT │  │     Angle Top→Bottom = DIP AMT    │  │
│  WALL │    │ (Behind Wall & │    │ WALL  │  │                 ▼                 │  │
│ (Pull │    │     Crown)     │    │(Pull) │  │  VISUAL SCREEN BOTTOM = DIP DIR   │  │
│  Len) │    │  ╔══════════╗  │    │       │  └───────────────────────────────────┘  │
│        ╲   └──╫──────────╫──┘   ╱        │                                         │
│         ╲─────╫──────────╫─────╱         │  • True-North Magnetometer (Absolute)   │
│               ╚══════════╝               │  • Normal 360° Compass (N=000°)         │
│       Traced-Length Joint Plane:         │  • 0°–90° Top-to-Bottom Inclinometer    │
│    50% Inside Tunnel / 50% Outside       │  • True North Calibration Offset        │
└──────────────────────────────────────────┴─────────────────────────────────────────┘
```

- **State & Props Integration**:
  - `excavationWidthM`, `excavationHeightM`, `excavationPullLengthM` (defaulting to the active round pull length, e.g. `3.5m`–`5.0m`, with an interactive pull-length readout in the 3D header), and `excavationShape` drive the exact 3D tunnel mesh.
  - `tracePoints2D` and `activePanel` (`face`, `left_wall`, `right_wall`, `crown`) place the traced polyline directly onto the corresponding 3D tunnel surface and generate the two-sided **Half-Inside / Half-Outside** 3D ribbon plane along that exact trace length.
