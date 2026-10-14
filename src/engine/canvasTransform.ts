import React from 'react';
import {
  Point2D,
  SurfaceTransform,
  SurfaceType,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import {
  CanvasStageMetrics,
  CanvasViewportState,
  canvasWorldToPhotoUV,
  canvasWorldToScreen,
  canvasWorldToTunnelMeters,
  computeCanvasStageMetrics,
  DEFAULT_PAD_PX,
  DEFAULT_VIEW_H,
  DEFAULT_VIEW_W,
  evaluateCatmullRomSplineThroughPoints,
  findBestSegmentForInsertion,
  getEventClientPoint,
  getRenderedSvgViewBoxMetrics,
  getViewportSvgTransform,
  getZoomCompensatedHitToleranceMeters,
  photoUVToCanvasWorld,
  photoUVToTunnelMeters,
  screenToCanvasWorld,
  screenToRootSvg,
  screenToTunnelMeters,
  SurfaceRectPx,
  transformMetersPointWithPhotoChange,
  tunnelMetersToCanvasWorld,
  tunnelMetersToPhotoUV,
} from './coordinateSystem';

export type { CanvasStageMetrics, CanvasViewportState, SurfaceRectPx };
export {
  computeCanvasStageMetrics,
  DEFAULT_PAD_PX,
  DEFAULT_VIEW_H,
  DEFAULT_VIEW_W,
  evaluateCatmullRomSplineThroughPoints,
  findBestSegmentForInsertion,
  getEventClientPoint,
  getRenderedSvgViewBoxMetrics,
};

/**
 * Complete multi-space world projection returned by `screenToWorld`.
 * Includes:
 * - `x`, `y`: Authoritative tunnel/world coordinates in real-world meters (`Point2D`)
 * - `cx`, `cy`: Master SVG world stage coordinates (`1000 x 680` stage space)
 * - `rootX`, `rootY`: Root SVG viewBox coordinates before viewport pan/zoom
 * - `u`, `v`: Normalized `[0..1]` photograph UV coordinates accounting for photo rotation/scale/offset
 * - `clientX`, `clientY`: Originating browser screen coordinates in CSS pixels
 */
export interface WorldPointProjection extends Point2D {
  x: number;
  y: number;
  cx: number;
  cy: number;
  rootX: number;
  rootY: number;
  u: number;
  v: number;
  clientX: number;
  clientY: number;
}

/**
 * Complete multi-space screen projection returned by `worldToScreen`.
 * Includes:
 * - `clientX`, `clientY`: Browser screen coordinates in CSS pixels
 * - `cx`, `cy`: Master SVG world stage coordinates (`1000 x 680` stage space)
 * - `rootX`, `rootY`: Root SVG viewBox coordinates after viewport pan/zoom
 * - `u`, `v`: Normalized `[0..1]` photograph UV coordinates
 * - `x`, `y`: Originating tunnel/world coordinates in real-world meters (`Point2D`)
 */
export interface ScreenPointProjection {
  clientX: number;
  clientY: number;
  cx: number;
  cy: number;
  rootX: number;
  rootY: number;
  u: number;
  v: number;
  x: number;
  y: number;
}

export type MaybeRef<T> = T | null | undefined | { current: T | null };

function unwrapElement<T>(refOrEl: MaybeRef<T>): T | null {
  if (!refOrEl) return null;
  if (typeof refOrEl === 'object' && 'current' in refOrEl) {
    return refOrEl.current;
  }
  return refOrEl as T;
}

export interface CanvasCoordinateManagerConfig {
  svgElement: MaybeRef<SVGSVGElement>;
  worldGroupElement?: MaybeRef<SVGGElement>;
  viewport: CanvasViewportState;
  stageMetrics: CanvasStageMetrics;
  photoTransform: SurfaceTransform;
}

/**
 * Standalone `screenToWorld` helper function.
 * Converts screen coordinates `(clientX, clientY)` into authoritative tunnel/world coordinates
 * (`x, y` in meters) along with synchronized SVG canvas `(cx, cy)` and photo `(u, v)` coordinates.
 */
export function screenToWorld(
  clientX: number,
  clientY: number,
  config: CanvasCoordinateManagerConfig
): WorldPointProjection {
  const svgElement = unwrapElement(config.svgElement);
  const worldGroupElement = unwrapElement(config.worldGroupElement);
  const { viewport, stageMetrics, photoTransform } = config;
  const { viewW, viewH } = stageMetrics;

  const rootPt = svgElement
    ? screenToRootSvg(clientX, clientY, svgElement, viewW, viewH)
    : { rootX: clientX, rootY: clientY };

  const { cx, cy } = screenToCanvasWorld(
    clientX,
    clientY,
    svgElement,
    worldGroupElement,
    viewport,
    viewW,
    viewH
  );

  const worldMeters = canvasWorldToTunnelMeters(cx, cy, stageMetrics);
  const photoUV = canvasWorldToPhotoUV(cx, cy, stageMetrics, photoTransform);

  return {
    x: worldMeters.x,
    y: worldMeters.y,
    cx,
    cy,
    rootX: rootPt.rootX,
    rootY: rootPt.rootY,
    u: photoUV.u,
    v: photoUV.v,
    clientX,
    clientY,
  };
}

/**
 * Standalone `worldToScreen` helper function.
 * Converts authoritative tunnel/world coordinates (`pt.x, pt.y` in meters) into
 * SVG world canvas coordinates `(cx, cy)`, root viewBox coordinates `(rootX, rootY)`,
 * photo UV `(u, v)`, and browser screen coordinates `(clientX, clientY)`.
 */
export function worldToScreen(
  worldPoint: Point2D,
  config: CanvasCoordinateManagerConfig
): ScreenPointProjection {
  const svgElement = unwrapElement(config.svgElement);
  const worldGroupElement = unwrapElement(config.worldGroupElement);
  const { viewport, stageMetrics, photoTransform } = config;
  const { viewW, viewH } = stageMetrics;

  const { cx, cy } = tunnelMetersToCanvasWorld(worldPoint, stageMetrics);
  const halfW = viewW / 2;
  const halfH = viewH / 2;
  const rootX = (cx - halfW) * viewport.zoom + halfW + viewport.panX;
  const rootY = (cy - halfH) * viewport.zoom + halfH + viewport.panY;

  const { clientX, clientY } = canvasWorldToScreen(
    cx,
    cy,
    svgElement,
    worldGroupElement,
    viewport,
    viewW,
    viewH
  );

  const photoUV = canvasWorldToPhotoUV(cx, cy, stageMetrics, photoTransform);

  return {
    clientX,
    clientY,
    cx,
    cy,
    rootX,
    rootY,
    u: photoUV.u,
    v: photoUV.v,
    x: worldPoint.x,
    y: worldPoint.y,
  };
}

/**
 * Centralized `CanvasCoordinateManager` class.
 *
 * Provides a single, deterministic source of truth for all forward (`screenToWorld`)
 * and inverse (`worldToScreen`) coordinate transformations across:
 * - Screen CSS coordinates (`clientX, clientY`)
 * - Root SVG viewBox coordinates (`rootX, rootY`)
 * - Master Canvas World Stage coordinates (`cx, cy`)
 * - Transformed Photograph UV coordinates (`u, v`)
 * - Authoritative Tunnel / Geological World coordinates in meters (`x, y`)
 */
export class CanvasCoordinateManager {
  private readonly svgElementRef: MaybeRef<SVGSVGElement>;
  private readonly worldGroupElementRef: MaybeRef<SVGGElement>;
  public readonly viewport: CanvasViewportState;
  public readonly stageMetrics: CanvasStageMetrics;
  public readonly photoTransform: SurfaceTransform;
  private cachedSvgMetrics: ReturnType<typeof getRenderedSvgViewBoxMetrics> | null = null;
  private cachedSvgMetricsAt = 0;

  constructor(config: CanvasCoordinateManagerConfig) {
    this.svgElementRef = config.svgElement;
    this.worldGroupElementRef = config.worldGroupElement ?? null;
    this.viewport = config.viewport;
    this.stageMetrics = config.stageMetrics;
    this.photoTransform = config.photoTransform;
  }

  public get svgElement(): SVGSVGElement | null {
    return unwrapElement(this.svgElementRef);
  }

  public get worldGroupElement(): SVGGElement | null {
    return unwrapElement(this.worldGroupElementRef);
  }

  private getCachedSvgMetrics(): ReturnType<typeof getRenderedSvgViewBoxMetrics> | null {
    const svg = this.svgElement;
    if (!svg) return null;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!this.cachedSvgMetrics || now - this.cachedSvgMetricsAt > 32) {
      this.cachedSvgMetrics = getRenderedSvgViewBoxMetrics(
        svg,
        this.stageMetrics.viewW,
        this.stageMetrics.viewH
      );
      this.cachedSvgMetricsAt = now;
    }
    return this.cachedSvgMetrics;
  }

  /**
   * Factory helper to build a `CanvasCoordinateManager` directly from tunnel surface state.
   */
  public static fromSurfaceState(params: {
    surface: SurfaceType;
    geometry: TunnelGeometry;
    settings: TunnelSettings;
    viewport: CanvasViewportState;
    photoTransform: SurfaceTransform;
    svgElement: SVGSVGElement | null;
    worldGroupElement?: SVGGElement | null;
    viewW?: number;
    viewH?: number;
    padPx?: number;
  }): CanvasCoordinateManager {
    const stageMetrics = computeCanvasStageMetrics(
      params.surface,
      params.geometry,
      params.settings,
      params.viewW ?? DEFAULT_VIEW_W,
      params.viewH ?? DEFAULT_VIEW_H,
      params.padPx ?? DEFAULT_PAD_PX
    );
    return new CanvasCoordinateManager({
      svgElement: params.svgElement,
      worldGroupElement: params.worldGroupElement ?? null,
      viewport: params.viewport,
      stageMetrics,
      photoTransform: params.photoTransform,
    });
  }

  /**
   * Primary forward transformation:
   * SCREEN `(clientX, clientY)` -> WORLD `(x, y in meters, cx, cy on stage, u, v on photo)`
   */
  public screenToWorld(clientX: number, clientY: number): WorldPointProjection {
    return screenToWorld(clientX, clientY, {
      svgElement: this.svgElement,
      worldGroupElement: this.worldGroupElement,
      viewport: this.viewport,
      stageMetrics: this.stageMetrics,
      photoTransform: this.photoTransform,
    });
  }

  /**
   * Extracts `clientX, clientY` from any Mouse, Pointer, or Touch event and converts via `screenToWorld`.
   */
  public eventToWorld(
    e:
      | React.MouseEvent<Element>
      | React.PointerEvent<Element>
      | React.TouchEvent<Element>
      | MouseEvent
      | PointerEvent
      | TouchEvent
      | { clientX: number; clientY: number }
  ): WorldPointProjection {
    if ('touches' in e) {
      const { clientX, clientY } = getEventClientPoint(e);
      return this.screenToWorld(clientX, clientY);
    }
    return this.screenToWorld(e.clientX, e.clientY);
  }

  /**
   * Primary inverse transformation:
   * WORLD `(x, y in meters)` -> SCREEN `(clientX, clientY, cx, cy on stage, u, v on photo)`
   */
  public worldToScreen(worldPoint: Point2D): ScreenPointProjection {
    const { viewW, viewH } = this.stageMetrics;
    const { cx, cy } = tunnelMetersToCanvasWorld(worldPoint, this.stageMetrics);
    const halfW = viewW / 2;
    const halfH = viewH / 2;
    const rootX = (cx - halfW) * this.viewport.zoom + halfW + this.viewport.panX;
    const rootY = (cy - halfH) * this.viewport.zoom + halfH + this.viewport.panY;

    const svgMetrics = this.getCachedSvgMetrics();
    const clientX = svgMetrics ? svgMetrics.letterboxLeft + rootX * svgMetrics.meetScale : cx;
    const clientY = svgMetrics ? svgMetrics.letterboxTop + rootY * svgMetrics.meetScale : cy;

    const photoUV = canvasWorldToPhotoUV(cx, cy, this.stageMetrics, this.photoTransform);

    return {
      clientX,
      clientY,
      cx,
      cy,
      rootX,
      rootY,
      u: photoUV.u,
      v: photoUV.v,
      x: worldPoint.x,
      y: worldPoint.y,
    };
  }

  /**
   * Converts a world point in meters `(x, y)` into SVG world stage coordinates `(cx, cy)`.
   * Guaranteed to match `this.worldToScreen(pt).cx` and `.cy`.
   */
  public worldToCanvas(worldPoint: Point2D): { cx: number; cy: number } {
    return tunnelMetersToCanvasWorld(worldPoint, this.stageMetrics);
  }

  /**
   * Converts SVG world stage coordinates `(cx, cy)` into tunnel/world meters `(x, y)`.
   */
  public canvasToWorld(cx: number, cy: number): Point2D {
    return canvasWorldToTunnelMeters(cx, cy, this.stageMetrics);
  }

  /**
   * Converts screen `(clientX, clientY)` into normalized `[0..1]` photo UV coordinates,
   * accounting for viewport zoom/pan AND photo rotation, scale, zoom, and offset.
   */
  public screenToPhotoUV(
    clientX: number,
    clientY: number,
    overrideTransform?: SurfaceTransform
  ): { u: number; v: number } {
    const { cx, cy } = this.screenToWorld(clientX, clientY);
    return canvasWorldToPhotoUV(
      cx,
      cy,
      this.stageMetrics,
      overrideTransform ?? this.photoTransform
    );
  }

  /**
   * Converts SVG world stage coordinates `(cx, cy)` into normalized `[0..1]` photo UV coordinates.
   */
  public canvasToPhotoUV(
    cx: number,
    cy: number,
    overrideTransform?: SurfaceTransform
  ): { u: number; v: number } {
    return canvasWorldToPhotoUV(
      cx,
      cy,
      this.stageMetrics,
      overrideTransform ?? this.photoTransform
    );
  }

  /**
   * Converts tunnel/world meters `(x, y)` into normalized `[0..1]` photo UV coordinates.
   */
  public worldToPhotoUV(
    worldPoint: Point2D,
    overrideTransform?: SurfaceTransform
  ): { u: number; v: number } {
    return tunnelMetersToPhotoUV(
      worldPoint,
      this.stageMetrics,
      overrideTransform ?? this.photoTransform
    );
  }

  /**
   * Converts normalized `[0..1]` photo UV coordinates into tunnel/world meters `(x, y)`.
   */
  public photoUVToWorld(
    u: number,
    v: number,
    overrideTransform?: SurfaceTransform
  ): Point2D {
    return photoUVToTunnelMeters(
      u,
      v,
      this.stageMetrics,
      overrideTransform ?? this.photoTransform
    );
  }

  /**
   * Converts normalized `[0..1]` photo UV coordinates into SVG world stage coordinates `(cx, cy)`.
   */
  public photoUVToCanvas(
    u: number,
    v: number,
    overrideTransform?: SurfaceTransform
  ): { cx: number; cy: number } {
    return photoUVToCanvasWorld(
      u,
      v,
      this.stageMetrics,
      overrideTransform ?? this.photoTransform
    );
  }

  /**
   * Keeps a geological point registered to the photograph when the photograph is rotated,
   * scaled, stretched, or translated from `prevTransform` to `nextTransform`.
   */
  public transformWorldPointForPhotoChange(
    worldPoint: Point2D,
    prevTransform: SurfaceTransform,
    nextTransform: SurfaceTransform
  ): Point2D {
    return transformMetersPointWithPhotoChange(
      worldPoint,
      prevTransform,
      nextTransform,
      this.stageMetrics
    );
  }

  /**
   * Computes zoom-compensated hit-testing tolerance in real-world meters
   * corresponding to `targetScreenPixels` at the current viewport zoom and screen size.
   */
  public getHitToleranceMeters(targetScreenPixels = 10): number {
    return getZoomCompensatedHitToleranceMeters(
      targetScreenPixels,
      this.svgElement,
      this.viewport,
      this.stageMetrics
    );
  }

  /**
   * Returns the SVG `transform` string for the master viewport pan/zoom group (`#master-viewport-stage`).
   */
  public getViewportSvgTransform(): string {
    return getViewportSvgTransform(
      this.viewport,
      this.stageMetrics.viewW,
      this.stageMetrics.viewH
    );
  }

  /**
   * Returns the SVG `transform` string for the active photograph group.
   */
  public getPhotoSvgTransform(overrideTransform?: SurfaceTransform): string {
    const t = overrideTransform ?? this.photoTransform;
    const { pxPerMeter, surfaceRectPx } = this.stageMetrics;
    const dxPx = t.offsetX * pxPerMeter;
    const dyPx = -t.offsetY * pxPerMeter;
    const zoom = t.zoom ?? 1;
    const sx = t.scaleX * zoom;
    const sy = t.scaleY * zoom;

    return `translate(${surfaceRectPx.centerX + dxPx}, ${surfaceRectPx.centerY + dyPx}) rotate(${t.rotation}) scale(${sx}, ${sy}) translate(${-surfaceRectPx.centerX}, ${-surfaceRectPx.centerY})`;
  }

  /**
   * Computes the next `CanvasViewportState` when zooming around a specific screen point
   * (or canvas center if `clientX`/`clientY` are omitted) so the world feature under the cursor never shifts.
   */
  public zoomAtScreenPoint(
    nextZoomRaw: number,
    clientX?: number,
    clientY?: number
  ): CanvasViewportState {
    const nextZoom = Number(Math.max(0.25, Math.min(6.0, nextZoomRaw)).toFixed(3));
    if (!this.svgElement || clientX === undefined || clientY === undefined) {
      return { ...this.viewport, zoom: nextZoom };
    }
    const { viewW, viewH } = this.stageMetrics;
    const { rootX, rootY } = screenToRootSvg(clientX, clientY, this.svgElement, viewW, viewH);
    const halfW = viewW / 2;
    const halfH = viewH / 2;

    // World point under cursor before zoom change:
    const worldCx = (rootX - halfW - this.viewport.panX) / this.viewport.zoom + halfW;
    const worldCy = (rootY - halfH - this.viewport.panY) / this.viewport.zoom + halfH;

    // Solve for nextPanX, nextPanY so (worldCx, worldCy) maps to the exact same (rootX, rootY):
    const nextPanX = rootX - halfW - (worldCx - halfW) * nextZoom;
    const nextPanY = rootY - halfH - (worldCy - halfH) * nextZoom;

    return {
      zoom: nextZoom,
      panX: Number(nextPanX.toFixed(2)),
      panY: Number(nextPanY.toFixed(2)),
    };
  }

  /**
   * Computes the next `CanvasViewportState` when panning from `(startClientX, startClientY)`
   * to `(currClientX, currClientY)`.
   */
  public panByScreenDelta(
    startClientX: number,
    startClientY: number,
    currClientX: number,
    currClientY: number,
    startPanX: number,
    startPanY: number
  ): CanvasViewportState {
    if (!this.svgElement) {
      return this.viewport;
    }
    const { viewW, viewH } = this.stageMetrics;
    const startRoot = screenToRootSvg(startClientX, startClientY, this.svgElement, viewW, viewH);
    const currRoot = screenToRootSvg(currClientX, currClientY, this.svgElement, viewW, viewH);

    return {
      ...this.viewport,
      panX: Number((startPanX + (currRoot.rootX - startRoot.rootX)).toFixed(2)),
      panY: Number((startPanY + (currRoot.rootY - startRoot.rootY)).toFixed(2)),
    };
  }

  /**
   * Computes the next `CanvasViewportState` during a two-finger touch pinch-zoom + pan gesture.
   */
  public pinchZoomAndPan(params: {
    startDist: number;
    currDist: number;
    startZoom: number;
    startMidX: number;
    startMidY: number;
    currMidX: number;
    currMidY: number;
    startPanX: number;
    startPanY: number;
  }): CanvasViewportState {
    if (!this.svgElement) {
      return this.viewport;
    }
    const { viewW, viewH } = this.stageMetrics;
    const scaleRatio = params.currDist / Math.max(10, params.startDist);
    const nextZoom = Number(Math.max(0.25, Math.min(6.0, params.startZoom * scaleRatio)).toFixed(3));

    const startRoot = screenToRootSvg(
      params.startMidX,
      params.startMidY,
      this.svgElement,
      viewW,
      viewH
    );
    const currRoot = screenToRootSvg(
      params.currMidX,
      params.currMidY,
      this.svgElement,
      viewW,
      viewH
    );
    const halfW = viewW / 2;
    const halfH = viewH / 2;

    const worldCx = (startRoot.rootX - halfW - params.startPanX) / params.startZoom + halfW;
    const worldCy = (startRoot.rootY - halfH - params.startPanY) / params.startZoom + halfH;

    const nextPanX = currRoot.rootX - halfW - (worldCx - halfW) * nextZoom;
    const nextPanY = currRoot.rootY - halfH - (worldCy - halfH) * nextZoom;

    return {
      zoom: nextZoom,
      panX: Number(nextPanX.toFixed(2)),
      panY: Number(nextPanY.toFixed(2)),
    };
  }
}

export { screenToTunnelMeters };
