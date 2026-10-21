# Implementation Plan — NATM Joint Trace Orientation: True Dip, Apparent Dip & Multi-Surface Projection Matrix

## 1. Geological Background & User Problem Statement

In NATM tunnel face mapping, geologists frequently experience confusion when correlating a 3D joint plane with its 2D surface traces:
- **Tunnel Geometry Reference**:
  - The **Excavation Face** is a vertical plane oriented perpendicular to the tunnel drive axis.
  - The **Sidewalls** (Left & Right) are vertical planes running parallel to the tunnel drive axis.
  - The **Crown / Back** is an overhead curved surface whose apex tangent is horizontal.
- **The Core Geometric Truths**:
  1. **Crown Arch Trace = Strike Line**: An intersection between any plane and a horizontal reference surface (the crown apex) is strictly the **Strike direction** of the joint.
  2. **Face & Sidewall Traces = Apparent Dips**:
     - The true dip angle is visible on a vertical surface *only* if that surface is perpendicular to the strike of the joint ($\beta = 90^\circ$).
     - On any wall oriented at an oblique angle $\beta$ to the strike, the visible trace inclination is the **Apparent Dip** ($\alpha_{\text{app}}$), governed by:
       $$\tan(\alpha_{\text{app}}) = \tan(\alpha_{\text{true}}) \cdot \sin(\beta)$$
     - When the joint strike is parallel to the wall ($\beta = 0^\circ$), the apparent dip is $0^\circ$, producing a **horizontal trace**.
  3. **User Scenarios Explained**:
     - *Drive $000^\circ$, Joint $090^\circ / 75^\circ$*: Strike is $000^\circ$ (parallel to sidewalls, perpendicular to face). On the Face, you observe the true dip ($75^\circ$ E). On the sidewalls, the apparent dip is $0^\circ$ (horizontal line). On the crown, the trace runs straight along the drive axis ($000^\circ$).
     - *Joint $045^\circ / 45^\circ$*: Oblique to both face and sidewalls. Both face and sidewalls show apparent dips flatter than $45^\circ$, while the crown trace crosses obliquely at $135^\circ$.

---

## 2. Proposed Architecture & Component Updates

### Phase A: Calculation Engine Extension (`joint3DInspectorEngine.ts`)
- Add dedicated apparent dip calculation functions:
  - `calculateApparentDipOnVerticalWall(trueDipDeg, trueDipDirDeg, wallAzimuthDeg)`
  - `calculateSurfaceApparentTraceAngles(strikeInfo, tunnelGeometry)`
  - Return exact metric and angular trace data for all 4 surfaces:
    - **Face Panel** ($90^\circ$ to drive): Apparent dip angle and dip direction (Left/Right across face).
    - **Left Sidewall** ($0^\circ$ to drive): Apparent dip angle and plunge direction (Toward Face / Toward Portal).
    - **Right Sidewall** ($0^\circ$ to drive): Apparent dip angle and plunge direction.
    - **Crown Arch**: Strike trend and offset from tunnel centerline.
    - **Geological Explanation String**: Natural-language explanation clarifying whether the trace represents True Dip, Apparent Dip, or Strike, and the exact angular reason.

### Phase B: 3D Joint Inspector Modal (`NatmJoint3DInspectorModal.tsx`)
1. **Live Apparent vs. True Dip Matrix Panel**:
   - Add a dedicated visual card in the inspector parameter sidebar:
     - `True 3D Orientation`: $\alpha_{\text{dir}} / \delta_{\text{dip}}$ (e.g. $090^\circ / 75^\circ$)
     - `Face Apparent Dip`: angle and direction across face
     - `Left Wall Apparent Dip`: angle and plunge direction
     - `Right Wall Apparent Dip`: angle and plunge direction
     - `Crown Trace Angle`: strike angle relative to advance axis
2. **Interactive 2D Surface Projection Tabs**:
   - On the Face, Left Wall, Right Wall, and Crown tabs:
     - Clearly label the displayed line with both **Observed Trace** and **Calculated Apparent Dip**.
     - Display a concise geotechnical note: *"This wall is oblique to strike by $\beta = XX^\circ$. Visible inclination is Apparent Dip ($XX^\circ$), corresponding to True Dip $XX^\circ$ in 3D."*
3. **Multi-Surface 3D Spatial Visualization**:
   - In the pure white 3D CAD canvas, highlight the calculated intersection lines on all surfaces with distinct colored dashed traces, demonstrating in real 3D how a single plane creates a tilted line on the face, horizontal or inclined lines on the walls, and a strike line on the roof.

### Phase C: Field Mapping Workspace Compass & Panels (`FieldMappingCompassAndPatterns.tsx` & `FieldMappingModeWorkspace.tsx`)
- Enhance the `FieldLiveCompassInclinometer` widget:
  - When the mapper enters or drags True Dip & Dip Direction, display the real-time calculated Apparent Dip badge for the active mapping panel (Face, Left Wall, Right Wall, or Crown).
  - Add an inline tooltip/indicator explaining: *"Face Trace: XX° apparent dip | Crown: XX° strike"*.

---

## 3. Verification & Testing Checklist
- [ ] Test mathematical engine against analytical geological stereonet standards:
  - Dip Direction $090^\circ$, Dip $75^\circ$ on Heading $000^\circ$: Face apparent dip must equal $75^\circ$; sidewall apparent dip must equal $0^\circ$.
  - Dip Direction $000^\circ$, Dip $45^\circ$ on Heading $000^\circ$: Face apparent dip must equal $0^\circ$; sidewall apparent dip must equal $45^\circ$.
  - Dip Direction $045^\circ$, Dip $45^\circ$ on Heading $000^\circ$: Face and sidewalls must show exact calculated apparent dip ($\approx 35.3^\circ$).
- [ ] Verify clean, responsive rendering without lag in the 3D CAD canvas.
- [ ] Verify `npm run lint` and `npm run build` pass with zero errors.
