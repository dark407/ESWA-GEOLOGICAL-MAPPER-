# Field Mapping Precision & Native Packaging Upgrade Plan

This plan addresses the five field-testing discoveries across the 2D/3D geological mapping engine, interactive 3D inspection workspace, cross-panel boundary tracing workflow, and Windows/Android native installers.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Product Decisions from Field Testing**
> 1. **Strict User-Traced Visibility (No Automatic Cross-Panel Joint Projections)**: Tracing a joint or dip surface on the Face will **never** automatically generate synthetic projected traces on the Left Wall, Crown, Right Wall, or Strip Log. Only user-logged lithology, user-traced joints, geological features, and dip surfaces appear by default, with an optional **3D Plane Preview** toggle for temporary structural visualization.
> 2. **Cross-Portion Boundary Continuation with Glowing Snap Indicator**: Stopping a trace near an outline boundary edge displays a contextual bottom bar prompt (**Extend to [Related Portion] →**). Tapping it switches directly to that adjacent portion canvas and places a high-visibility glowing start-point snap marker at the exact corresponding metric coordinate along the shared boundary.
> 3. **3D Inspector for Both Joints & Dip Surfaces with Dual Orientation Editing**: Enabling the **Inspection Mode** toggle on the canvas allows tapping any Joint Trace or Dip Surface to open the 3D Inspector Module, supporting both interactive 3D plane/disk gizmo dragging and direct Dip / Dip Direction sliders with real-time stereonet and 2D canvas synchronization.

---

## 1. Overview & Core Concept

### Root-Cause Diagnosis: Why Face Joints Appeared on Left Wall, Right Wall, Crown & Strip Log
During our audit of the mapping and strip-log rendering pipeline, we identified the exact mechanism causing untraced joints to appear on the Crown and Walls:
- **Infinite 3D Plane Extrapolation on Unfolded Panels**: Whenever a joint was traced on the **Face** with a valid Dip and Dip Direction, the 2D unfolded sketch renderer and the Strip Alignment engine automatically constructed an infinite 3D mathematical plane from the Face trace's centroid and calculated its intersection segments across the Left Wall, Crown, and Right Wall. Those synthetic intersections were injected into the active trace list and rendered as dashed purple curves across the walls and crown even when the geologist had not mapped anything on those portions.
- **Unfiltered Strip Log Synchronization**: The continuous 3D Strip Log synchronization loop copied all round joints—including Face-only traces and auto-extrapolated plane intersections—directly into the longitudinal strip dataset.

### Core Upgrade Scope
1. **Pure User-Logged Strip Log & Panel Rendering**: Strip out automatic synthetic projections from the Left Wall, Crown, Right Wall, Strip Alignment view, and Continuous Strip Log so only genuine user-logged lithology, user-traced joints, structural features, and dip surfaces are recorded and displayed, while providing an explicit, opt-in **3D Plane Preview** toggle when theoretical plane intersection checks are desired.
2. **One-Tap Canvas Inspection Toggle & 3D Dip Surface Inspector**: Add a dedicated **Inspect Mode** toggle button on the mapping toolbar so touching any joint or dip surface on the canvas immediately launches the 3D Inspector. Upgrade the 3D Inspector to load **Dip Surfaces** alongside Joints, complete with interactive 3D orientation gizmo rings, live Dip/Dip Direction sliders, stereonet pole/great-circle feedback, and direct write-back to the mapped feature.
3. **Seamless Cross-Portion Trace Continuation**: Detect when any lithology boundary, joint trace, foliation/vein band, or geological feature ends at or near a shared boundary edge between portions (Face ↔ Crown, Face ↔ Left Wall, Face ↔ Right Wall, Crown ↔ Left Wall, Crown ↔ Right Wall) and offer a 1-tap bottom prompt to switch panels and snap seamlessly to the exact boundary transfer point.
4. **Windows `.exe` Custom Icon Embedding**: Fix the build pipeline where executable resource editing was bypassed and multi-resolution ICO layers were missing, ensuring the custom ESWA Geological Mapper icon appears on the `.exe` installer, desktop shortcut, taskbar, and application title bar.
5. **In-Place Updates Without Data Loss (Windows `.exe` & Android `.apk`)**: Configure consistent application identifiers, monotonic version codes, persistent V1+V2 APK signing keys, and NSIS in-place upgrade directives (`deleteAppDataOnUninstall: false`, `allowUpgrades: true`) alongside an in-app backup/restore safeguard so installing a newer `.exe` or `.apk` updates cleanly over the existing app without uninstalling or losing field data.

---

## 2. User Experience & Visual Design

### Aesthetic & Atmospheric Polarity
- **Intentional Dark Mode for 3D Spatial Inspection (`#0A0E17` Obsidian Slate)**: The 3D Joint & Dip Surface Inspector uses a deep slate spatial viewport with high-contrast cyan (`#38BDF8`), amber (`#F59E0B`), and emerald (`#10B981`) vector gizmos so dip planes, normal vectors, and stereonet poles read clearly under underground or bright field conditions.
- **High-Craft Light/Paper Technical Canvas for 2D Mapping (`#F8FAFC` Engineering Paper)**: The 2D Face, Crown, Wall, and Strip Log sheets maintain crisp dark ink linework (`#0F172A`), tabular numeric callouts (`JetBrains Mono`), and high-visibility boundary snap beacons.

