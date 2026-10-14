import { Point2D, SurfaceTransform, SurfaceType, TunnelGeometry, TunnelSettings } from '../types/tunnel';
import { getSurfaceBoundsMeters, pointToSegmentDistance } from './geometryEngine';

/**
 * ============================================================================
 * SINGLE UNIFIED CANVAS COORDINATE SYSTEM (Sections 1–16)
 * ============================================================================
 *
 * Maintains strict mathematical separation and bi-directional consistency between:
 * 1. SCREEN COORDINATES:     (clientX, clientY) in browser CSS pixels (Mouse / Touch / Pointer)
 * 2. ROOT SVG COORDINATES:   (rootX, rootY) in 1000 x 680 viewBox before viewport pan/zoom
 * 3. CANVAS WORLD COORDS:    (cx, cy) in 1000 x 680 master world stage after pan/zoom
 * 4. IMAGE / PHOTO COORDS:   (u, v) in [0..1] normalized photo space (accounting for photo
 *                            offsetX, offsetY, zoom, scaleX, scaleY, rotation, perspective, warp)
 * 5. TUNNEL / WORLD COORDS:  (x, y) in authoritative real-world meters on the tunnel surface
 *
 * Every mouse/touch event converts via:
 *   SCREEN -> CANVAS -> IMAGE / TUNNEL COORDINATE
 * And every rendered element converts via:
 *   IMAGE / TUNNEL COORDINATE -> CANVAS -> SCREEN
 */

export interface CanvasViewportState {
  zoom: number; // 0.25 (25%) to 6.0 (600%), default 1.0 (100%)
  panX: number; // Pan offset X in root SVG units
  panY: number; // Pan offset Y in root SVG units
}

