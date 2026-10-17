# Strict Workspace & Domain Isolation Architecture

Isolate application state, persistent stores, geometries, and project databases across all underground and surface domains (**Tunnel**, **Bench**, **Trench**, **Slope**, and **Rock Surface Outcrop**), and completely decouple **Underground Field Mapping** from **Photogrammetry Mode** to prevent cross-contamination.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Based on your confirmed choices in Phase 1:
> - **Domain Partitioning**: Enforce strict domain isolation across **Tunnel**, **Bench**, **Trench**, **Slope**, and **Rock Surface Outcrop**.
> - **Project & Geometry Storage**: Separate project libraries and geometry profiles per domain with dedicated storage keys and an explicit, optional manual copy/import tool so changes made in one domain never bleed into another.

- **Confirmed Decision 1**: Dedicated storage partitions for each domain (`TUNNEL`, `BENCH`, `TRENCH`, `SLOPE`, `ROCK_SURFACE`) so editing Slope stability never alters Bench parameters, and logging Trench intervals never touches Tunnel rounds.
- **Confirmed Decision 2**: Strict decoupling between Underground Field Mapping and Photogrammetry. Field mapping edits stay confined to the active excavation round without mutating Photogrammetry's working canvas or draft state.

---

## 1. Overview & Core Concept

Currently, several domains and modes share top-level React state and broad storage keys (such as `SURFACE_MAPPING_STORAGE_KEY` and shared geometry props in `App.tsx`). When an engineer edits a Slope parameter, it alters the shared surface storage and affects Bench and Trench views. Similarly, actions inside the Field Mapping workspace update the top-level Photogrammetry geometry and joint state.

This architecture enforces **zero-leakage modular isolation**:
1. **Isolated Persistent Data Stores**: Every domain maintains an independent, dedicated persistent storage bucket.
2. **Independent Surface Geometry Profiles**: Bench, Trench, Slope, and Rock Surface each maintain isolated geometric and geotechnical parameters.
3. **Decoupled Field vs. Photogrammetry State**: Field Mapping operates exclusively on its internal round store without triggering side-effect mutations on the Photogrammetry workspace.
4. **Domain-Scoped Project & Memory Manager**: Projects, stations, and custom profiles belong to their respective domain, with clean cross-domain import tools when desired.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ESWA MAIN NAVIGATION                            │
│  [Underground Face Mapping]   [Continuous Tunnel Log]   [Surface Eng]  │
└───────────────────┬───────────────────────────────────────────┬────────┘
                    │                                           │
         ┌──────────┴──────────┐                     ┌──────────┴──────────┐
         │  UNDERGROUND DOMAIN │                     │   SURFACE DOMAIN    │
         └──────────┬──────────┘                     └──────────┬──────────┘
                    │                                           │
        ┌───────────┴───────────┐                 ┌─────────────┼─────────────┐
        ▼                       ▼                 ▼             ▼             ▼
