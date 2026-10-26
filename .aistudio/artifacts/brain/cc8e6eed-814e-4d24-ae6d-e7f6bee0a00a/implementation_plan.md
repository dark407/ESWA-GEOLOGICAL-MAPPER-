# Implementation Plan: NATM Shaft Face Mapping, Probe Hole Drilling & Instrumentation Modules

## 1. Overview & Objective
Add three dedicated NATM engineering modules to the primary NATM control panel in `src/App.tsx`, positioned exactly between **3D Continuous Tunnel Logging** and **Geological & Geotechnical Core Logging**:
1. **Shaft Face Mapping** (Depth-based excavation benches, 360° cylindrical unwrapped perimeter wall mapping + circular shaft floor face, discontinuity sets, groundwater inflows, and shaft NATM support).
2. **Probe Hole Drilling** (Forward exploratory probing ahead of the tunnel/shaft face recording penetration rates, flush return/losses, water ingress flow/pressure, lithology intercepts, and forward geological hazard alert forecasting).
3. **Instrumentation & Monitoring** (3D optical convergence targets $\Delta x, \Delta y, \Delta z$, MPBX multipoint borehole extensometers, radial/tangential shotcrete pressure cells, deformation velocity trends, and 3-tier Green/Amber/Red trigger response action plans).

All three modules will strictly adhere to NATM civil tunneling and shaft engineering standards, completely isolated from TBM and mechanized mining workflows, featuring step-by-step guided workflows and high-contrast, crystal-clear typography.

---

## 2. System Architecture & Component Interaction Flow

```
+--------------------------------------------------------------------------------------------------+
|                                    NATM Main Control Window (App.tsx)                            |
|                                                                                                  |
|   [ 1. Underground Face Mapping (NATM Tunnel Face) ]                                             |
|   [ 2. 3D Continuous Tunnel Logging ]                                                            |
|                                                                                                  |
|   ============================== NEW MODULE INSERTS ==============================               |
|   [ 3. Shaft Face Mapping (360° Unwrapped Cylindrical & Floor) ]  ---> Launches ShaftMappingModal  |
|   [ 4. Probe Hole Drilling (Forward Ingress & Hazard Probing) ]   ---> Launches ProbeDrillingModal  |
|   [ 5. Instrumentation & Monitoring (3D Targets, MPBX, Cells) ]  ---> Launches MonitoringModal     |
|   ================================================================================               |
|                                                                                                  |
|   [ 6. Geological & Geotechnical Core Logging ]                                                  |
+--------------------------------------------------------------------------------------------------+
                                        |
           +----------------------------+----------------------------+
           |                                                         |
           v                                                         v
+-------------------------------+  +-------------------------------+  +-------------------------------+
|     ShaftMappingModal.tsx     |  |    ProbeHoleDrillingModal.tsx |  |   MonitoringDashboardModal.tsx|
+-------------------------------+  +-------------------------------+  +-------------------------------+
| Step 1: Shaft Bench Setup     |  | Step 1: Probe Hole Geometry   |  | Step 1: Section & Array Setup |
| - Shaft ID, Collar Elev, Dia  |  | - Hole ID, Dip/Azimuth, Length|  | - Chainage, Instrument Types |
| - Bench Depth Range (Z1->Z2)  |  | - Rig & Bit Specification     |  | - Baseline Zero Readings      |
| Step 2: 360° Perimeter Wall   |  | Step 2: Interval Drilling Log |  | Step 2: Observation Records   |
| - Unwrapped 0°-360° Grid      |  | - Penetration Rate (min/m)    |  | - 3D Convergence (dx, dy, dz) |
| - Sector Lithology & Faults   |  | - Flushing Return & Core Loss |  | - MPBX Anchor Displacements   |
| Step 3: Shaft Bottom Face     |  | Step 3: Water Ingress & Seep  |  | - Shotcrete Pressure (Radial) |
| - Circular Floor Mapping      |  | - Ingress Rate (L/min), Press |  | Step 3: Trend & Thresholds    |
| - Joint Dip/Dip Direction     |  | - Water Quality / Temperature |  | - Velocity (mm/day) & Accel   |
| Step 4: NATM Shaft Support    |  | Step 4: Forward Hazard Alert  |  | - Green/Amber/Red Alarm Gates |
| - Ring Beams, Lattice Girders |  | - Karst, Fault Gouge, Gas, RQD|  | Step 4: NATM Action Protocol  |
| - Wire Mesh & Shotcrete Thk   |  | - Ahead-of-Face 3D Schematics |  | - TARP Trigger Action Response|
| Step 5: Summary & Sign-off    |  | Step 5: Sign-off & Export     |  | Step 5: Convergence Sign-Off  |
+-------------------------------+  +-------------------------------+  +-------------------------------+
```

---

## 3. Detailed Module Specifications

### Module 1: Shaft Face Mapping (`ShaftMappingModal.tsx`)
- **Step 1: Shaft & Bench Setup**: Shaft Name/ID, Collar Elevation ($m$), Finished/Excavated Diameter ($m$), Current Bench Start/End Depth ($m$), Date/Time, Geotechnical Engineer name.
- **Step 2: 360° Cylindrical Perimeter Unwrapped Wall**:
  - Interactive unfolded view divided into quadrants ($0^\circ \text{ N} \to 90^\circ \text{ E} \to 180^\circ \text{ S} \to 270^\circ \text{ W} \to 360^\circ \text{ N}$).
  - Lithology zones with distinct pattern hatches, fault/shear traces, water seep points.
- **Step 3: Shaft Floor Face Mapping**:
  - Radial interactive SVG/Canvas representation of the horizontal shaft floor face.
  - Planar structural geology (bedding, foliation, joints) with Dip/Dip-Direction and RQD rating.
