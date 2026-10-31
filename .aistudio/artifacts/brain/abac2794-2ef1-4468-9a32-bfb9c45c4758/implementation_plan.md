# One-Time Master Stress-Test & End-to-End Verification Plan

## 1. Overview & Goal
Execute a **one-time, comprehensive end-to-end stress test and verification audit** across all 12 Underground Face Mapping stages in the background—**without adding any permanent test buttons or diagnostic modals to your application UI**.

We will run an automated verification harness (`tsx` script) against the actual application engines and stage logic, feed edge-case and interchanged parameters across all 12 stages, fix any calculation or UI handler bugs discovered, remove the temporary test harness once 100% of checks pass, and provide a full audit summary.

---

## 2. 12-Stage Stress-Test & Parameter-Interchange Audit Scope

1. **Stage 1 — Project, Location & Custom Profile Geometry (`project_setup`)**
   - Feed standard shapes (Horseshoe, D-Shape, Circular, Rectangular) and asymmetric custom polygons (e.g., 3-segment triangle, 5-segment cavern).
   - Interchange `widthM`, `heightM`, `wallHeightM`, and `crownRadiusM` and verify panel partitioning (`left_wall`, `crown`, `right_wall`, `invert`) and 2D/3D metric coordinates never produce `NaN`, inverted axes, or phantom panels.

2. **Stage 2 — Excavation Round, Chainage & Pull Parsing (`excavation_round`)**
   - Stress-test chainage formats (`"100"`, `"RD 100"`, `"CH 0+100.5"`, `"1+250.0"`) and pull lengths (`0.5m` to `15m`).
   - Verify `chainageTo` auto-calculation and ensure `parseRoundChainageMeters` never inflates `RD 100` into `1000m`.

3. **Stage 3 — 2D/3D Face Canvas & Orientation Sync (`field_canvas`)**
   - Feed all 6 drawing tools (Lithology, Vein/Foliation, Joint Trace, Dip Surface, Structural Feature, Water Mark).
   - Verify `estimateTraceOrientationFromGeometry`, `autoComputeOrientationFromPlot`, and 3D custom profile plane-facet intersections (`joint3DInspectorEngine.ts`).
   - Verify compass overrides (`editedByCompass`) lock dip/dip-direction against unintentional resets.

4. **Stage 4 — Joint Grouping & Stereographic Clustering (`joint_grouping`)**
   - Feed multi-set joint traces (`J1`, `J2`, `J3`, `Foliation`, `Random`) and verify set re-assignment, color sync, and mean orientation vector averaging.

5. **Stage 5 — 2D Unfolded Strip Log (`strip_align`)**
   - Verify full-panel lithology strokes render as closed polygons (`resolveClosedLithologyPolygonFromTrace`) rather than thin lines.
   - Verify lithology & dip surfaces remain strictly non-editable in the Strip Log while joint traces & structural features support endpoint dragging, vertex bending (`+ Bend`), and `Join 2 Traces`.

6. **Stage 6 — Discontinuity Sets Table Sync (`discontinuity_sets`)**
   - Interchange persistence, aperture, roughness, infilling, and weathering values and verify bidirectional synchronization between canvas traces and the Discontinuity Sets table.

7. **Stage 7 — Rock Mass Classifications: RMR89, Q-System & GSI (`q_rmr_gsi`)**
   - Stress-test all parameter combinations across Classes I–V.
   - Verify monotonicity when interchanging values (increasing `RQD`, `UCS`, `Jr`, or `Jw` must strictly increase `RMR`/`Q`; increasing `Jn`, `Ja`, or `SRF` must strictly decrease `Q`).

8. **Stage 8 — Support System & Spot Bolt Engine (`support_system`)**
   - Verify rock class upgrade behavior (`Class III -> Class II -> Class I`) strictly increases rock mass shear strength and reduces/eliminates spot bolts (never triggering false spot bolts when upgrading rock class).
   - Verify spot bolts are placed strictly on `crown`, `left_wall`, or `right_wall` (never on `face`) and never leak faults from other projects/locations.

9. **Stage 9 — Continuum FEM & Discontinuum DEM Analysis (`fem_dem_analysis`)**
   - Interchange overburden depth, GSI, intact UCS, $m_i$, and support pressure; verify plastic radius, crown convergence, and Factor of Safety respond accurately without numerical instability.

10. **Stage 10 — Survey & Overbreak / Underbreak Payline Math (`survey_overbreak`)**
    - Feed design vs. excavated cross-sections and verify exact overbreak/underbreak area ($m^2$), volume ($m^3$), and percentage math.

11. **Stages 11 & 12 — Clean Report, 2D Photo Report & Advance Look-Ahead (`word_template_export`, `photo_2d_report`, `advance_analysis`)**
    - Verify report data bindings and 3D look-ahead apparent dip & weak-zone distance calculations.

---

## 3. Execution & Cleanup Workflow
1. Create a temporary verification script (`scripts/runMasterStressTest.ts`) that exercises all 12 stages and prints detailed pass/fail diagnostics.
2. Run the script via `run_command` and inspect any failures, edge-case NaNs, or value-interchange bugs.
3. Fix all identified issues directly in the production engine/component files.
4. Re-run the stress test to confirm **100% pass rate**, delete the temporary test script so the repository remains clean, and run `lint_applet` and `compile_applet`.
