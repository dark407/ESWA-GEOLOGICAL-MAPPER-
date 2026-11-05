# 3D Digital Twin & Photogrammetry Workbench for ESWA GEOLOGICAL MAPPER

This plan introduces a step-by-step **3D Digital Twin & Photogrammetry Workbench** that converts field photographs (single calibrated photos or multi-angle stereo/photogrammetry sets) into metric, texture-draped 3D rock relief models for **Tunnels**, **Vertical Shafts**, and **Surface Excavations**. Geologists and engineers can click 3+ points on any 3D rock facet, project 2D traces onto 3D surface relief, triangulate tie-points across multiple surfaces, or run automatic facet plane clustering to extract exact **Dip Direction (0°–359°)**, **Dip Amount (0°–90° Inwards/Outwards)**, **Strike (RHR)**, and **3D Dip Surfaces** with direct synchronization into the **Field Mapping Workspace** and **3D Joint Inspector**.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> All four product decisions below incorporate your confirmed choices and establish how the photogrammetry pipeline integrates into **ESWA GEOLOGICAL MAPPER**.

- **Confirmed Photo & 3D Inputs**:
  1. **Single or Multi-Photo 3D Rock Surface Reconstruction**: Extracts camera intrinsics (EXIF focal length + Brown-Conrady radial/tangential lens undistortion), computes stereo disparity / structure-from-motion (SfM) + shape-from-shading relief displacement maps, and generates a metric 3D displaced rock mesh.
  2. **Calibrated Photo-Draping onto 3D Tunnel, Shaft & Surface Profiles**: Uses projective homography and piecewise control points to drape field photos onto the exact 3D tunnel cross-section (Face, Left Wall, Right Wall, Crown Arch), Vertical Shaft cylindrical bowl (Bottom Face + 4 Quadrant Walls: NE, ES, SW, WN), or Surface exposure (Slope, Bench, Outcrop, Trench).
- **Confirmed Orientation & Dip Surface Extraction Methods**:
  1. **3-Point or Polygon Click on 3D Rock Facet**: Raycasts directly onto the 3D displaced rock mesh to pick $N \ge 3$ vertices, fits an exact least-squares plane (SVD / principal eigenvector normal), and computes True Dip Direction, True Dip Amount (with Inwards/Outwards sense), Strike, and a 3D Dip Surface polygon.
  2. **2D Photo Trace Projection onto 3D Rock Relief**: Projects any drawn 2D joint polyline onto the underlying 3D photogrammetric relief mesh and fits a best-fit 3D plane through the non-coplanar 3D relief curve (collinearity check + planar confidence score).
  3. **Cross-Surface Multi-Photo Tie-Point Triangulation**: Links homologous joint trace points across two or more surfaces (e.g., Excavation Face + Crown Arch, or Left Wall + Crown) to triangulate the true 3D cutting plane across the excavation perimeter.
  4. **Automatic Rock Facet Normal & Dip Plane Detection**: Analyzes the reconstructed 3D mesh normal map and local curvature to highlight candidate exposed rock facets and cluster them into Joint Sets ($J_1, J_2, J_3, \dots$).
- **Confirmed Workflow Placement**:
  - **Dual Access Architecture**: Available both as a **Dedicated Top-Level 3D Digital Twin Photogrammetry Workbench** (accessible from the main workspace header and mode bar) and **Directly Integrated inside the Field Mapping Workspace & 3D Joint Inspector** with one-click bidirectional synchronization.
- **Confirmed Excavation Domains**:
  - **Tunnel Rounds** (Face, Left Wall, Right Wall, Crown Arch), **Vertical Shafts** (Bottom Face at Pull 0m + 4 Quadrant Walls 0°–360°), **Surface Mapping** (Slope, Bench, Outcrop, Trench), and **Continuous Multi-Round 3D Excavation Chainage Stitching**.

---

## 1. Overview & Core Concept

