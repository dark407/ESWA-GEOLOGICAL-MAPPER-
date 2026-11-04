# Logged-Data Geotechnical Reference Value Engine for FEM & DEM Analysis (Underground & Surface Mapping)

## 1. Objective & Root Cause Resolution
Currently, the FEM & DEM numerical analysis engine (`src/engine/femDemAnalysisEngine.ts`) and stage workspace (`src/components/FieldFemDemAnalysisStage.tsx`) suffer from a critical engineering flaw when resolving **Common Reference Values**:
- **Unmapped / Unmatched Fallback to Generic Median Values**: When `round.strengthIndex` or `round.weatheringIndex` is not explicitly clicked, or when a mapped lithology stroke uses a catalog ID (e.g., `'1_granite'`, `'24_quartz_mica_schist'`, `'48_fault_gouge'`), the engine falls back to hardcoded median defaults (`S3 = 72 MPa`, `RMR UCS Rating 7 = 75 MPa`, `WII`, `Granite`) and blends `0.6 * S3 + 0.4 * lithoRef`, producing generic medium numbers instead of values grounded in the actual logged rock types, UCS, and joint features.
- **Ignoring Area-Weighted Multi-Lithology & Vein/Fault Zones**: When multiple rock units, vein/foliation bands, or fault/shear zones are mapped on the face/walls/crown/slope, the reference values do not weight properties by mapped stroke area/coverage or account for fault/shear weakening.
- **Discontinuum (DEM) Joint Reference Values Disconnected from Mapped Traces & Faults**: Joint parameters ($JRC$, $JCS$, $\phi_b$, $c_j$, $e_0$, $K_n$, $K_s$) were using static baselines instead of synthesizing all logged discontinuity sets (`round.discontinuitySets`), mapped 2D joint traces (`round.jointTraces`), 3D dip plane surfaces (`round.dipPlaneSurfaces`), and structural features (`round.structuralFeatures` such as Faults, Shear Zones, and Fold Axes).

---

## 2. Architecture of the Logged-Data Reference Value Engine

### A. Full-Catalog Area-Weighted Lithology & Structural Zone Resolver (`src/engine/femDemAnalysisEngine.ts`)
1. **Complete Catalog Resolution**:
   - Map every rock type and ID in `FIELD_LITHOLOGY_CATALOG` and `FIELD_VEIN_AND_FOLIATION_CATALOG` (plus custom/remembered rocks in `round.alternateLithologyConfig` and project memory) to rigorous published geotechnical properties ($\gamma$, $\sigma_{ci}$, $m_i$, $MR$, $E_i$, $\nu$, $\sigma_t$, base $\phi_b$, and base $JRC$).
2. **Area-Weighted Composite Lithology Calculation**:
   - Compute the relative polygon/stroke coverage weight ($w_k$, $\sum w_k = 1.0$) of every logged lithology stroke across the active excavation panels (Face, Left Wall, Right Wall, Crown, Shaft 360° Quadrants, or Surface Slope).
   - Incorporate `round.alternateLithologyConfig` (interbedded / alternate rock percentages) and `round.structuralFeatures` (Faults / Shear Zones / Breccia bands) into the weighted rock mass composite.
   - Calculate the **Area-Weighted Logged Reference Baseline** for Unit Weight ($\gamma$), Intact UCS ($\sigma_{ci}$), Hoek–Brown Constant ($m_i$), Modulus Ratio ($MR$), Intact Modulus ($E_i = MR \cdot \sigma_{ci}$), Poisson's Ratio ($\nu$), and Tensile Strength ($\sigma_t$).

### B. Strict Logged-Data Priority for Intact UCS ($\sigma_{ci}$), Weathering, and Classifications
1. **Strict Priority Hierarchy (Zero Generic S3/72 MPa Blending)**:
   - **Priority 1**: Engineer explicit test/override value (`siteTestMeasurements.intactUcsMpa` or `parameterOverrides.intactUcsMpa`).
   - **Priority 2**: Logged ISRM Strength Index (`S1`–`S6`) and/or RMR89 UCS Rating (`round.rmrSystem.ucsRating`), refined within the band using the area-weighted logged lithology UCS and logged Weathering Grade (`WI`–`WVI`) rather than averaging with an unlogged `72 MPa` default.
   - **Priority 3**: Area-weighted logged lithology UCS adjusted by logged Weathering Grade (or weathering inferred from logged discontinuity set weathering / Q-system $J_a$ rating if `weatheringIndex` was not separately clicked).
2. **Automatic Classification Synthesis When Partially Logged**:
   - If the user has logged lithology, joint traces/sets, and UCS/weathering, automatically compute a **Logged-Data Reference RMR89, Q, and GSI** from the mapped volumetric joint density ($J_v \rightarrow RQD$), logged joint spacing/persistence/roughness/infilling, logged UCS, and logged water marks so that Rock Mass Modulus ($E_{rm}$), Hoek–Brown ($m_b, s, a, \sigma_{cm}$), and Mohr–Coulomb ($c_{rm}, \phi_{rm}$) are 100% derived from the round's logged geological data.