### Key Interactive Flows

#### Flow A: Clean Panel Tracing & Optional 3D Plane Preview
- **Default Field Behavior**: When the user traces joints, lithology contacts, or dip surfaces on the **Face**, the **Crown**, **Left Wall**, **Right Wall**, and **Strip Log** remain completely clean until the user explicitly traces features on those portions.
- **Strip Log Fidelity**: Opening the **Strip Log** displays strictly the user-logged lithologies, user-traced joints, mapped geological features, and dip surfaces recorded on the strip panels.
- **Opt-In 3D Plane Preview**: A secondary toolbar toggle (**3D Plane Preview: OFF / ON**) allows the geologist to momentarily preview theoretical plane intersections without polluting saved panel traces or strip log outputs.

#### Flow B: 1-Tap Inspection Mode & 3D Dip Surface Editing
- **Canvas Inspection Mode Toggle**: A prominent **Inspect 3D** toggle button sits in the primary canvas control bar.
  - When **Inspect 3D** is active, the canvas cursor/touch mode switches to inspection selection, highlighting interactive hit targets around all mapped **Joint Traces** and **Dip Surfaces**.
  - Touching or clicking any Joint Trace or Dip Surface on the canvas immediately opens the **3D Structural Inspector Modal** focused on that feature.
- **3D Dip Surface & Joint Orientation Manipulation**:
  - **Interactive 3D Disk & Normal Gizmo**: Inside the Three.js viewport, the selected Dip Surface or Joint Plane renders as a translucent geological disk clipped to the tunnel excavation volume, surrounded by an interactive azimuthal ring (Dip Direction `000°–360°`) and inclination arc handle (Dip `00°–90°`). Dragging the gizmo rotates the 3D dip plane in real time.
  - **Precision Sliders & Stereonet Sync**: Linked Dip Direction and Dip Angle sliders and numeric steppers update simultaneously with the 3D gizmo, dynamically recalculating the lower-hemisphere stereonet great circle, pole position, kinematic daylighting status, and 2D dip symbol orientation on the canvas.

#### Flow C: Cross-Portion Boundary Continuation (`Face ↔ Crown ↔ Walls`)
- **Boundary Stop Detection**: While drawing a trace (Joint, Lithology Contact, Foliation/Vein, or Structural Feature) on any panel, if the stroke approaches or terminates within the boundary threshold of an adjacent portion outline:
  - **Face Canvas**: Top Arch boundary → *Crown* (`At Face / Pull M` edge); Left boundary → *Left Wall* (`At Face / Pull M` edge); Right boundary → *Right Wall* (`At Face / Pull M` edge).
  - **Crown Canvas**: Front edge → *Face* (corresponding arch coordinate); Left Springline → *Left Wall* (top springline at same Pull M); Right Springline → *Right Wall* (top springline at same Pull M).
  - **Left / Right Wall Canvas**: Front Face edge → *Face* (left/right wall height `Z` above invert); Top Springline edge → *Crown* (left/right springline at same Pull M).
- **Bottom Action Prompt**: A high-contrast bottom dock banner appears:
  `Boundary Reached ([Current Panel] → [Target Panel] at [Metric Coord]) • [Extend to [Target Panel] →]`
- **Seamless Switch & Glowing Snap Marker**: Tapping **Extend to [Target Panel] →** commits the current trace segment, switches the active canvas to the target portion, keeps the same active tool and geological attributes selected, and renders a pulsing **Cyan/Emerald Continuation Beacon** on the exact corresponding boundary point. The user's first tap near the beacon automatically snaps to that exact boundary coordinate so the trace continues across portions with zero gap or misalignment.

#### Flow D: Windows `.exe` Icon & Seamless Windows/Android App Updates
- **Authentic Windows Application Icon**: The `.exe` installer, desktop shortcut, taskbar button, and window header display the custom ESWA Geological Mapper crest across all DPI scales (`16×16` through `256×256`).
- **Zero-Uninstall In-Place Update**:
  - Running a newly downloaded Windows `.exe` installer automatically detects the existing installation, preserves all user project databases in `AppData`, and upgrades the binary in place without requiring uninstallation.
  - Installing a newly downloaded Android `.apk` shares the exact canonical package ID (`com.eswa.tunnelmapper.user`), deterministic signing certificate, and auto-incremented `versionCode`, allowing Android's package installer to show **"Do you want to update this app? Your existing data will not be lost."**

---

## 3. Key Product Decisions & Trade-Offs