- **What It Does**:
  Transforms ordinary underground or surface field photographs into an interactive, metric-scaled **3D Digital Twin** where every pixel on the rock surface has true $(X_{\text{drive}}, Y_{\text{transverse}}, Z_{\text{elevation}})$ coordinates and a 3D surface normal vector $\mathbf{n} = (n_x, n_y, n_z)$.
- **Target Audience / Persona**:
  Tunnel geologists, NATM/TBM rock mechanics engineers, shaft mapping engineers, and slope stability specialists who need accurate, auditable 3D discontinuity orientations (`Dip Direction / Dip Amount / Strike`) from field photographs without physical compass access to high crowns or unsupported faces.
- **Key Value**:
  Eliminates apparent-dip guesswork on flat 2D photos by reconstructing the actual 3D rock surface relief and multi-surface geometry, allowing direct 3D plane measurement and instant transfer to the 2D mapping sheet, 3D Joint Inspector, stereonet, and engineering reports.

---

## 2. User Experience & Visual Design

### Step-by-Step User Workflow (5 Guided Stages)

1. **Step 1 — Domain & Round Geometry Calibration**:
   - Select or inherit the active excavation domain (**Tunnel**, **Vertical Shaft**, or **Surface Exposure**), round chainage/depth interval (e.g., `CH 120.0m – 123.0m`), drive azimuth (`N ° E`), and cross-section dimensions.
2. **Step 2 — Photo Upload, EXIF Lens Undistortion & Surface Assignment**:
   - Upload single or multiple photos for **Face**, **Left Wall**, **Right Wall**, **Crown** (or Shaft Quadrants `1. NE`, `2. ES`, `3. SW`, `4. WN`).
   - Automatic EXIF focal-length extraction and Brown-Conrady lens undistortion, plus interactive 4-corner / perimeter alignment anchors to lock each photo to metric tunnel coordinates.
3. **Step 3 — 3D Photogrammetric Relief & Digital Twin Reconstruction**:
   - Reconstructs a high-resolution displaced 3D rock mesh combining multi-view stereo correspondence (when overlapping photos are provided) and high-frequency structure-from-shading / rock-edge relief depth estimation.
   - Users can adjust **3D Relief Depth Scale (m)**, toggle **True Photo Texture**, **3D Surface Normal Color Map**, **Elevation Contours**, or **Wireframe Mesh**, and stitch consecutive rounds into a **Continuous Multi-Round 3D Digital Twin Corridor**.
4. **Step 4 — Interactive 3D Dip Surface & Joint Extraction (4 Modes)**:
   - **Mode A: 3-Point / Polygon Facet Picker**: Click 3 or more points directly on an exposed rock facet in the 3D viewport. A live 3D Dip Disk and fitted polygon snap to the rock facet, displaying live **Dip Direction**, **Dip Amount (Inwards / Outwards)**, **Strike (RHR)**, and **Planar Fit RMSE (mm)**.
   - **Mode B: 2D Photo Trace → 3D Relief Projection**: Draw or select a joint trace on the photo; the engine projects all vertices onto the 3D rock relief mesh and solves the best-fit 3D plane from the 3D surface curvature.
   - **Mode C: Cross-Surface Tie-Point Triangulation**: Click a trace on the Face/Wall and its continuation on the Crown/Adjacent Wall; the engine solves the exact 3D plane cutting both surfaces.
   - **Mode D: Auto Facet & Dip Plane Detector**: Scans the 3D Digital Twin mesh normals to detect prominent planar rock facets, clusters them into structural sets ($J_1, J_2, J_3$), and lets the user accept or refine each detected dip surface.
5. **Step 5 — One-Click Sync to 2D Mapping Canvas & 3D Joint Inspector**:
   - Every measured 3D joint or dip surface can be pushed immediately to the active **Field Mapping Round** and opened in the **3D Joint Inspector** (preserving `PHOTOGRAMMETRY_MULTIVIEW` measurement provenance, confidence rating, and 180° half-circle Inwards/Outwards dip controls).