### C. Joint & Fault/Shear Feature Derivation for DEM & Rock Mass Parameters
1. **Unified Discontinuity & Structural Feature Aggregator**:
   - Aggregate data from all four logged structural sources in the round:
     - `round.discontinuitySets` (J1, J2, J3, J4, Bedding/Foliation: spacing, length/persistence, aperture, roughness, infilling, weathering, groundwater).
     - `round.jointTraces` (mapped trace lengths, set assignments, dip/dip-direction, panel locations).
     - `round.dipPlaneSurfaces` (3D dip facets, strike/dip).
     - `round.structuralFeatures` (Faults, Shear Zones, Fold Axes — applying gouge/shear reductions to $JRC$, $\phi_r$, $c_j$, and stiffness $K_n, K_s$).
2. **Physics-Based Derivation of All 7 DEM Parameters**:
   - **Joint Roughness ($JRC$)**: Weighted from logged set roughness classes (`Very Rough` $\rightarrow 17$, `Rough` $\rightarrow 13$, `Slightly Rough` $\rightarrow 9$, `Smooth` $\rightarrow 5$, `Slickensided` $\rightarrow 2$), Q-system $J_r$, RMR roughness sub-rating, and reduced where shear/fault features are mapped.
   - **Joint Wall Strength ($JCS$)**: Derived from the logged intact UCS ($\sigma_{ci}$), logged joint wall weathering, and Barton–Choubey weathering reduction factor.
   - **Basic / Residual Friction Angle ($\phi_b / \phi_r$)**: Derived from the area-weighted lithology mineral friction angle, adjusted by logged $J_r / J_a$ (`atan(Jr/Ja)`), clay/chlorite/gouge infilling, and weathering ratio $(JCS / \sigma_{ci})$.
   - **Joint Cohesion ($c_j$) & Aperture ($e_0$)**: Derived directly from logged aperture categories (`<0.1mm Tight` to `>5mm Wide`), logged infilling type (`None/Clean`, `Quartz/Calcite Healed`, `Hard Non-Softening`, `Soft Clay/Gouge`), trace persistence, and fault/shear presence.
   - **Joint Normal ($K_n$) & Shear Stiffness ($K_s$)**: Computed via Bandis et al. (1983) hyperbolic stiffness equations using the logged $E_{rm}$, logged mean joint spacing, derived aperture $e_0$, $JCS$, and $JRC$.
3. **Stress & Hydraulic Reference Derivation (Underground & Surface)**:
   - **Overburden / Slope Height ($H$)**: Derived from logged chainage/elevation/cover metadata, or for Surface Mapping (`mappingDomain === 'SURFACE'`) directly from `surfaceParams.slopeHeightM`, and for Vertical Shaft from shaft depth/chainage (`round.chainageTo`).
   - **Horizontal-to-Vertical Stress Ratio ($K_0$)**: Derived from Sheorey (1994) thermo-elastic crustal stress equation $K_0 = 0.25 + 7 E_h (0.001 + 1/H)$ using the logged rock mass horizontal modulus $E_h$ (and tectonic fault/fold adjustment when structural features are mapped).
   - **Joint Pore Water Pressure ($u_w$)**: Derived from mapped water seepage symbols (`round.waterMarks`), discontinuity set groundwater state (`Dry`, `Damp`, `Wet`, `Dripping`, `Flowing`), RMR groundwater rating, and Q-system $J_w$.

---

## 3. UI & Workflow Enhancements (`src/components/FieldFemDemAnalysisStage.tsx`)
1. **Logged-Data Reference Basis Banner & Breakdown**:
   - Display a clear **"Logged Geological Basis"** summary strip showing the exact area-weighted lithologies (e.g., `68% Quartz-Mica Schist + 22% Quartzite + 10% Shear Zone`), logged UCS source, mapped joint trace/set count, and structural features driving the reference values.
2. **Auto-Population + One-Click "Apply Logged-Data Reference Values" Button**:
   - All `defaultReferenceValue` and automatic parameter values (`value`) in both **Underground Mapping (Tunnel & Shaft)** and **Surface Mapping** automatically reflect the logged-data calculation.
   - Add a one-click **"Apply Logged-Data Reference Values"** button in both the Top Control Bar, the Prerequisite Gate card (allowing instant unlocking of missing Overburden/UCS/Classification using the round's logged lithology and joint data), and the Parameters panel/modal, plus a per-parameter **"Use Logged Ref"** button on any overridden card.
3. **Continuous 3D Strip & Standalone Report Sync**:
   - Ensure `FieldFemDemReportEmbedSection` and `exportStandaloneFemDemWordReport` cite the exact logged lithology percentages, joint sets/traces, and UCS basis for every parameter.
