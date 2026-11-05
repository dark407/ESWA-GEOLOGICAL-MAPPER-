# Implementation Plan: 3D Joint Inspector Tunnel Shape Fidelity, Trace-Hinge Dip Rotation & 90° Compass Alignment

## 1. Overview
This plan resolves three field-reported issues in the **3D Joint Inspector**:
1. **Exact 3D Tunnel Shape & Size Fidelity**: The 3D tunnel shell, face cap, portal contour, unrolled 2D cross-section, and 3D plane clipping envelope will render the exact configured tunnel shape (`d_shaped`, `horseshoe`, `modified_horseshoe`, `circular`, `rectangular`, `freeform_custom`, and open/partial custom profiles) and exact physical dimensions (`widthM`, `heightM`, `wallHeightM`, `leftWallHeightM`, `rightWallHeightM`, `crownRadiusM`, `pullLengthM`).
2. **Smooth Trace-Anchored Hinge Rotation for Both Dip Direction and Dip Amount on Face & Walls**: Adjusting **Dip Direction** or **Dip Amount** on the Face or Sidewalls will smoothly pivot and tilt the 3D discontinuity plane while keeping it anchored to the traced joint line without popping up a blocking warning modal or detaching from the trace.
3. **Eliminate 180° Compass & Azimuth Flip at 90° Vertical Dip**: At `90°` vertical dip (or near-vertical dip), the plane normal, dip vector, 3D compass arrow, stereonet, and numerical readouts (`Dip Direction`, `Strike (RHR)`, and `Apparent Dip`) will preserve the user's drawn/selected dip direction without flipping 180° opposite.

---

## 2. Key Technical Changes

### A. Exact 3D Tunnel Cross-Section Shape & Physical Dimensions
- **Unified Cross-Section Profile Generator (`src/engine/joint3DInspectorEngine.ts`)**:
  - Add a dedicated helper `buildTunnelCrossSectionProfileMetric(geom: TunnelSpatialGeometry)` that generates high-resolution metric `(y, z)` cross-section vertices in `[0, widthM] × [0, heightM]` for every supported tunnel shape:
    - **Custom / Parametric Profile (`customProfile` / `crossSectionPoints`)**: Maps exact evaluated custom profile vertices into metric coordinates, preserving open/unclosed portions (`hasInvert`, `hasLeftWall`, `hasRightWall`, `hasCrown`) and asymmetric left/right wall heights (`leftWallHeightM`, `rightWallHeightM`).
    - **Circular (`circular`)**: Full circular cross-section of diameter `widthM` (and height `heightM`).
    - **Rectangular (`rectangular`)**: Exact rectangular box `[0, widthM] × [0, heightM]` with flat roof and vertical walls.
    - **Horseshoe / Modified Horseshoe (`horseshoe`, `modified_horseshoe`)**: Inward-curving lower sidewalls transitioning smoothly into the arched crown vault using `wallHeightM`, `leftWallHeightM`, `rightWallHeightM`, and `crownRadiusM`.
    - **D-Shaped (`d_shaped`)**: Vertical sidewalls up to `leftWallHeightM` / `rightWallHeightM` with a smooth elliptical/circular crown arch up to `heightM`.
- **Workspace-to-Inspector Geometry Sync (`src/components/FieldMappingModeWorkspace.tsx`)**:
  - Pass the full `activeLocation.shape` (including `'circular'`, `'rectangular'`, `'horseshoe'`, `'modified_horseshoe'`, `'d_shaped'`, `'freeform_custom'`), `crownRadiusM`, `leftWallHeightM`, `rightWallHeightM`, and exact metric cross-section outline points from `computeFaceTunnelOutlineDetails(activeLocation, activeRound)` into `NatmJoint3DInspectorModal`.
- **3D Scene & Plane Clipping (`src/components/NatmJoint3DInspectorModal.tsx` & `src/engine/joint3DInspectorEngine.ts`)**:
  - Use `buildTunnelCrossSectionProfileMetric(tunnelGeometry)` to construct the Three.js 3D tunnel shell, excavation face cap, portal contour, crown roof elevation clamp `getCrownArchRoofY`, 2D projection views, and `clipPlaneToTunnelBox`.