### Visual Identity & Viewport Architecture
- **Aesthetic Direction**: Precision geotechnical CAD & scientific photogrammetry studio matching ESWA GEOLOGICAL MAPPER’s dual-theme (Light CAD White & Dark Slate) engineering interface.
- **Color & Encoding**:
  - **60% Viewport Canvas**: Crisp studio white (`#FFFFFF`) or deep engineering slate (`#0F172A`) 3D WebGL viewport.
  - **30% Structural Control Panels**: Clean slate/white sidebars with hairline borders and tabular monospace readouts (`font-mono tabular-nums`).
  - **10% Semantic Accents**: Electric Cyan (`#06B6D4`) for 3D raycast pick points and tie-lines, Amber Gold (`#F59E0B`) for Dip Direction vectors and fitted 3D cutting planes, and Emerald (`#10B981`) for high-confidence planar fits and Dip Inwards indicators.
- **Zero-Lag On-Demand WebGL Rendering**:
  - Uses the coalesced on-demand `requestRender()` architecture with cached GPU textures, hardware/software WebGL detection, and `THREE.Raycaster` spatial picking so orbiting and picking on the 3D Digital Twin run at 60 FPS without main-thread stalls.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Hybrid Client-Side Photogrammetry Engine (Multi-View Disparity + Shape-from-Shading Relief)**
  - *Chosen Approach*: Combine calibrated projective photo-draping with client-side stereo block matching (for overlapping photo pairs) and multi-scale gradient/luminance relief reconstruction (for single photos of tunnel faces/walls), producing a metric displaced `THREE.BufferGeometry` mesh directly in the browser.
  - *Why*: Works 100% offline in underground tunnel environments and desktop/APK builds without requiring external cloud GPU servers, while still giving real 3D rock relief (`ΔX, ΔY, ΔZ`) for 3-point facet picking and trace projection.
- **Decision 2: SVD / Eigenvector Least-Squares 3D Plane Solver with Collinearity & RMSE Audit**
  - *Chosen Approach*: When a user picks $N \ge 3$ points on a 3D rock facet or projects a trace across curved/displaced 3D relief, compute the 3×3 covariance matrix of the 3D metric points and extract the smallest eigenvector as the unit normal $\mathbf{n}$, reporting both **Planar Fit RMSE (m)** and **Condition Number / Non-Collinearity Confidence (`HIGH | MEDIUM | LOW`)**.
  - *Why*: Guarantees mathematically exact geological orientation (`Dip Direction`, `Dip Amount`, `Strike RHR`) and prevents degenerate plane fits when points are nearly collinear.
- **Decision 3: Bidirectional Sync with Field Mapping & 3D Joint Inspector**
  - *Chosen Approach*: Extracted photogrammetric joints and dip surfaces write directly into the round’s `jointTraces` and `dipSurfaces` arrays with `measurementSource: 'PHOTOGRAMMETRY_MULTIVIEW'` and can be opened immediately in the **3D Joint Inspector** for endpoint-based (`P1`/`P2`) or hinge-based Dip Inwards/Outwards refinement.
  - *Why*: Ensures a unified data model where photogrammetric measurements automatically populate stereonets, Q-system / RMR calculations, and A3/TPM engineering sheets.

---

## 4. Technical Architecture & Data Strategy

### System Architecture & Data Flow Diagram

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                    ESWA GEOLOGICAL MAPPER — WORKSPACE & HEADER                    │
│   [Field Mapping Workspace]  ◄───►  [3D Digital Twin Photogrammetry Workbench]    │
└───────────────┬───────────────────────────────────────────────────┬───────────────┘
                │                                                   │
                ▼                                                   ▼