| Decision Area | Chosen Approach | Rationale |
| :--- | :--- | :--- |
| **3D Plane Extrapolation** | Disabled by default; isolated behind an opt-in transient preview flag | Prevents false/unmapped joints from contaminating Crown, Wall, and Strip Log engineering deliverables while retaining mathematical plane analysis when requested. |
| **Cross-Portion Transfer Mapping** | Exact physical-meter parameterization (`zM` elevation, `sM` arch arc-length, `pullM` chainage) | Ensures that custom and asymmetric tunnel geometries transfer boundary coordinates accurately even when panel aspect ratios differ. |
| **3D Dip Surface Editing** | Unified 3D Inspector supporting both `FieldJointTrace` and `FieldDipPlaneSurface` with gizmo + slider bi-directional sync | Gives field geologists tactile visual verification of dip azimuth and inclination relative to the tunnel drive axis before committing changes. |
| **Native Update Continuity** | Deterministic keystore + monotonic `versionCode` (Android) & persistent `appId` + `deleteAppDataOnUninstall: false` (Windows) | Eliminates `INSTALL_FAILED_UPDATE_INCOMPATIBLE` on Android and prevents accidental local database deletion during Windows upgrades. |

---

## 4. Technical Architecture & Data Strategy

### System Architecture & Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        2D UNWRAPPED MAPPING CANVAS                         │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │ User-Traced Features │  │ Boundary Stop Engine │  │ Inspect 3D Mode  │  │
│  │ (Lithology, Joints,  │  │ Detects Edge Stop &  │  │ Toggle ON: Tap   │  │
│  │  Features, Dip Surf) │  │ Maps Metric (Z,S,X)  │  │ Joint or DipSurf │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └────────┬─────────┘  │
└─────────────┼─────────────────────────┼───────────────────────┼────────────┘
              │                         │                       │
              ▼                         ▼                       ▼
┌─────────────────────────┐  ┌──────────────────────┐  ┌─────────────────────┐
│   STRIP LOG & REPORT    │  │ CROSS-PANEL SNAP     │  │ 3D INSPECTOR MODULE │
│ • Filters out synthetic │  │ • Bottom Bar Prompt  │  │ • Three.js Tunnel + │
│   face projections      │  │ • Switches Panel     │  │   Clipped Dip Disk  │
│ • Displays only logged  │  │ • Renders Glowing    │  │ • Interactive 3D    │
│   Crown/Wall/Face items │  │   Snap Target Marker │  │   Gizmo & Sliders   │
└─────────────────────────┘  └──────────────────────┘  └─────────────────────┘
```

### Interactive State & Mathematical Mapping

1. **Cross-Portion Coordinate Transfer State (`BoundaryContinuationTarget`)**
   - Stores `{ sourcePanel, targetPanel, featureCategory, linkedFeatureId, targetPointNormalized: { x, y }, metricLabel, dip, dipDirection, lithologyCode }`.
   - **Metric Parameterization**:
     - **Face ↔ Left / Right Wall**: Maps vertical normalized coordinate on the Face wall edge to physical height above invert $Z_m \in [0, H_{wall}]$, then converts $Z_m$ to the normalized vertical coordinate along the `At Face (Pull M)` boundary of the Left or Right Wall panel.
     - **Face ↔ Crown**: Maps the normalized arc position $u \in [0, 1]$ along the Face crown arch perimeter to the transverse arc coordinate across the `At Face (Pull M)` boundary of the Crown panel.
     - **Crown ↔ Left / Right Wall**: Maps the longitudinal chainage offset $X_{pull} \in [0, L_{pull}]$ along the Left or Right Springline of the Crown directly to the matching longitudinal coordinate along the top Springline of the Left or Right Wall.

2. **3D Inspector Target Polymorphism (`Inspected3DTarget`)**
   - Supports `{ type: 'joint', id: string } | { type: 'dip_surface', id: string }`.
   - When a Dip Surface is loaded into the 3D Inspector:
     - Reconstructs its 3D anchor point on the mapped tunnel boundary (`face`, `crown`, `left_wall`, or `right_wall`) using the tunnel profile geometry.
     - Renders an interactive 3D plane disk, normal arrow, dip vector arrow, and draggable azimuthal/inclination handles.
     - Editing Dip or Dip Direction via the 3D gizmo or sliders immediately updates `round.dipPlaneSurfaces` (or `round.jointTraces`), refreshing both the 3D stereonet and the 2D canvas symbol.

3. **Native Packaging & In-Place Update Pipeline**
   - **Windows Executable Icon & NSIS Updater**:
     - Generate a compliant multi-resolution `.ico` file (`16×16`, `32×32`, `48×48`, `64×64`, `128×128`, `256×256` PNG/BMP frames) and configure `BrowserWindow` + `app.setAppUserModelId` + `rcedit` embedding (`CSC_IDENTITY_AUTO_DISCOVERY=false` without disabling `signAndEditExecutable`).
     - Configure NSIS installer flags (`deleteAppDataOnUninstall: false`, `oneClick: false`, `perMachine: false`, `allowElevation: true`) so running a new `.exe` upgrades the existing installation in-place while keeping `IndexedDB` / `localStorage` and file-system project backups untouched.
   - **Android APK Seamless Upgrade**:
     - Unify the Android `applicationId` (`com.eswa.tunnelmapper.user`) across the manifest generator and bytecode package, persist a deterministic RSA signing key across builds, and encode a monotonically increasing `versionCode` so Android OS treats every new APK download as an in-place upgrade over the installed app.