- **Step 4: Shaft NATM Support System**:
  - Support Class (e.g., S-I to S-V), Circular Lattice Girders / Ring Beams, Radial Rockbolts (length, pattern), Fiber-Reinforced Shotcrete thickness ($mm$).
- **Step 5: Review, Sign-off & Export**:
  - Quality checks, Geologist signature, CSV/JSON and formatted PDF-style print preview.

### Module 2: Probe Hole Drilling (`ProbeHoleDrillingModal.tsx`)
- **Step 1: Probing Setup**:
  - Face Station Chainage ($km+m$), Hole ID, Borehole Type (Centerline exploratory probe, Crown advance drainage/probe, Invert probe), Target Depth (e.g. 15–30 $m$), Inclination/Dip ($^\circ$), Azimuth ($^\circ$).
- **Step 2: Drilling Interval Performance Logging**:
  - Discrete drilling runs (0–3m, 3–6m, etc.).
  - Penetration Rate (min/meter or cm/min), Feed Pressure (bar), Rotation Speed (rpm), Flushing Water Return (% returned vs. lost circulation).
- **Step 3: Hydrological & Ingress Intercepts**:
  - Ingress location along hole ($m$), Water Inflow Rate ($L/min$), Static Pressure ($bar$), Water clarity (clear, turbid, silty, mud slurry).
- **Step 4: Ahead-of-Face Geological Hazard Assessment**:
  - RQD estimation ahead of the tunnel face, Fault gouge / shearing detection, Karst cavity / void intercept alert, Gas presence, Forward Risk Score (Low / Medium / High / Critical).
  - Clearance Distance: Safe excavation advance permitted before next required probe hole.
- **Step 5: Engineer Sign-off & Notification Dispatch**:
  - Forward hazard advisory for the NATM excavation shift supervisor.

### Module 3: Instrumentation & Monitoring (`MonitoringDashboardModal.tsx`)
- **Step 1: Monitoring Section (MS) Array Configuration**:
  - Station Chainage (e.g., $Ch\ 12+450$), Section Type (Standard Convergence Array, Heavy Monitoring Section).
  - Deployed Instruments: 3D Optical Reflective Targets (Roof Crown $C$, Left Wall $L$, Right Wall $R$), MPBX (Multiple Point Borehole Extensometer at 2m, 4m, 7m, 10m depths), Hydraulic Shotcrete Stress Cells (Radial & Tangential).
- **Step 2: Measurement Recording & Auto-Calculation**:
  - Raw optical coordinates ($X, Y, Z$) with baseline calibration.
  - Automatic calculation of: Roof Crown Settlement $\Delta Z$ ($mm$), Side-wall Convergence $\Delta X$ ($mm$), Longitudinal Drift $\Delta Y$ ($mm$).
  - Extensometer anchor differential ground strain ($\mu\varepsilon$ or $mm$ displacement).
  - Shotcrete lining stress readings ($\sigma_r, \sigma_\theta$ in $MPa$).
- **Step 3: Time-Deformation Trends & Velocity Analysis**:
  - Convergence vs. Time and Settlement vs. Distance-from-Face curves.
  - Deformation velocity rates ($mm/\text{day}$) and acceleration indicators (Decelerating / Stable vs Accelerating / Unstable).
- **Step 4: 3-Tier Trigger Action Response Plan (TARP)**:
  - **Level 1 (Green / Normal)**: Rate $< 1\text{ mm/day}$, total convergence $< 70\%$ allowable. Standard excavation continues.
  - **Level 2 (Amber / Alert)**: Rate $1 - 3\text{ mm/day}$, $70\% - 90\%$ allowable. Halve advance round, increase shotcrete thickness, install additional spiles/rockbolts.
  - **Level 3 (Red / Alarm)**: Rate $> 3\text{ mm/day}$ or accelerating. Immediate face evacuation, ring closure, invert strut installation.
- **Step 5: Sign-off & Automated Compliance Reporting**.

---

## 4. UI/UX & High-Contrast Visual Integration
- Buttons placed directly between **3D Continuous Tunnel Logging** and **Geological & Geotechnical Core Logging** in `src/App.tsx`.
- Styling: High-contrast buttons with bold, distinct badges, clear black text inside light tags or dark-themed container with sharp contrasting borders and icons:
  - **Shaft Face Mapping**: Compass & Cylindrical Depth icon, distinct cyan/teal accent with crisp `#000000` text in high-visibility badges.
  - **Probe Hole Drilling**: Drilling bit & Forward Radar icon, distinct amber/orange accent with crisp black text badges.
  - **Instrumentation & Monitoring**: Sensor gauge & Waveform trend icon, distinct emerald/green accent with crisp black text badges.
- All forms, input fields, tables, and modal headers enforce high-contrast font rules (`text-stone-900 dark:text-stone-100 font-bold`) ensuring maximum legibility on site and under harsh tunnel lighting conditions.

---

## 5. Verification & Testing Plan
1. **Compilation & Syntax**: Validate that TypeScript definitions, component interfaces, and state objects compile cleanly with zero errors via `compile_applet` and `lint_applet`.
2. **Button Sequence Verification**: Confirm the exact visual order in `src/App.tsx` matches:
   - Underground Face Mapping
   - 3D Continuous Tunnel Logging
   - **Shaft Face Mapping** *(New)*
   - **Probe Hole Drilling** *(New)*
   - **Instrumentation & Monitoring** *(New)*
   - Geological & Geotechnical Core Logging
3. **Workflow Integrity**: Verify that clicking each button opens its independent modal/workspace with full step-by-step navigation, data entry, interactive visualizers, and state persistence.
4. **Contrast & Readability Audit**: Inspect all buttons, badges, tables, and input elements to ensure black/high-contrast text is applied consistently across both light and dark modes.
