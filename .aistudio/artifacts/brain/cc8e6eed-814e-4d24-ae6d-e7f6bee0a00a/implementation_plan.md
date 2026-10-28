# 3D Dual Canvas: AI Photo Reconstruction & Synchronized 3D Geological Mapping

Implement a dual-canvas 3D workflow for underground tunnel mapping: **Left Viewport (3D Drawing & Geological CAD)** and **Right Viewport (3D Photo & Photogrammetry Texture)**, powered by AI analysis that maps uploaded and edited rock face photos onto the true 3D tunnel cross-section geometry, with full real-time camera and cursor synchronization.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Layout & Architecture Choice**: Based on your confirmation, the 3D Dual Canvas mode provides a split layout:
> - **Left Viewport**: Interactive 3D Drawing Canvas with editable joint planes, lithology patterns, dip surfaces, structural features, and water markings.
> - **Right Viewport**: Interactive 3D Photo Canvas with uploaded/edited rock face photos projected onto the 3D tunnel mesh, complete with geological image filters (Ridge, Invert, B&W, Iron Oxide, Chlorite, Seepage) and AI feature detection.
> - **Real-time Two-Way Sync**: Camera rotation/zoom/pan on either canvas updates both models synchronously, with live 3D cursor tracking and Shift-key trace peeking.

---

## 1. Overview & Core Concept

- **What It Does**: Extends the existing 2D dual-canvas concept into a rich, synchronized 3D dual-viewport system. Geologists can view the true 3D CAD drawing model side-by-side with the 3D textured photogrammetry model.
- **Key Value**: Eliminates distortion between 2D drawings and real rock mass geometry. An engineer or geologist can trace a fracture in 3D while looking directly at the high-resolution rock surface photograph wrapped onto the tunnel heading in 3D.
- **AI Photo Analysis**: AI analyzes uploaded photos to detect major discontinuities, estimate strike/dip hints, and optimize texture alignment to the tunnel's physical cross-section (Horseshoe, D-Shaped, Circular, Rectangular, or Custom Freeform Profile).

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Activate 3D Dual Canvas**:
   - In 3D Mapping Mode, a layout switcher in the top/bottom dock offers:
     - `Single 3D Drawing` (full width)
     - `Single 3D Photo` (full width)
     - `3D Dual Split` (Side-by-Side: Left 3D Drawing, Right 3D Photo)
2. **Synchronized 3D Orbit & Inspection**:
   - Orbiting, panning, or zooming in either viewport immediately updates both viewports in 60fps real time.
   - Quick Camera Presets: **Face Heading**, **Inside Drive View**, **Perspective 3D**, **Isometric Ortho**.
3. **AI Photogrammetry Reconstruction**:
   - One-tap "AI 3D Reconstruct" extracts edge features, corrects lens perspective against the physical tunnel width ($W$) and height ($H$), and texture-maps the photo onto the heading face and perimeter walls with proper depth ($L_{\text{pull}}$).
4. **Geological Image Filters on 3D Photo**:
   - Filter toolbar: Normal RGB, Negative/Invert, High B&W Contrast, Ridge/Edge Convolution, Red Channel (Iron Oxide), Green Channel (Chlorite), Blue Channel (Moisture Seepage), Thermal Heatmap.
   - Brightness, Contrast, and Wireframe Overlay controls.
5. **Two-Way Synchronization**:
   - Moving the pointer in either viewport casts a 3D ray onto the tunnel mesh, rendering a synchronized 3D crosshair and metric coordinates $(X, Y, Z)$ in both viewports.
   - Holding `Shift` on the 3D Photo viewport overlays the drawn joint planes and lithology onto the photo texture.

### Visual Styling

- **Theme**: Dark CAD slate palette (`bg-slate-950`, `border-slate-800`) matching existing ESWA tunnel mapping ergonomics.
- **Header Badges**: Left header labelled `3D CAD DRAWING (GEOLOGICAL MODEL)`, right header labelled `3D ROCK PHOTOGRAMMETRY (FITTED PHOTO)`.
- **Sync Indicator**: High-contrast green status pill `⚡ 3D Camera & Cursor Synced`.