### B. Smooth Trace-Anchored Hinge Rotation for Both Dip Direction & Dip Amount (Face & Walls)
- **Continuous Trace-Anchored Kinematics (`src/engine/joint3DInspectorEngine.ts` & `src/components/NatmJoint3DInspectorModal.tsx`)**:
  - Remove the blocking `hingeIndicationModal` interruption when changing **Dip Amount** or **Dip Direction** on Face and Sidewall joints.
  - Anchor the 3D plane strictly at the traced joint's 3D midpoint (`traceMidPoint`) with the traced joint line highlighted as the hinge axis on the Face or Sidewall.
  - When the user adjusts **Dip Direction** (`0°–359°`), rotate the 3D plane smoothly around the traced joint hinge axis (updating the out-of-face/wall hinge rotation angle and dipping side continuously).
  - When the user adjusts **Dip Amount** (`0°–90°`), tilt the 3D plane smoothly from horizontal (`0°`) to vertical (`90°`) through the traced joint anchor while preserving the active Dip Direction and keeping the plane pinned to the traced joint center and hinge axis.
  - Synchronize the 3D viewport gizmo drag, stereonet drag, Dip Direction slider, Dip Amount slider, and Trace Hinge slider so all controls update the 3D plane in real time without fighting or resetting each other.

### C. Fix 90° Vertical Dip 180° Opposite Compass & Azimuth Bug
- **Preserve Drawn Dip Direction at 90° Vertical Dip (`src/engine/joint3DInspectorEngine.ts`)**:
  - In `constructJointPlane`:
    - Ensure that at `dip = 90°` ($\cos(90^\circ) = 0, \sin(90^\circ) = 1$), the horizontal normal vector `(nx, ny) = (cos(relDip), sin(relDip))` and strike vector `(sx, sy) = (sin(relDip), -cos(relDip))` point strictly in `dipDirectionDeg` without floating-point sign inversion when `nz = 0`.
  - In `constructPlaneFromTraceHinge`:
    - Remove the unconditional `if (rawGeoStrike >= 180) { ux = -ux; uy = -uy; }` flip that forced all vertical/hinged traces into the `0°–180°` strike hemisphere and inverted `derivedDipDirectionDeg` by `180°` whenever a trace was drawn in the `180°–360°` orientation.
    - When `nc` approaches `0` (`dip = 90°`), prevent `signZ = nc >= 0 ? 1 : -1` from flipping `(gradX, gradY)` by 180° due to floating-point `-0` or negative trace vertical component; instead, align the horizontal normal with the user's active `dipDirection` hemisphere.
- **3D Compass Rose & Vector Arrow Sync (`src/components/NatmJoint3DInspectorModal.tsx`)**:
  - Add a live **Dip Direction indicator arrow** on the 3D Compass Rose overlay that points in the exact `dipDirection` azimuth (relative to North and Tunnel Drive Axis), matching the 3D plane's amber dip arrow, stereonet handle, and numeric `Dip / Dip Direction / Strike (RHR)` readouts at all dip angles including `90°`.

---

## 3. Verification Criteria
- **3D Tunnel Shape & Size**: Switching tunnel shape between D-Shaped, Horseshoe, Modified Horseshoe, Circular, Rectangular, and Custom Profile immediately renders the exact matching 3D tunnel cross-section and dimensions in the 3D Joint Inspector.
- **Face & Wall Dip Direction & Dip Amount Rotation**: Sliding either Dip Direction or Dip Amount on any Face or Wall joint smoothly tilts and rotates the 3D plane anchored to the traced joint without detaching or popping up a blocking modal.
- **90° Vertical Dip Consistency**: Setting Dip Amount to `90°` at any Dip Direction (e.g., `045°`, `135°`, `225°`, `315°`) displays the exact same azimuth across the 3D plane normal/dip arrows, 3D Compass Rose, stereonet, and numerical readouts with zero `180°` inversion.