┌─────────────────────────────────────────┐       ┌─────────────────────────────────┐
│  PHOTO & CALIBRATION PIPELINE           │       │  EXCAVATION DOMAIN PROFILES     │
│  • EXIF Focal & Brown-Conrady Undistort │──────►│  • Tunnel (Face/Walls/Crown)    │
│  • 4-Corner / Perimeter Metric Homography│      │  • Vertical Shaft (Bowl + 4 Q)  │
│  • Stereo Disparity & Relief Depth Map  │       │  • Surface (Slope/Bench/Trench) │
└───────────────────┬─────────────────────┘       │  • Multi-Round Chainage Stitch  │
                    │                             └─────────────────┬───────────────┘
                    ▼                                               │
┌───────────────────────────────────────────────────────────────────┴───────────────┐
│              3D DIGITAL TWIN MESH & RAYCAST ENGINE (ON-DEMAND THREE.JS)           │
│  • Displaced 3D Rock Surface Mesh (BufferGeometry + Photo Texture + Normal Map)   │
│  • Interactive 3D Raycaster (Sub-centimeter (X, Y, Z) & Normal Vector Picking)    │
└───────┬───────────────────────────┬───────────────────────────┬───────────────────┘
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────────┐
│ 1. 3-POINT / POLYGON  │ │ 2. 2D TRACE TO 3D       │ │ 3. CROSS-SURFACE TIE-POINT  │
│    FACET PLANE FIT    │ │    RELIEF PROJECTION    │ │    & 4. AUTO FACET DETECTOR │
│ • Click 3+ 3D points  │ │ • Project polyline onto │ │ • Link Face + Crown/Walls   │
│ • SVD Plane Fit + RMSE│ │   3D relief & solve dip │ │ • Normal Histogram Clusters │
└───────────┬───────────┘ └────────────┬────────────┘ └──────────────┬──────────────┘
            │                          │                             │
            └──────────────────────────┼─────────────────────────────┘
                                       ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│        UNIFIED GEOLOGICAL OUTPUT & 3D JOINT INSPECTOR SYNCHRONIZATION             │
│  • Exact Dip Direction (0°–359°), Dip Amount (0°–90° Inwards/Outwards), Strike    │
│  • Saves FieldJointTrace & FieldDipPlaneSurface (PHOTOGRAMMETRY_MULTIVIEW)        │
│  • Instant reflection in 2D Canvas, 3D Joint Inspector, Stereonet & Reports       │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State Strategy

1. **`DigitalTwinSurfacePhotoRecord`**:
   - Stores per-surface calibrated photo data (`panelId: 'face' | 'left_wall' | 'right_wall' | 'crown' | 'shaft_sn'`, `imageDataUrl`, `calibration` intrinsics, `reliefDepthScaleM`, `meshResolution`, `alignmentAnchors2D`, and generated `heightMapFloat32`).
2. **`PhotogrammetricFacetPick` & `TriangulatedTieGroup`**:
   - Stores 3D picked vertices `points3D: Vec3D[]` in tunnel metric coordinates (`x` drive, `y` transverse, `z` elevation), fitted plane equation `(a, b, c, d)`, `dipDirectionDeg`, `dipAmountDeg`, `dipHalfCircleSense: 'inwards' | 'outwards'`, `strikeRhrDeg`, `rmseM`, `confidence: 'HIGH' | 'MEDIUM' | 'LOW'`, and target `setId` (`J1`–`J6`).
3. **Interactive Component & State Mapping**:
   - **Top-Level & In-Workspace Launchers**: Users can open the **3D Digital Twin Photogrammetry Workbench** from the main navigation bar, from the Field Mapping toolbar, or directly from inside the **3D Joint Inspector Modal**.
   - **Interactive 3D Viewport Modes**: Segmented toolbar switches cleanly between `Orbit & Inspect`, `3-Point / Polygon Facet Pick`, `2D Trace Projection`, `Cross-Surface Tie-Points`, and `Auto Facet Scan`.
   - **Multi-Round Digital Twin Corridor**: Toggle between inspecting the **Current Round 3D Digital Twin** and the **Stitched Multi-Round 3D Tunnel/Shaft Corridor** across saved rounds.