---

## 3. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       3D DUAL CANVAS WORKSPACE                              │
├──────────────────────────────────────┬──────────────────────────────────────┤
│          LEFT VIEWPORT:              │           RIGHT VIEWPORT:            │
│         3D DRAWING MODEL             │          3D PHOTO MODEL              │
│                                      │                                      │
│  ┌────────────────────────────────┐  │  ┌────────────────────────────────┐  │
│  │ Field3DTunnelCanvas            │  │  │ Tunnel3DPhotoCanvas            │  │
│  │ - 3D Tunnel Mesh Geometry      │  │  │ - 3D Tunnel Mesh Geometry      │  │
│  │ - Joint Discontinuity Discs    │  │  │ - Photo Texture Mapping        │  │
│  │ - Lithology Hatch Patterns     │  │  │ - Geological Image Filters     │  │
│  │ - Dip Surface Vectors          │  │  │ - AI Feature Overlay           │  │
│  │ - 3D Trace Polyline Mesh       │  │  │ - Wireframe / Structural Grid  │  │
│  └────────────────────────────────┘  │  └────────────────────────────────┘  │
├──────────────────────────────────────┴──────────────────────────────────────┤
│                         SHARED SYNC CONTROLLER                              │
│   Camera Orbit (Theta, Phi, Radius, Target)  ◄──►  Two-Way State Bridge     │
│   Hover 3D Coordinate (X, Y, Z, Panel, Dist) ◄──►  Live Reticle Sync        │
│   Active Geological Round & Photo Texture    ◄──►  Photogrammetry Texture   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component & State Mapping

1. **`src/components/FieldMappingModeWorkspace.tsx`**:
   - Manage `is3DDualCanvasActive` state (defaulting to split mode when in photogrammetry workflow).
   - Maintain shared camera orbit state `{ theta, phi, radius, target: Vector3 }`.
   - Maintain shared 3D hover/pointer coordinate `{ x, y, z, panel }` for cross-viewport cursor sync.
   - Pass camera state updates bidirectionally between Left and Right 3D viewports.
2. **`src/components/Tunnel3DPhotoCanvas.tsx`**:
   - Upgrade camera controller to support external camera synchronization props (`syncCameraState`, `onCameraChange`).
   - Add support for displaying drawn 3D traces as a toggleable/peeking overlay on top of the 3D photo mesh.
   - Implement texture projection onto exact tunnel profile shapes (horseshoe, circular, D-shaped, rectangular, freeform).
   - Add shared pointer raycasting to emit and receive 3D hover coordinates.
3. **`src/components/Field3DTunnelCanvas.tsx`**:
   - Accept shared camera state and hover coordinates from the parent.
   - Render synchronized 3D crosshair marker when hovering over the photo canvas.
   - Provide clean split-viewport layout responsiveness.
4. **`src/engine/aiTunnelReconstructionEngine.ts`**:
   - New modular engine for analyzing the photo, calculating photogrammetric UV coordinates, detecting fracture planes, and projecting texture coordinates across tunnel heading and sidewalls.

---

## 4. Verification Plan

1. **Compilation & Linting**:
   - Run `compile_applet` and `lint_applet` to confirm zero TypeScript and syntax errors.
2. **Dual 3D Viewport Interaction**:
   - Verify splitting into Left (3D Drawing) and Right (3D Photo) models.
   - Verify camera orbit in Left rotates Right with identical angle and zoom in real time.
   - Verify camera orbit in Right rotates Left synchronously.
3. **AI Photogrammetry & Texture Mapping**:
   - Verify photo mapping to Horseshoe, D-Shaped, and Circular tunnel cross-sections without distortion.
   - Verify brightness, contrast, and geological filter application (Ridge, Invert, B&W, etc.).
4. **Drawing & Peeking Synchronization**:
   - Verify hovering shows synced cursor coordinates in both 3D viewports.
   - Verify Shift key reveals drawn joint traces directly over the 3D rock photo.
