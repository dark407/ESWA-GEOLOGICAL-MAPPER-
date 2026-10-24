# Domain-Specific Engineering Terminology & Layouts for Surface Mapping

Replace underground tunnel terminology (width, breadth, height, chainage, drive direction, crown, invert, left/right walls) throughout all surface mapping workflows (Bench, Trench, Slope, Outcrop) with dedicated civil, mining, and geotechnical engineering parameters, viewports, and calculation models.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following design decisions were confirmed and have now been fully implemented:
> - **Confirmed Choice 1 (Geometric Dimensions)**: Dedicated engineering dimensions customized per surface structure type (Bench Height $H_b$ & Berm Width $W_b$ for Benches; Depth $D_t$, Bottom Width $W_t$, and Length for Trenches; Slope Height $H_s$, Slope Angle, and Aspect for Slopes; Exposure Span $W_r$, Height $H_r$, and Dip/Strike for Outcrops).
> - **Confirmed Choice 2 (Viewport & Panel Layouts)**: Domain-specific viewport arrangements (Bench Face + Upper Berm + Toe / Floor Cut + Side Flank Cut; 3-Panel Trench [Left Trench Wall, Trench Floor, Right Trench Wall, Trench End Face]; Slope Face + Upper Crest Zone + Slope Toe & Ditch + Lateral Flank Cut; 1-Panel Outcrop Window with Scanline Grid and Flank traces).
> - **Confirmed Choice 3 (Orientation & Excavation)**: Replaced "Tunnel Drive Direction" and "Excavation Approach" with "Face Strike / Dip Direction (°)" and surface-appropriate excavation methods (Pre-split Blasting, Mechanical Ripping, Backhoe Trenching, Natural Exposure).

---

## 1. Implementation Summary

1. **`src/engine/surfaceMappingEngine.ts`**:
   - `getSurfacePanelLabelMap`: Completely purged all remnants of `LEFT WALL` / `RIGHT WALL` from Bench, Slope, and Rock Surface domains.
     - **Bench**: `Bench Face`, `Upper Berm / Crest`, `Toe / Floor Cut`, `Side Flank Cut`.
     - **Trench**: `Trench End Face`, `Left Trench Wall`, `Right Trench Wall`, `Trench Floor`.
     - **Slope**: `Main Slope Face`, `Upper Crest Zone`, `Slope Toe & Ditch`, `Lateral Flank Cut`.
     - **Rock Surface**: `Rock Exposure Face`, `Upper Crest Trace`, `Left Exposure Flank`, `Right Exposure Flank`.
   - `getDomainExcavationMethodOptions(domain)`: Generates domain-tailored formation and excavation methods with Romana SMR $F_4$ scores:
     - Bench: Presplit Blasting (+10), Smooth Blasting (+8), Mechanical Ripping (0), Production Bench Blasting (-8), Natural Slope (+15).
     - Trench: Backhoe / Excavator Trenching (0), Hydraulic Rock Breaker (0), Hand-dug Geological Trench (+10), Controlled Trench Blasting (-8).
     - Slope: Controlled Trim Blasting (+10), Smooth Slope Blasting (+8), Mechanical Cut & Trim (0), Natural Rock Slope (+15).
     - Rock Surface: Natural Bedrock Exposure (+15), Foundation Excavation / Prep (0), Roadcut Mechanical Excavation (0), Surface Outcrop Blasting (-8).

2. **`src/components/FieldMappingCompassAndPatterns.tsx`**:
   - `FieldCanvasGeometryReferenceOverlay`:
     - Axis and ruler labels: $H_b$ (Bench Height), $W_b$ (Berm Width), $D_t$ (Trench Depth), $W_t$ (Bottom Width), $H_s$ (Slope Height), $H_r$ (Exposure Height), $W_r$ (Exposure Length), Axis Azimuth, Face Strike / Dip Direction.
     - Non-face panels dynamically display domain-specific titles and abbreviations (`L-TOP`, `R-TOP`, `TOE`, `FLANK`).

3. **`src/components/FieldMappingModeWorkspace.tsx`**:
   - Station & Face Creation Modal: Renders domain-specific station labels (`ST` vs `CH`), span lengths (`m L` vs `Pull`), and domain-specific excavation options.
   - Stage 2 Station & Geometry Details: Renders domain-appropriate titles, dedicated dimension inputs, and dynamic excavation selects.
   - Canvas Watermark: Formatted with exact domain dimension strings ($H_b$, $D_t$, $H_s$, $H_r$, $W_t$).
   - Dual-Canvas & Photo Integration: Tooltips, tabs, and photo upload labels display the exact surface structure name and panel label rather than "Tunnel" or "Underground".
   - High Contrast: Text colors remain crisp and legible against their respective backgrounds.

---

## 2. Verification Results

- `lint_applet`: Passed with 0 errors (`tsc --noEmit`).
- `compile_applet`: Build succeeded, output assets verified.
