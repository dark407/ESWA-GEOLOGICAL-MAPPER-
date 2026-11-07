# Cross-Portion Overlap & Missing-Coverage AI 3D Digital Twin Plan

## 1. Per-Portion Primary + Supporting Photo Bays (`Face`, `Left Wall`, `Right Wall`, `Crown` + `Multi-Angle`)
- **Dedicated Portion Photo Slots**:
  - Upgrade the `5. 3D Digital Twin (BETA)` photo bay so each required tunnel/shaft portion (`Face`, `Left Wall`, `Right Wall`, `Crown` — or the 5 shaft portions) has its own structured card with:
    - **Primary Photo Slot** (with instant **Upload** / **Replace** / **Remove** actions).
    - **+ Supporting Photos (`1..N`)** slot for close-ups, oblique angles, upper shoulder views, or overlapping tie-shots for that portion.
    - **General Multi-Angle / Tie-Point Pool** for wide corridor or cross-boundary shots that span multiple surfaces.
- **Portion Readiness & Coverage Checklist**:
  - Show real-time coverage status for each portion based on the active tunnel shape and dimensions (`W × H × Pull`), including whether missing Crown or Shoulder coverage can be recovered from adjacent Wall/Face photos.

## 2. Hold 3D Rendering Until All Photos Are Ready & User Clicks "Build 3D Digital Twin"
- **No Premature / Slushed Rendering**:
  - Stop auto-reconstructing the 3D mesh on every individual photo upload or modal open.
  - While the user is uploading primary and supporting photos across portions, display a clean **Pre-Build Tunnel Coverage & Overlap Readiness Blueprint** on the white viewport showing:
    - Exact tunnel profile silhouette (`W × H × Pull`).
    - Which portions have Primary photos, Supporting photos, or Cross-Portion Donor coverage (e.g., Crown partially or fully covered from Left Wall upper arch + Right Wall upper arch + Face upper rim).
  - The 3D WebGL Digital Twin mesh is synthesized and rendered **only** when the user clicks **"Build & Render 3D Digital Twin (Cross-Portion AI + SfM)"** (or if a previously built 3D Digital Twin state is already saved for the round).

## 3. Deep 6-Stage Cross-Portion AI & Multi-View Photogrammetry Engine
When the user clicks **"Build & Render 3D Digital Twin"**, the engine takes dedicated processing time across a **6-stage pipeline**:
1. **Stage 1/6 — EXIF Optics & Multi-Portion Inventory**:
   - Extracts native aspect ratios, focal lengths, and radial distortion parameters across all Primary and Supporting photos for `Face`, `Left Wall`, `Right Wall`, and `Crown`.
2. **Stage 2/6 — AI Spatial Footprints & Extra-Margin Detection (`/api/ai/reconstruct-digital-twin`)**:
   - Analyzes each photo to determine its true angular footprint inside the tunnel:
     - Detects how much extra Left Wall, Right Wall, and Crown arch perimeter is captured around the edges of wide-angle **Face** photos.
     - Detects how much upper **Crown** arch (haunch/shoulder) is captured in the top region of **Left Wall** and **Right Wall** photos.
     - Detects which **Crown** sub-regions (`left haunch`, `central vault`, `right haunch`, `face junction`) are directly photographed vs. missing.
3. **Stage 3/6 — Cross-Boundary Tie-Point Feature Matching (Face ↔ Walls ↔ Crown)**:
   - Extracts cross-surface tie-points along the Left Springline, Right Springline, Crown Vault, and Face Perimeter to align color, exposure, and rock structure continuity across all uploaded photos.
4. **Stage 4/6 — Missing-Portion Recovery & Extra-Margin Trimming / Blending**:
   - **Face Perimeter Trimming**: Crops away the outer sidewall/crown perspective margins from wide-angle Face photos so only the true Face rock surface is mapped onto the exact tunnel face silhouette, while saving those trimmed outer strips as **Cross-Portion Donor Strips** for the adjacent Walls and Crown.
   - **Crown & Wall Missing-Region Cross-Fill**: If the Crown photo is missing or only covers part of the arch, automatically projects and cosine-blends the upper arch regions from `Left Wall` (left haunch), `Right Wall` (right haunch), `Face` (front crown lip), and any `Supporting Photos` to reconstruct a complete, seamless Crown arch texture.
   - **Blind-Spot Highlight Map**: Computes a per-portion coverage map (`0–100%`) and highlights any remaining unphotographed blind spots.
5. **Stage 5/6 — Multi-View Stereo (MVS) 3D Rock Relief & Overbreak Mesh Generation**:
   - Fuses primary + supporting photos per portion into a high-density 3D displaced rock relief mesh strictly clipped to the exact tunnel shape (`D-Shaped`, `Horseshoe`, `Circular`, `Custom`, or `Vertical Shaft`) on a pure white (`#FFFFFF`) engineering canvas.
6. **Stage 6/6 — Automatic 3D Joint Plane, Dip Surface & Camera Pose Extraction**:
   - Solves 3D camera frustum poses for every primary and supporting photo and extracts 3D rock facets (`Dip Direction`, `Dip Amount` with 180° Inwards/Outwards sense, and `RHR Strike`) ready to sync to the next Face Canvas by Portion.
