# Implementation Plan & Execution Summary — Surface Mapping Clean Reports, Domain Isolation & Boundary Geometry

## 1. Objectives & Resolution Matrix

### A. Surface Mapping Clean Report — All Portions Unrolled & Accessible
- **Problem**: In surface mapping (`TRENCH`, `ROCK_SURFACE`), only one portion was appearing in the report; the other portions were inaccessible.
- **Resolution**:
  - `TRENCH` now has a dedicated 3-page engineering report layout displaying all 4 unrolled portions: **Left Trench Wall**, **Trench Floor / Invert**, **Right Trench Wall**, and **End Cross-Section Face**.
  - `ROCK_SURFACE` displays the full outcrop mapping window and high-resolution CAD map without truncation.
  - Page 2 renders discontinuity sets with domain-tailored structural characterization.
  - Page 3 renders RMR89/Q-system, 2D cross-section with trench shoring/foundation bearing, and engineering recommendations.

### B. Strict Domain Isolation — Zero Slope/Bench Contamination in Trench and Open Surface
- **Problem**: Slope stability (Romana SMR, kinematic planar/wedge/toppling slope checks) and benching parameters were erroneously appearing on `TRENCH` and `ROCK_SURFACE` reports.
- **Resolution**:
  - `SLOPE` and `BENCH`: Sole domains displaying Romana SMR, planar/wedge/toppling kinematic checks, bench berm width, crest drainage ditch, catchment berm, and slope stabilization (soil nails/mesh/shotcrete).
  - `TRENCH`: Displays trench sidewall & floor structural characterization, RMR89, Q-system, safe stand-up time, hydraulic trench box shoring, sump dewatering, and foundation allowable bearing capacity ($q_{\text{all}}$). Zero SMR, Zero Benching, Zero Overbreak Payline.
  - `ROCK_SURFACE`: Displays outcrop structural fabric ($J_v$, $I_b$), rock mass rating, ripperability/blasting suitability, and foundation bearing capacity. Zero SMR, Zero Benching, Zero Overbreak Payline.
  - `TUNNEL`: Completely preserved and isolated underground face mapping with strip log, survey overbreak, and support working windows.
  - Both `.doc` (Word) and `.pdf` export engines domain-isolated with custom titles, rows, Section 4 cross-sections, and file naming.

### C. Reference Texts & Control Points Strictly Exterior to Outlines
- **Problem**: In shape and size outlines (including Photo Fit, panel frames, and station previews), reference texts, scale ticks, and control handles were coming inside the outline.
- **Resolution**:
  - **Photo Fit Stage** (`FieldPhotoFitAndReportsStages.tsx`):
    - Crown canonical annotation banners (`0.00m Previous Round Start` and `Advance Pull Face`) positioned strictly exterior to the box perimeter (`boxY + boxH + 8` and `boxY - 32`).
    - 4-corner mesh control pins (`TL`, `TR`, `BR`, `BL`) offset strictly outside corners by 16px with connecting dashed guide stems ($r=12$ pins never intrude into outline).
    - Crop extent handles offset strictly outside crop perimeter.
    - Dimension header callout moved strictly outside outline at $y = \max(22, \text{boxY} - 38)$.
  - **Field Adaptive Panel Frame** (`FieldMappingCompassAndPatterns.tsx`):
    - All 1m meter ticks along outline point purely outwards ($n_x, n_y$), with increased label clearance ($\max(26, \text{labelOffsetDist} + 12)$).
    - Left SPL / Crest markers: control point circles and text placed strictly exterior to the left (circle at -6px, text at -28px).
    - Right SPL / Crest markers: control point circles and text placed strictly exterior to the right (circle at +6px, text at +28px).
    - Crown C/L apex marker: line extends upward (-24px), circle at -7px, text at -30px.
    - Left Wall, Right Wall, and Bottom Span labels: increased exterior margins.

### D. Canvas Window 2D Mode & 3D Joint Inspection in Surface Mapping
- **Canvas View**: The `3D` tunnel model tab in the canvas panel bar and the 3D mesh canvas mode are strictly disabled in surface mapping (`TRENCH`, `ROCK_SURFACE`, `BENCH`, `SLOPE`), keeping the surface drawing canvas window purely in 2D.
- **3D Joint Inspection (Restored)**:
  - The **`3D Joint Inspector`** button in the canvas window header is fully restored and active in surface mapping.
  - The **`3D`** inspect buttons on individual joint trace cards in the canvas drawers and lists are fully restored.
  - The interactive **NATM 3D Joint Inspector Modal** (true dip, apparent dip calculation, multi-surface projection matrix, and 3D spatial CAD visualization) opens and operates seamlessly on all surface mapping joint traces.

---

## 2. Verification Checklist
- [x] `tsc --noEmit` / `lint_applet` passed with zero errors.
- [x] `compile_applet` passed with clean build.
- [x] Surface mapping reports verified for `TRENCH`, `ROCK_SURFACE`, `SLOPE`, and `BENCH`.
- [x] Underground face mapping (`TUNNEL`) verified untouched and fully operational.
- [x] Canvas window drawing in surface mapping operates purely in 2D mode (tunnel 3D cylindrical canvas tab removed).
- [x] 3D Joint Inspection restored and fully accessible on all surface mapping joint traces.