export interface SurfaceRectPx {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface CanvasStageMetrics {
  viewW: number;
  viewH: number;
  padPx: number;
  pxPerMeter: number;
  surfaceBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
  surfaceRectPx: SurfaceRectPx;
}

export const DEFAULT_VIEW_W = 1000;
export const DEFAULT_VIEW_H = 680;
export const DEFAULT_PAD_PX = 20;

/**
 * Computes the master stage metrics for a given tunnel surface.
 */
export function computeCanvasStageMetrics(
  surface: SurfaceType,
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  viewW = DEFAULT_VIEW_W,
  viewH = DEFAULT_VIEW_H,
  padPx = DEFAULT_PAD_PX
): CanvasStageMetrics {
  const surfaceBounds = getSurfaceBoundsMeters(surface, geometry, settings);
  const availW = viewW - padPx * 2;
  const availH = viewH - padPx * 2;
  const refW = Math.max(0.5, surfaceBounds.width);
  const refH = Math.max(0.5, surfaceBounds.height);
  const pxPerMeter = Math.min(
    availW / Math.max(0.1, refW),
    availH / Math.max(0.1, refH)
  );

  const centerX_m = (surfaceBounds.minX + surfaceBounds.maxX) / 2;
  const centerY_m = (surfaceBounds.minY + surfaceBounds.maxY) / 2;

  const tlCx = viewW / 2 + (surfaceBounds.minX - centerX_m) * pxPerMeter;
  const tlCy = viewH / 2 - (surfaceBounds.maxY - centerY_m) * pxPerMeter;
  const brCx = viewW / 2 + (surfaceBounds.maxX - centerX_m) * pxPerMeter;
  const brCy = viewH / 2 - (surfaceBounds.minY - centerY_m) * pxPerMeter;

  const surfaceRectPx: SurfaceRectPx = {
    x: tlCx,
    y: tlCy,
    width: brCx - tlCx,
    height: brCy - tlCy,
    centerX: (tlCx + brCx) / 2,
    centerY: (tlCy + brCy) / 2,
  };

  return {
    viewW,
    viewH,
    padPx,
    pxPerMeter,
    surfaceBounds,
    surfaceRectPx,
  };
}

/**
 * Returns the SVG transform attribute string for the master viewport pan/zoom group.
 * Zooms around the canvas center (viewW / 2, viewH / 2) and translates by (panX, panY).
 */
export function getViewportSvgTransform(
  viewport: CanvasViewportState,
  viewW = DEFAULT_VIEW_W,
  viewH = DEFAULT_VIEW_H
): string {
  const cx = viewW / 2;
  const cy = viewH / 2;
  return `translate(${cx + viewport.panX}, ${cy + viewport.panY}) scale(${viewport.zoom}) translate(${-cx}, ${-cy})`;
}

/**
 * Computes the exact rendered SVG letterbox/pillarbox box inside the `<svg>` CSS bounding rect
 * for `preserveAspectRatio="xMidYMid meet"`.
 * Works across all window sizes, side panel states, fullscreen, and DPI scaling (100%–200%+).
 */
export function getRenderedSvgViewBoxMetrics(
  svgElement: SVGSVGElement,
  viewW = DEFAULT_VIEW_W,
  viewH = DEFAULT_VIEW_H
): {
  rect: DOMRect;
  meetScale: number;
  renderedW: number;
  renderedH: number;
  letterboxLeft: number;
  letterboxTop: number;
} {
  const rect = svgElement.getBoundingClientRect();
  const safeW = Math.max(1, rect.width);
  const safeH = Math.max(1, rect.height);
  const scaleX = safeW / viewW;
  const scaleY = safeH / viewH;
  const meetScale = Math.min(scaleX, scaleY);
  const renderedW = viewW * meetScale;
  const renderedH = viewH * meetScale;
  const letterboxLeft = rect.left + (safeW - renderedW) / 2;
  const letterboxTop = rect.top + (safeH - renderedH) / 2;

  return {
    rect,
    meetScale,
    renderedW,
    renderedH,
    letterboxLeft,
    letterboxTop,
  };
}

/**
 * SCREEN -> ROOT SVG (before viewport pan/zoom)
 */
export function screenToRootSvg(
  clientX: number,
  clientY: number,
  svgElement: SVGSVGElement,
  viewW = DEFAULT_VIEW_W,
  viewH = DEFAULT_VIEW_H
): { rootX: number; rootY: number } {
  const { meetScale, letterboxLeft, letterboxTop } = getRenderedSvgViewBoxMetrics(
    svgElement,
    viewW,
    viewH
  );
  return {
    rootX: (clientX - letterboxLeft) / meetScale,
    rootY: (clientY - letterboxTop) / meetScale,
  };
}

/**
 * SCREEN -> CANVAS WORLD COORDINATES (cx, cy)
 * Accounts for:
 * - SVG CSS bounding rect & aspect-ratio letterboxing (`xMidYMid meet`)
 * - Window resize, fullscreen, side panels opening/closing, bottom drawers
 * - High-DPI / Windows display scaling (100%, 125%, 150%, 175%, 200% devicePixelRatio)
 * - Canvas Viewport Zoom (50%–400%+) and Pan (panX, panY)
 */
export function screenToCanvasWorld(
  clientX: number,
  clientY: number,
  svgElement: SVGSVGElement | null,
  _worldGroupElement: SVGGElement | null,
  viewport: CanvasViewportState,
  viewW = DEFAULT_VIEW_W,
  viewH = DEFAULT_VIEW_H
): { cx: number; cy: number } {
  if (!svgElement) {
    return { cx: viewW / 2, cy: viewH / 2 };
  }

  // Exact analytical conversion accounting for `xMidYMid meet` letterbox + viewport zoom/pan
  const { rootX, rootY } = screenToRootSvg(clientX, clientY, svgElement, viewW, viewH);
  const halfW = viewW / 2;
  const halfH = viewH / 2;
  const safeZoom = Math.max(0.05, viewport.zoom);
  const analyticalCx = (rootX - halfW - viewport.panX) / safeZoom + halfW;
  const analyticalCy = (rootY - halfH - viewport.panY) / safeZoom + halfH;

  return { cx: analyticalCx, cy: analyticalCy };
}

/**
 * CANVAS WORLD COORDINATES (cx, cy) -> SCREEN (clientX, clientY)
 * Exact inverse of screenToCanvasWorld.
 */
export function canvasWorldToScreen(
  cx: number,
  cy: number,
  svgElement: SVGSVGElement | null,
  _worldGroupElement: SVGGElement | null,
  viewport: CanvasViewportState,
  viewW = DEFAULT_VIEW_W,
  viewH = DEFAULT_VIEW_H
): { clientX: number; clientY: number } {
  if (!svgElement) {
    return { clientX: cx, clientY: cy };
  }

  const halfW = viewW / 2;
  const halfH = viewH / 2;
  const rootX = (cx - halfW) * viewport.zoom + halfW + viewport.panX;
  const rootY = (cy - halfH) * viewport.zoom + halfH + viewport.panY;
  const { meetScale, letterboxLeft, letterboxTop } = getRenderedSvgViewBoxMetrics(
    svgElement,
    viewW,
    viewH
  );

  return {
    clientX: letterboxLeft + rootX * meetScale,
    clientY: letterboxTop + rootY * meetScale,
  };
}

/**
 * TUNNEL / WORLD METERS (x, y) -> CANVAS WORLD COORDINATES (cx, cy)
 */
export function tunnelMetersToCanvasWorld(
  pt: Point2D,
  metrics: CanvasStageMetrics
): { cx: number; cy: number } {
  const centerX_m = (metrics.surfaceBounds.minX + metrics.surfaceBounds.maxX) / 2;
  const centerY_m = (metrics.surfaceBounds.minY + metrics.surfaceBounds.maxY) / 2;
  return {
    cx: metrics.viewW / 2 + (pt.x - centerX_m) * metrics.pxPerMeter,
    cy: metrics.viewH / 2 - (pt.y - centerY_m) * metrics.pxPerMeter,
  };
}

/**
 * CANVAS WORLD COORDINATES (cx, cy) -> TUNNEL / WORLD METERS (x, y)
 * Exact inverse of tunnelMetersToCanvasWorld.
 */
export function canvasWorldToTunnelMeters(
  cx: number,
  cy: number,
  metrics: CanvasStageMetrics
): Point2D {
  const centerX_m = (metrics.surfaceBounds.minX + metrics.surfaceBounds.maxX) / 2;
  const centerY_m = (metrics.surfaceBounds.minY + metrics.surfaceBounds.maxY) / 2;
  return {
    x: Number((centerX_m + (cx - metrics.viewW / 2) / metrics.pxPerMeter).toFixed(4)),
    y: Number((centerY_m - (cy - metrics.viewH / 2) / metrics.pxPerMeter).toFixed(4)),
  };
}

/**
 * Unified Pipeline:
 * SCREEN (clientX, clientY) -> CANVAS WORLD (cx, cy) -> TUNNEL / WORLD METERS (x, y)
 */
export function screenToTunnelMeters(
  clientX: number,
  clientY: number,
  svgElement: SVGSVGElement | null,
  worldGroupElement: SVGGElement | null,
  viewport: CanvasViewportState,
  metrics: CanvasStageMetrics
): Point2D {
  const { cx, cy } = screenToCanvasWorld(
    clientX,
    clientY,
    svgElement,
    worldGroupElement,
    viewport,
    metrics.viewW,
    metrics.viewH
  );
  return canvasWorldToTunnelMeters(cx, cy, metrics);
}

/**
 * Extracts clientX, clientY from any MouseEvent, PointerEvent, or TouchEvent.
 */
export function getEventClientPoint(
  e:
    | React.MouseEvent<Element>
    | React.PointerEvent<Element>
    | React.TouchEvent<Element>
    | MouseEvent
    | PointerEvent
    | TouchEvent
): { clientX: number; clientY: number } {
  if ('touches' in e) {
    const touch = e.touches[0] || e.changedTouches[0];
    return {
      clientX: touch ? touch.clientX : 0,
      clientY: touch ? touch.clientY : 0,
    };
  }
  return {
    clientX: e.clientX,
    clientY: e.clientY,
  };
}

/**
 * ============================================================================
 * PHOTO / IMAGE TRANSFORMATION REGISTRATION (Section 6)
 * ============================================================================
 * The photograph is rendered inside `<g transform={photoSvgTransform}>` where:
 *   translate(centerX + dxPx, centerY + dyPx)
 *   rotate(rotation)
 *   scale(scaleX * zoom, scaleY * zoom)
 *   translate(-centerX, -centerY)
 *
 * These functions convert seamlessly between:
 * - Normalized Photo UV (u, v in [0..1])
 * - Local Un-transformed Photo Canvas Pixels (lx, ly)
 * - Transformed Canvas World Pixels (cx, cy)
 * - Tunnel World Meters (x, y)
 */

export function photoUVToCanvasWorld(
  u: number,
  v: number,
  metrics: CanvasStageMetrics,
  transform: SurfaceTransform
): { cx: number; cy: number } {
  const { surfaceRectPx, pxPerMeter } = metrics;
  const lx = surfaceRectPx.x + u * surfaceRectPx.width;
  const ly = surfaceRectPx.y + v * surfaceRectPx.height;

  const zoom = transform.zoom ?? 1;
  const sx = (transform.scaleX || 1) * zoom;
  const sy = (transform.scaleY || 1) * zoom;

  // 1. Translate relative to surface center & scale
  const relX = (lx - surfaceRectPx.centerX) * sx;
  const relY = (ly - surfaceRectPx.centerY) * sy;

  // 2. Rotate by transform.rotation (SVG rotate is clockwise in screen Y-down coords)
  const rad = ((transform.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rotX = relX * cos - relY * sin;
  const rotY = relX * sin + relY * cos;

  // 3. Translate back to center + photo offset
  const dxPx = (transform.offsetX || 0) * pxPerMeter;
  const dyPx = -(transform.offsetY || 0) * pxPerMeter;

  return {
    cx: surfaceRectPx.centerX + dxPx + rotX,
    cy: surfaceRectPx.centerY + dyPx + rotY,
  };
}

/**
 * Exact inverse of photoUVToCanvasWorld:
 * Converts a Canvas World coordinate (cx, cy) into the exact normalized (u, v) on the
 * rotated, scaled, zoomed, and translated photograph!
 */
export function canvasWorldToPhotoUV(
  cx: number,
  cy: number,
  metrics: CanvasStageMetrics,
  transform: SurfaceTransform
): { u: number; v: number } {
  const { surfaceRectPx, pxPerMeter } = metrics;
  const dxPx = (transform.offsetX || 0) * pxPerMeter;
  const dyPx = -(transform.offsetY || 0) * pxPerMeter;

  // 1. Subtract center + offset translation
  const transX = cx - (surfaceRectPx.centerX + dxPx);
  const transY = cy - (surfaceRectPx.centerY + dyPx);

  // 2. Inverse rotation (-transform.rotation)
  const rad = (-(transform.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const unrotX = transX * cos - transY * sin;
  const unrotY = transX * sin + transY * cos;

  // 3. Inverse scale
  const zoom = transform.zoom ?? 1;
  const sx = Math.max(0.05, Math.abs((transform.scaleX || 1) * zoom)) * Math.sign(transform.scaleX || 1);
  const sy = Math.max(0.05, Math.abs((transform.scaleY || 1) * zoom)) * Math.sign(transform.scaleY || 1);

  const lx = surfaceRectPx.centerX + unrotX / sx;
  const ly = surfaceRectPx.centerY + unrotY / sy;

  return {
    u: (lx - surfaceRectPx.x) / Math.max(1, surfaceRectPx.width),
    v: (ly - surfaceRectPx.y) / Math.max(1, surfaceRectPx.height),
  };
}

export function tunnelMetersToPhotoUV(
  pt: Point2D,
  metrics: CanvasStageMetrics,
  transform: SurfaceTransform
): { u: number; v: number } {
  const { cx, cy } = tunnelMetersToCanvasWorld(pt, metrics);
  return canvasWorldToPhotoUV(cx, cy, metrics, transform);
}

export function photoUVToTunnelMeters(
  u: number,
  v: number,
  metrics: CanvasStageMetrics,
  transform: SurfaceTransform
): Point2D {
  const { cx, cy } = photoUVToCanvasWorld(u, v, metrics, transform);
  return canvasWorldToTunnelMeters(cx, cy, metrics);
}

/**
 * Section 6: Keep geological drawings registered to the transformed photograph
 * when the photograph is rotated, stretched, shrunk, panned, or zoomed.
 * Maps a point from its position on `prevTransform` to the corresponding position on `nextTransform`.
 */
export function transformMetersPointWithPhotoChange(
  pt: Point2D,
  prevTransform: SurfaceTransform,
  nextTransform: SurfaceTransform,
  metrics: CanvasStageMetrics
): Point2D {
  const { u, v } = tunnelMetersToPhotoUV(pt, metrics, prevTransform);
  return photoUVToTunnelMeters(u, v, metrics, nextTransform);
}

/**
 * Computes zoom-compensated hit-testing tolerance in real-world meters
 * corresponding to `targetScreenPixels` (e.g. 10px) at the current viewport zoom and screen size.
 */
export function getZoomCompensatedHitToleranceMeters(
  targetScreenPixels: number,
  svgElement: SVGSVGElement | null,
  viewport: CanvasViewportState,
  metrics: CanvasStageMetrics
): number {
  const safeZoom = Math.max(0.1, viewport.zoom);
  if (!svgElement) {
    return targetScreenPixels / (metrics.pxPerMeter * safeZoom);
  }
  const { meetScale } = getRenderedSvgViewBoxMetrics(svgElement, metrics.viewW, metrics.viewH);
  const canvasPixels = targetScreenPixels / Math.max(0.1, meetScale * safeZoom);
  return canvasPixels / Math.max(1, metrics.pxPerMeter);
}

/**
 * Finds the best segment index (insert after vertex `segIdx`) and projected point
 * when a user clicks on or near a polyline/polygon to insert a new control point.
 */
export function findBestSegmentForInsertion(
  clickPt: Point2D,
  points: Point2D[],
  closedPolygon = false
): { insertIndex: number; projectedPoint: Point2D; distanceMeters: number } {
  if (points.length < 2) {
    return { insertIndex: points.length, projectedPoint: clickPt, distanceMeters: 0 };
  }

  let bestIdx = 1;
  let bestDist = Infinity;
  let bestProj = clickPt;

  const segCount = closedPolygon ? points.length : points.length - 1;
  for (let i = 0; i < segCount; i++) {
    const v = points[i];
    const w = points[(i + 1) % points.length];
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    let t = 0.5;
    if (l2 > 1e-9) {
      t = Math.max(0.05, Math.min(0.95, ((clickPt.x - v.x) * (w.x - v.x) + (clickPt.y - v.y) * (w.y - v.y)) / l2));
    }
    const proj = {
      x: Number((v.x + t * (w.x - v.x)).toFixed(4)),
      y: Number((v.y + t * (w.y - v.y)).toFixed(4)),
    };
    const dist = pointToSegmentDistance(clickPt, v, w);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i + 1;
      bestProj = proj;
    }
  }

  return {
    insertIndex: bestIdx,
    projectedPoint: bestProj,
    distanceMeters: bestDist,
  };
}

/**
 * Evaluates a smooth Catmull-Rom spline that passes EXACTLY through all user control points.
 * Used when drawing or reshaping curved geological joints/veins/folds in Smooth Curve mode.
 */
export function evaluateCatmullRomSplineThroughPoints(
  controlPoints: Point2D[],
  subdivisionsPerSegment = 4
): Point2D[] {
  if (controlPoints.length <= 2) return controlPoints.map((p) => ({ ...p }));

  const result: Point2D[] = [];
  const n = controlPoints.length;

  for (let i = 0; i < n - 1; i++) {
    const p0 = controlPoints[Math.max(0, i - 1)];
    const p1 = controlPoints[i];
    const p2 = controlPoints[i + 1];
    const p3 = controlPoints[Math.min(n - 1, i + 2)];

    for (let s = 0; s < subdivisionsPerSegment; s++) {
      if (s === 0) {
        // Exact control point
        result.push({ x: Number(p1.x.toFixed(4)), y: Number(p1.y.toFixed(4)) });
        continue;
      }
      const t = s / subdivisionsPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;

      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

      result.push({
        x: Number(x.toFixed(4)),
        y: Number(y.toFixed(4)),
      });
    }
  }

  const last = controlPoints[n - 1];
  result.push({ x: Number(last.x.toFixed(4)), y: Number(last.y.toFixed(4)) });
  return result;
}