┌───────────────┐       ┌───────────────┐   ┌───────────┐ ┌───────────┐ ┌───────────┐
│ Field Mapping │       │ Photogrammetry│   │   Bench   │ │   Slope   │ │  Trench   │
│  Round Store  │  ◄-X-►│  Draft Store  │   │   Store   │ │   Store   │ │   Store   │
│ (Independent) │       │ (Independent) │   │(Isolated) │ │(Isolated) │ │(Isolated) │
└───────────────┘       └───────────────┘   └───────────┘ └───────────┘ └───────────┘
```

1. **Domain Context Indicator & Switcher**:
   - A distinct visual domain badge (e.g., `[TUNNEL]`, `[BENCH]`, `[SLOPE]`, `[TRENCH]`, `[OUTCROP]`) in the header clearly indicates the active workspace.
   - Switching domains automatically auto-saves the current workspace to its dedicated partition and loads the target domain's clean state.

2. **Isolated Project Selector**:
   - The project list in the Project Setup stage displays only projects created within the active domain (e.g., Opening Slope Mapping only shows Slope stability projects).
   - An optional **"Import from Another Domain"** button allows copying a project header (client, contractor, consultants) without copying mismatched geometry or round data.

3. **Field vs. Photogrammetry Independence**:
   - Tracing joints, editing rock types, or adjusting dimensions in Field Mapping will **not** alter the Photogrammetry canvas, photos, or stereo camera calibrations.
   - An explicit action **"Push to Photogrammetry"** / **"Import from Field"** is available if the geologist explicitly wishes to transfer data between the two modes.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Dedicated Storage Keys per Domain
- *Chosen Approach*: Replace the shared `SURFACE_MAPPING_STORAGE_KEY` with distinct keys:
  - `eswa_field_store_tunnel_v2`
  - `eswa_surface_store_bench_v2`
  - `eswa_surface_store_trench_v2`
  - `eswa_surface_store_slope_v2`
  - `eswa_surface_store_rock_surface_v2`
- *Why*: Guarantees 100% collision-free persistence. Changes in one domain cannot physically overwrite or corrupt another domain's data.
- *Alternatives Considered*: Single store with nested domain dictionary. Rejected because large photo attachments in one domain could exceed browser localStorage quotas for all other domains.

### Decision 2: Decoupled Top-Level App State
- *Chosen Approach*: Remove reactive two-way binding between `FieldMappingModeWorkspace` and `App.tsx` Photogrammetry state (`photos`, `geometry`, `joints`). Field mapping manages its own complete state locally in its store.
- *Why*: Prevents unwanted mutations to Photogrammetry when working in Field mode, eliminating user frustration.
- *Alternatives Considered*: Keeping global state with synchronization flags. Rejected because state synchronization across modal transitions is error-prone.

### Decision 3: Isolated Geometry Parameters & Canvas Transforms
- *Chosen Approach*: Partition `loadSavedSurfaceGeometryParameters(subType)` and `loadIdealPanelTransforms(domain)` by subtype.
- *Why*: A slope requires 65° face angles and 25m heights, while a trench requires 2.5m depth and 90° cuts. Canvas zoom, rotation, and offsets for a 25m slope must not distort a 3m trench or 8m tunnel face.

---

## 4. Technical Architecture & Data Strategy

### System Component Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              App.tsx                                   │
│  - Active Domain State: 'TUNNEL' | 'BENCH' | 'TRENCH' | 'SLOPE' | ... │
│  - Photogrammetry Draft Store: 'eswa_photogrammetry_draft_v2'          │
└───────────────────┬───────────────────────────────────┬────────────────┘
                    │                                   │
                    ▼                                   ▼
┌───────────────────────────────────────┐   ┌────────────────────────────┐
│      FieldMappingModeWorkspace        │   │     MappingWorkspace       │
│  (Isolated per Domain):               │   │     (Photogrammetry)       │
│  - getFieldMappingStorageKey(domain)  │   │  - Independent geometry    │
│  - getIdealTransformsStorageKey(dom)  │   │  - Independent joints      │
│  - Isolated surfaceParams(subType)    │   │  - Independent photos      │
└───────────────────────────────────────┘   └────────────────────────────┘
                    │                                   │
                    ▼                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Local Storage Partitions                        │
│  ├── eswa_field_store_tunnel_v2                                        │
│  ├── eswa_surface_store_bench_v2                                       │
│  ├── eswa_surface_store_trench_v2                                      │
│  ├── eswa_surface_store_slope_v2                                       │
│  ├── eswa_surface_store_rock_surface_v2                                │
│  ├── eswa_surface_params_bench_v2                                      │
│  ├── eswa_surface_params_trench_v2                                     │
│  ├── eswa_surface_params_slope_v2                                      │
│  ├── eswa_surface_params_rock_surface_v2                               │
│  └── eswa_photogrammetry_draft_v2                                      │
└────────────────────────────────────────────────────────────────────────┘
```

### Key Implementation Steps

1. **`src/engine/fieldMappingEngine.ts`**:
   - Update `getFieldMappingStorageKey(domain: MappingDomainType)` to return individual keys per domain (`tunnel`, `bench`, `trench`, `slope`, `rock_surface`).
   - Implement seamless one-time data migration from the legacy keys (`eswa_apk_field_mapping_store_v1` and `eswa_apk_surface_mapping_store_v1`) so existing user work is preserved into its respective domain.
   - Partition `FIELD_IDEAL_PANEL_TRANSFORMS_KEY` per domain so panel positioning in one domain does not affect others.

2. **`src/engine/surfaceMappingEngine.ts`**:
   - Update `loadSavedSurfaceGeometryParameters` and `saveSurfaceGeometryParameters` to accept and store under `eswa_surface_params_${subType.toLowerCase()}_v2`.
   - Update `SurfaceMappingResumeState` to be domain-isolated.

3. **`src/components/FieldMappingModeWorkspace.tsx`**:
   - Add state reload effect when `mappingDomain` changes: smoothly save previous domain state and load the target domain's state.
   - Ensure stage changes, photo uploads, lithology markings, and joint sets are bound strictly to the active domain's store.

4. **`src/App.tsx`**:
   - Decouple `FieldMappingModeWorkspace` callbacks from mutating top-level Photogrammetry state (`setGeometry`, `setPhotos`, `updateJointsWithHistory`, `setRmrParams`).
   - Retain explicit import/export bridges for users who deliberately request data transfer.

5. **Verification**:
   - Test editing Bench parameters, switch to Slope, verify Slope retains its own values without affecting Bench.
   - Test editing joints in Field Mapping, exit to Photogrammetry, verify Photogrammetry canvas remains untouched.
   - Validate with `compile_applet` and `lint_applet`.
