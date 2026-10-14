import {
  Joint,
  JointSet,
  MeshControlPoint,
  OverbreakUndercutAnalysis,
  Point2D,
  QIndexParameters,
  RockMassSummaryTable,
  SectionToSectionVolumeRow,
  SurfaceTransform,
  SurfaceType,
  SurveyControlPoint,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import {
  applyProjectiveHomography3x3,
  getSurfaceBoundsMeters,
  solveProjectiveHomography3x3,
} from './geometryEngine';

/**
 * Generates a default 3x3 grid (9 control points C1..C9) for piecewise mesh deformation.
 * Users can move any control point, subdivide to add intermediate control points, or
 * click on the photograph to place custom control points anywhere (Crown, Left Wall, Right Wall, Face).
 */
export function createDefaultMeshControlPoints(rows = 3, cols = 3): MeshControlPoint[] {
  const pts: MeshControlPoint[] = [];
  let idx = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = Number((c / Math.max(1, cols - 1)).toFixed(4));
      const v = Number((r / Math.max(1, rows - 1)).toFixed(4));
      pts.push({
        id: `cp-${r}-${c}`,
        label: `C${idx++}`,
        srcU: u,
        srcV: v,
        dstU: u,
        dstV: v,
      });
    }
  }
  return pts;
}

/**
 * Adds intermediate control points to the mesh so the user can refine local stretching/shrinking
 * on curved tunnel sections (Crown arch, Horseshoe sidewalls, irregular face).
 */
export function addIntermediateMeshControlPoints(existing: MeshControlPoint[]): MeshControlPoint[] {
  if (existing.length >= 25) return existing;
  // Add intermediate midpoints between existing control points that are furthest apart
  const next = [...existing];
  const candidates: { u: number; v: number; du: number; dv: number }[] = [
    { u: 0.25, v: 0.25, du: 0.25, dv: 0.25 },
    { u: 0.75, v: 0.25, du: 0.75, dv: 0.25 },
    { u: 0.25, v: 0.75, du: 0.25, dv: 0.75 },
    { u: 0.75, v: 0.75, du: 0.75, dv: 0.75 },
    { u: 0.5, v: 0.25, du: 0.5, dv: 0.25 },
    { u: 0.5, v: 0.75, du: 0.5, dv: 0.75 },
    { u: 0.25, v: 0.5, du: 0.25, dv: 0.5 },
    { u: 0.75, v: 0.5, du: 0.75, dv: 0.5 },
  ];

  for (const cand of candidates) {
    const alreadyExists = next.some(
      (p) => Math.hypot(p.srcU - cand.u, p.srcV - cand.v) < 0.08
    );
    if (!alreadyExists && next.length < 25) {
      // Interpolate current displacement from existing control points
      const disp = evaluatePiecewiseDisplacement(cand.u, cand.v, existing);
      next.push({
        id: `cp-int-${Date.now()}-${next.length}`,
        label: `C${next.length + 1}`,
        srcU: cand.u,
        srcV: cand.v,
        dstU: Number((cand.u + disp.du).toFixed(4)),
        dstV: Number((cand.v + disp.dv).toFixed(4)),
      });
    }
  }
  return next;
}

/**
 * Generates an initial 13-point custom polygon boundary (P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13)
 * matching the authoritative tunnel geometry so the user can immediately adjust all 13 perimeter
 * boundary stations (invert, lower/mid/upper walls, springlines, haunches, crown shoulders, crown apex)
 * or add further vertices.
 */
export function createTunnelBoundaryCustomMask(
  surface: SurfaceType,
  geometry: TunnelGeometry,
  settings: TunnelSettings
): Point2D[] {
  const bounds = getSurfaceBoundsMeters(surface, geometry, settings);

  if (surface === 'face') {
    if (geometry.customProfile && geometry.customProfile.controlPoints.length >= 4) {
      const hasCurves = geometry.customProfile.segments.some((s) => s.type !== 'line');
      if (!hasCurves && geometry.customProfile.controlPoints.length <= 28) {
        return geometry.customProfile.controlPoints.map((cp) => ({
          x: Number(cp.x.toFixed(3)),
          y: Number(cp.y.toFixed(3)),
        }));
      }
    }
    const raw = geometry.crossSectionPoints;
    const sampled: Point2D[] = [];
    const targetCount = Math.min(Math.max(13, geometry.customProfile?.controlPoints.length || 13), 24);
    for (let i = 0; i < targetCount; i++) {
      const idx = Math.min(raw.length - 1, Math.round((i / (targetCount - 1)) * (raw.length - 1)));
      sampled.push({
        x: Number(raw[idx].x.toFixed(3)),
        y: Number(raw[idx].y.toFixed(3)),
      });
    }
    return sampled;
  }

  // For Crown, Left Wall, Right Wall: create a 13-point deformable boundary polygon (P1..P13)
  const minX = bounds.minX;
  const maxX = bounds.maxX;
  const w = maxX - minX;
  const minY = bounds.minY;
  const maxY = bounds.maxY;
  const h = maxY - minY;

  return [
    { x: Number(minX.toFixed(3)), y: Number(maxY.toFixed(3)) },                   // P1 Top-Left
    { x: Number((minX + 0.25 * w).toFixed(3)), y: Number(maxY.toFixed(3)) },      // P2 Top-Left-Mid
    { x: Number((minX + 0.5 * w).toFixed(3)), y: Number(maxY.toFixed(3)) },       // P3 Top-Center
    { x: Number((minX + 0.75 * w).toFixed(3)), y: Number(maxY.toFixed(3)) },      // P4 Top-Right-Mid
    { x: Number(maxX.toFixed(3)), y: Number(maxY.toFixed(3)) },                   // P5 Top-Right
    { x: Number(maxX.toFixed(3)), y: Number((minY + 0.66 * h).toFixed(3)) },      // P6 Right-Upper
    { x: Number(maxX.toFixed(3)), y: Number((minY + 0.33 * h).toFixed(3)) },      // P7 Right-Lower
    { x: Number(maxX.toFixed(3)), y: Number(minY.toFixed(3)) },                   // P8 Bottom-Right
    { x: Number((minX + 0.66 * w).toFixed(3)), y: Number(minY.toFixed(3)) },      // P9 Bottom-Right-Mid
    { x: Number((minX + 0.33 * w).toFixed(3)), y: Number(minY.toFixed(3)) },      // P10 Bottom-Left-Mid
    { x: Number(minX.toFixed(3)), y: Number(minY.toFixed(3)) },                   // P11 Bottom-Left
    { x: Number(minX.toFixed(3)), y: Number((minY + 0.33 * h).toFixed(3)) },      // P12 Left-Lower
    { x: Number(minX.toFixed(3)), y: Number((minY + 0.66 * h).toFixed(3)) },      // P13 Left-Upper
  ];
}

/**
 * Inserts an intermediate polygon vertex along the longest edge of customMaskPoints.
 */
export function subdivideCustomMaskPolygon(points: Point2D[]): Point2D[] {
  if (points.length < 3) return points;
  let maxIdx = 0;
  let maxDist = -1;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }
  const a = points[maxIdx];
  const b = points[(maxIdx + 1) % points.length];
  const mid: Point2D = {
    x: Number(((a.x + b.x) / 2).toFixed(3)),
    y: Number(((a.y + b.y) / 2).toFixed(3)),
  };
  return [...points.slice(0, maxIdx + 1), mid, ...points.slice(maxIdx + 1)];
}

/**
 * Evaluates smooth inverse-distance-weighted (Shepard / TPS-like) local displacement
 * from the user's mesh control points at normalized coordinate (u, v) in [0, 1].
 */
export function evaluatePiecewiseDisplacement(
  u: number,
  v: number,
  controlPoints?: MeshControlPoint[]
): { du: number; dv: number } {
  if (!controlPoints || controlPoints.length === 0) {
    return { du: 0, dv: 0 };
  }
  let sumW = 0;
  let sumDu = 0;
  let sumDv = 0;

  for (const cp of controlPoints) {
    const d2 = (u - cp.srcU) * (u - cp.srcU) + (v - cp.srcV) * (v - cp.srcV);
    if (d2 < 1e-7) {
      return { du: cp.dstU - cp.srcU, dv: cp.dstV - cp.srcV };
    }
    const w = 1 / Math.pow(d2 + 0.008, 1.35);
    sumW += w;
    sumDu += w * (cp.dstU - cp.srcU);
    sumDv += w * (cp.dstV - cp.srcV);
  }

  if (sumW < 1e-9) return { du: 0, dv: 0 };
  return {
    du: sumDu / sumW,
    dv: sumDv / sumW,
  };
}

/**
 * Evaluates the complete forward deformation of normalized image coordinate (u, v) in [0, 1]
 * into warped normalized surface coordinate (u_dst, v_dst), combining:
 * 1. Flip Horizontal / Vertical
 * 2. 4-Corner Projective Homography + Horizontal/Vertical Keystone Perspective
 * 3. 4-Edge Midpoint Offsets (Top, Right, Bottom, Left)
 * 4. Skew / Shear X & Y
 * 5. Piecewise Mesh Control Point local stretching/shrinking
 */
export function evaluateForwardWarpedUV(
  u: number,
  v: number,
  transform: SurfaceTransform
): { u: number; v: number } {
  // 1. Apply Horizontal / Vertical Flip
  const uFlip = transform.flipH ? 1 - u : u;
  const vFlip = transform.flipV ? 1 - v : v;

  // 2. Combine 4-corner perspective offsets with horizontal/vertical keystone sliders
  const perspH = transform.perspH || 0;
  const perspV = transform.perspV || 0;
  const baseCorners = transform.perspectiveCorners;
  const effectiveCorners: [Point2D, Point2D, Point2D, Point2D] = [
    {
      x: baseCorners[0].x + perspV * 0.22,
      y: baseCorners[0].y + perspH * 0.22,
    },
    {
      x: baseCorners[1].x - perspV * 0.22,
      y: baseCorners[1].y - perspH * 0.22,
    },
    {
      x: baseCorners[2].x + perspV * 0.22,
      y: baseCorners[2].y + perspH * 0.22,
    },
    {
      x: baseCorners[3].x - perspV * 0.22,
      y: baseCorners[3].y - perspH * 0.22,
    },
  ];

  const H = solveProjectiveHomography3x3(effectiveCorners);
  let { u: wu, v: wv } = applyProjectiveHomography3x3(uFlip, vFlip, H);

  // 3. Apply 4-Edge Midpoint Offsets (Top=0, Right=1, Bottom=2, Left=3)
  if (transform.edgeOffsets && transform.edgeOffsets.length === 4) {
    const [eTop, eRight, eBot, eLeft] = transform.edgeOffsets;
    const topWeight = Math.max(0, 1 - vFlip) * 4 * uFlip * (1 - uFlip);
    const botWeight = Math.max(0, vFlip) * 4 * uFlip * (1 - uFlip);
    const leftWeight = Math.max(0, 1 - uFlip) * 4 * vFlip * (1 - vFlip);
    const rightWeight = Math.max(0, uFlip) * 4 * vFlip * (1 - vFlip);

    wu += topWeight * eTop.x + botWeight * eBot.x + leftWeight * eLeft.x + rightWeight * eRight.x;
    wv += topWeight * eTop.y + botWeight * eBot.y + leftWeight * eLeft.y + rightWeight * eRight.y;
  }

  // 4. Apply Skew / Shear X & Y around center (0.5, 0.5)
  const skewXRad = ((transform.skewX || 0) * Math.PI) / 180;
  const skewYRad = ((transform.skewY || 0) * Math.PI) / 180;
  if (Math.abs(skewXRad) > 1e-4 || Math.abs(skewYRad) > 1e-4) {
    const cu = wu - 0.5;
    const cv = wv - 0.5;
    wu = 0.5 + cu + Math.tan(skewXRad) * cv * 0.5;
    wv = 0.5 + cv + Math.tan(skewYRad) * cu * 0.5;
  }

  // 5. Apply Piecewise Mesh Control Point displacements
  const meshDisp = evaluatePiecewiseDisplacement(uFlip, vFlip, transform.meshControlPoints);
  wu += meshDisp.du;
  wv += meshDisp.dv;

  return { u: wu, v: wv };
}

/**
 * Checks if the transform has non-trivial perspective, edge, skew, crop, flip, or mesh deformation
 * that benefits from piecewise canvas rasterization.
 */
export function hasDeformationOrCrop(t: SurfaceTransform): boolean {
  if (t.flipH || t.flipV) return true;
  if ((t.cropTop || 0) > 0.005 || (t.cropBottom || 0) > 0.005 || (t.cropLeft || 0) > 0.005 || (t.cropRight || 0) > 0.005) {
    return true;
  }
  if (Math.abs(t.skewX || 0) > 0.2 || Math.abs(t.skewY || 0) > 0.2) return true;
  if (Math.abs(t.perspH || 0) > 0.005 || Math.abs(t.perspV || 0) > 0.005) return true;
  if (t.perspectiveCorners.some((c) => Math.abs(c.x) > 0.005 || Math.abs(c.y) > 0.005)) return true;
  if (t.edgeOffsets && t.edgeOffsets.some((e) => Math.abs(e.x) > 0.005 || Math.abs(e.y) > 0.005)) return true;
  if (
    t.meshControlPoints &&
    t.meshControlPoints.some((cp) => Math.hypot(cp.dstU - cp.srcU, cp.dstV - cp.srcV) > 0.005)
  ) {
    return true;
  }
  return false;
}

/**
 * Returns a stable signature string covering ONLY the non-affine warp/crop parameters
 * (flip, crop margins, skew, perspective corners/sliders, edge offsets, mesh control points).
 * Pan (offsetX/Y), scale (scaleX/Y), zoom, rotation, and customMaskPoints are handled
 * directly in SVG and do NOT trigger canvas rasterization!
 */
export function getWarpDeformationSignature(t: SurfaceTransform): string {
  if (!hasDeformationOrCrop(t)) return 'IDENTITY';
  const corners = t.perspectiveCorners.map((c) => `${c.x.toFixed(3)},${c.y.toFixed(3)}`).join(';');
  const edges = (t.edgeOffsets || []).map((e) => `${e.x.toFixed(3)},${e.y.toFixed(3)}`).join(';');
  const mesh = (t.meshControlPoints || [])
    .map((cp) => `${cp.dstU.toFixed(3)},${cp.dstV.toFixed(3)}`)
    .join(';');
  return [
    t.flipH ? 1 : 0,
    t.flipV ? 1 : 0,
    (t.cropTop || 0).toFixed(3),
    (t.cropBottom || 0).toFixed(3),
    (t.cropLeft || 0).toFixed(3),
    (t.cropRight || 0).toFixed(3),
    (t.skewX || 0).toFixed(2),
    (t.skewY || 0).toFixed(2),
    (t.perspH || 0).toFixed(3),
    (t.perspV || 0).toFixed(3),
    corners,
    edges,
    mesh,
  ].join('|');
}

/**
 * 2-Click Wall–Crown (SPL) Seam & Scale Lock
 * Given two user clicks along the Wall–Crown Springline (SPL) meet line in normalized photo UV coordinates,
 * computes the exact photo crop margin to eliminate Wall–Crown overlap and locks the real-world pixel-per-meter scale.
 */
export function computeSplTwoClickCropAndScale(
  pt1UV: { u: number; v: number },
  pt2UV: { u: number; v: number },
  surface: SurfaceType,
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  currentTransform: SurfaceTransform,
  imageWidthPx = 1200
): {
  nextTransform: SurfaceTransform;
  pxPerMeter: number;
  summary: string;
} {
  const du = pt2UV.u - pt1UV.u;
  const dv = pt2UV.v - pt1UV.v;
  const distUV = Math.max(0.12, Math.hypot(du, dv));
  const avgU = (pt1UV.u + pt2UV.u) / 2;
  const avgV = (pt1UV.v + pt2UV.v) / 2;

  const refMeters =
    surface === 'face'
      ? Math.max(1.0, geometry.width)
      : Math.max(1.0, settings.roundLength || 3.5);
  const pxPerMeter = Number(((distUV * imageWidthPx) / refMeters).toFixed(1));

  const nextTransform: SurfaceTransform = {
    ...currentTransform,
    cropToGeometry: true,
    splLockedPxPerMeter: pxPerMeter,
  };

  if (surface === 'leftWall' || surface === 'rightWall') {
    // Top of Left/Right Wall meets Crown along SPL -> crop redundant Crown overlap above the SPL line
    const cropTop = Number(Math.max(0, Math.min(0.42, avgV * 0.92)).toFixed(3));
    nextTransform.cropTop = cropTop;
    const tiltDeg = (Math.atan2(dv, Math.abs(du) || 1e-4) * 180) / Math.PI;
    if (Math.abs(tiltDeg) <= 18) {
      nextTransform.rotation = Number((currentTransform.rotation - tiltDeg * 0.5).toFixed(1));
    }
    return {
      nextTransform,
      pxPerMeter,
      summary: `Locked ${surface === 'leftWall' ? 'Left Wall' : 'Right Wall'}–Crown SPL seam: cropped ${Math.round(
        cropTop * 100
      )}% top overlap & calibrated scale (${pxPerMeter} px/m).`,
    };
  }

  if (surface === 'crown') {
    if (Math.abs(dv) > Math.abs(du) * 1.15) {
      // Clicked along either Left SPL or Right SPL boundary on Crown photo
      if (avgU < 0.5) {
        const cropLeft = Number(Math.max(0, Math.min(0.42, avgU * 0.92)).toFixed(3));
        nextTransform.cropLeft = cropLeft;
        return {
          nextTransform,
          pxPerMeter,
          summary: `Locked Crown Left-SPL seam: cropped ${Math.round(
            cropLeft * 100
          )}% left wall overlap & calibrated scale (${pxPerMeter} px/m).`,
        };
      } else {
        const cropRight = Number(Math.max(0, Math.min(0.42, (1 - avgU) * 0.92)).toFixed(3));
        nextTransform.cropRight = cropRight;
        return {
          nextTransform,
          pxPerMeter,
          summary: `Locked Crown Right-SPL seam: cropped ${Math.round(
            cropRight * 100
          )}% right wall overlap & calibrated scale (${pxPerMeter} px/m).`,
        };
      }
    } else {
      const leftU = Math.min(pt1UV.u, pt2UV.u);
      const rightU = Math.max(pt1UV.u, pt2UV.u);
      const cropLeft = Number(Math.max(0, Math.min(0.35, leftU * 0.9)).toFixed(3));
      const cropRight = Number(Math.max(0, Math.min(0.35, (1 - rightU) * 0.9)).toFixed(3));
      nextTransform.cropLeft = cropLeft;
      nextTransform.cropRight = cropRight;
      return {
        nextTransform,
        pxPerMeter,
        summary: `Locked Crown Arch span between Left & Right SPL: cropped L=${Math.round(
          cropLeft * 100
        )}%, R=${Math.round(cropRight * 100)}% & calibrated scale (${pxPerMeter} px/m).`,
      };
    }
  }

  return {
    nextTransform,
    pxPerMeter,
    summary: `Calibrated Face SPL reference scale (${pxPerMeter} px/m).`,
  };
}

/**
 * 1-Click Auto-Detect Wall–Crown (SPL) Seam & Crop/Scale
 * Automatically scans the Hessian ridge & edge-relief gradient field along the perimeter boundary
 * to detect the Wall–Crown (SPL) seam line, crops out redundant adjacent-surface overlap, and locks scale.
 */
export function autoDetectSplSeamCropAndScale(
  ridgeField: {
    width: number;
    height: number;
    response: Float32Array;
    edgeReliefGradientMap?: Float32Array;
  } | null,
  surface: SurfaceType,
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  currentTransform: SurfaceTransform
): {
  nextTransform: SurfaceTransform;
  pxPerMeter: number;
  summary: string;
} {
  const w = ridgeField?.width || 1000;
  const h = ridgeField?.height || 750;
  const refMeters =
    surface === 'face'
      ? Math.max(1.0, geometry.width)
      : Math.max(1.0, settings.roundLength || 3.5);

  if (surface === 'leftWall' || surface === 'rightWall') {
    let bestRowV = 0.085;
    if (ridgeField && ridgeField.response.length === w * h) {
      let maxRowEnergy = -1;
      const minR = Math.max(2, Math.floor(h * 0.04));
      const maxR = Math.min(h - 3, Math.floor(h * 0.22));
      for (let r = minR; r <= maxR; r++) {
        let rowSum = 0;
        for (let c = Math.floor(w * 0.1); c < Math.floor(w * 0.9); c++) {
          const idx = r * w + c;
          rowSum +=
            ridgeField.response[idx] * 0.65 +
            (ridgeField.edgeReliefGradientMap ? ridgeField.edgeReliefGradientMap[idx] * 0.35 : 0);
        }
        if (rowSum > maxRowEnergy) {
          maxRowEnergy = rowSum;
          bestRowV = r / h;
        }
      }
    }
    const cropTop = Number(Math.max(0.04, Math.min(0.24, bestRowV)).toFixed(3));
    const pxPerMeter = Number(((w * 0.92) / refMeters).toFixed(1));
    return {
      nextTransform: {
        ...currentTransform,
        cropTop,
        cropToGeometry: true,
        splLockedPxPerMeter: pxPerMeter,
      },
      pxPerMeter,
      summary: `Auto-detected ${
        surface === 'leftWall' ? 'Left Wall' : 'Right Wall'
      }–Crown SPL seam at ${Math.round(cropTop * 100)}% from top (${pxPerMeter} px/m).`,
    };
  }

  if (surface === 'crown') {
    let bestLeftU = 0.065;
    let bestRightU = 0.065;
    if (ridgeField && ridgeField.response.length === w * h) {
      let maxLeftEnergy = -1;
      let maxRightEnergy = -1;
      const minC = Math.max(2, Math.floor(w * 0.03));
      const maxC = Math.min(Math.floor(w * 0.2), w - 3);
      for (let c = minC; c <= maxC; c++) {
        let colSumL = 0;
        let colSumR = 0;
        const cR = w - 1 - c;
        for (let r = Math.floor(h * 0.1); r < Math.floor(h * 0.9); r++) {
          const idxL = r * w + c;
          const idxR = r * w + cR;
          colSumL += ridgeField.response[idxL];
          colSumR += ridgeField.response[idxR];
        }
        if (colSumL > maxLeftEnergy) {
          maxLeftEnergy = colSumL;
          bestLeftU = c / w;
        }
        if (colSumR > maxRightEnergy) {
          maxRightEnergy = colSumR;
          bestRightU = c / w;
        }
      }
    }
    const cropLeft = Number(Math.max(0.03, Math.min(0.2, bestLeftU)).toFixed(3));
    const cropRight = Number(Math.max(0.03, Math.min(0.2, bestRightU)).toFixed(3));
    const crownSpan = Math.max(1.0, geometry.crownArcLength || geometry.width);
    const pxPerMeter = Number(((w * (1 - cropLeft - cropRight)) / crownSpan).toFixed(1));
    return {
      nextTransform: {
        ...currentTransform,
        cropLeft,
        cropRight,
        cropToGeometry: true,
        splLockedPxPerMeter: pxPerMeter,
      },
      pxPerMeter,
      summary: `Auto-detected Crown Left & Right SPL seams (cropped L=${Math.round(
        cropLeft * 100
      )}%, R=${Math.round(cropRight * 100)}%, scale ${pxPerMeter} px/m).`,
    };
  }

  const pxPerMeter = Number((w / refMeters).toFixed(1));
  return {
    nextTransform: {
      ...currentTransform,
      cropToGeometry: true,
      splLockedPxPerMeter: pxPerMeter,
    },
    pxPerMeter,
    summary: `Auto-calibrated Face boundary & scale (${pxPerMeter} px/m).`,
  };
}

const cachedDecodedImages = new Map<string, HTMLImageElement>();

function getDecodedImage(sourceDataUrl: string): Promise<HTMLImageElement> {
  const existing = cachedDecodedImages.get(sourceDataUrl);
  if (existing && existing.complete && existing.naturalWidth > 0) {
    return Promise.resolve(existing);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cachedDecodedImages.size > 8) {
        const firstKey = cachedDecodedImages.keys().next().value;
        if (firstKey) cachedDecodedImages.delete(firstKey);
      }
      cachedDecodedImages.set(sourceDataUrl, img);
      resolve(img);
    };
    img.onerror = (err) => reject(err);
    img.src = sourceDataUrl;
  });
}

/**
 * Renders a piecewise triangle-mesh warped photograph Data URL using an HTML5 Canvas.
 * Subdivides the image into an N x N triangle mesh (e.g. 14x14 = 392 triangles) and
 * draws each triangle with its exact local affine transformation from source cropped UV
 * to deformed destination UV.
 */
export async function generatePiecewiseWarpedPhotoDataUrl(
  sourceDataUrl: string,
  transform: SurfaceTransform,
  fastPreview = false
): Promise<string> {
  if (!hasDeformationOrCrop(transform)) {
    return sourceDataUrl;
  }

  try {
    const img = await getDecodedImage(sourceDataUrl);
    const outW = fastPreview
      ? Math.min(540, Math.max(360, Math.round(img.width * 0.5)))
      : Math.min(1000, Math.max(600, img.width));
    const outH = fastPreview
      ? Math.min(440, Math.max(280, Math.round(img.height * 0.5)))
      : Math.min(820, Math.max(480, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return sourceDataUrl;
    }

    const cLeft = Math.max(0, Math.min(0.45, transform.cropLeft || 0));
    const cRight = Math.max(0, Math.min(0.45, transform.cropRight || 0));
    const cTop = Math.max(0, Math.min(0.45, transform.cropTop || 0));
    const cBot = Math.max(0, Math.min(0.45, transform.cropBottom || 0));

    // Pre-fill canvas with the cropped base image so there is NEVER any black background
    // or black dotted diagonal seam line showing between triangle clip edges
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      img,
      cLeft * img.width,
      cTop * img.height,
      Math.max(1, (1 - cLeft - cRight) * img.width),
      Math.max(1, (1 - cTop - cBot) * img.height),
      0,
      0,
      outW,
      outH
    );

    const gridN = fastPreview ? 8 : 12;
    for (let r = 0; r < gridN; r++) {
      for (let c = 0; c < gridN; c++) {
        const u0 = c / gridN;
        const v0 = r / gridN;
        const u1 = (c + 1) / gridN;
        const v1 = (r + 1) / gridN;

        // Source image pixel coordinates (respecting crop margins)
        const sx0 = (cLeft + u0 * (1 - cLeft - cRight)) * img.width;
        const sy0 = (cTop + v0 * (1 - cTop - cBot)) * img.height;
        const sx1 = (cLeft + u1 * (1 - cLeft - cRight)) * img.width;
        const sy1 = (cTop + v1 * (1 - cTop - cBot)) * img.height;

        // Warped destination canvas coordinates
        const d00 = evaluateForwardWarpedUV(u0, v0, transform);
        const d10 = evaluateForwardWarpedUV(u1, v0, transform);
        const d11 = evaluateForwardWarpedUV(u1, v1, transform);
        const d01 = evaluateForwardWarpedUV(u0, v1, transform);

        drawTexturedTriangle(
          ctx,
          img,
          sx0,
          sy0,
          sx1,
          sy0,
          sx1,
          sy1,
          d00.u * outW,
          d00.v * outH,
          d10.u * outW,
          d10.v * outH,
          d11.u * outW,
          d11.v * outH
        );
        drawTexturedTriangle(
          ctx,
          img,
          sx0,
          sy0,
          sx1,
          sy1,
          sx0,
          sy1,
          d00.u * outW,
          d00.v * outH,
          d11.u * outW,
          d11.v * outH,
          d01.u * outW,
          d01.v * outH
        );
      }
    }

    return canvas.toDataURL('image/jpeg', fastPreview ? 0.84 : 0.94);
  } catch {
    return sourceDataUrl;
  }
}

function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sx0: number,
  sy0: number,
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
  dx0: number,
  dy0: number,
  dx1: number,
  dy1: number,
  dx2: number,
  dy2: number
) {
  ctx.save();
  // Expand clip triangle radially by 1.35px from centroid to completely eliminate any seam along triangle diagonals
  const cx = (dx0 + dx1 + dx2) / 3;
  const cy = (dy0 + dy1 + dy2) / 3;
  const expandPt = (x: number, y: number) => {
    const vx = x - cx;
    const vy = y - cy;
    const len = Math.hypot(vx, vy) || 1;
    return { x: x + (vx / len) * 1.35, y: y + (vy / len) * 1.35 };
  };
  const p0 = expandPt(dx0, dy0);
  const p1 = expandPt(dx1, dy1);
  const p2 = expandPt(dx2, dy2);

  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.closePath();
  ctx.clip();

  const denom = sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1);
  if (Math.abs(denom) < 1e-5) {
    ctx.restore();
    return;
  }

  const m11 = (dx0 * (sy1 - sy2) + dx1 * (sy2 - sy0) + dx2 * (sy0 - sy1)) / denom;
  const m12 = (dy0 * (sy1 - sy2) + dy1 * (sy2 - sy0) + dy2 * (sy0 - sy1)) / denom;
  const m21 = (dx0 * (sx2 - sx1) + dx1 * (sx0 - sx2) + dx2 * (sx1 - sx0)) / denom;
  const m22 = (dy0 * (sx2 - sx1) + dy1 * (sx0 - sx2) + dy2 * (sx1 - sx0)) / denom;
  const dx =
    (dx0 * (sx1 * sy2 - sx2 * sy1) +
      dx1 * (sx2 * sy0 - sx0 * sy2) +
      dx2 * (sx0 * sy1 - sx1 * sy0)) /
    denom;
  const dy =
    (dy0 * (sx1 * sy2 - sx2 * sy1) +
      dy1 * (sx2 * sy0 - sx0 * sy2) +
      dy2 * (sx0 * sy1 - sx1 * sy0)) /
    denom;

  ctx.transform(m11, m12, m21, m22, dx, dy);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// ============================================================================
// BARTON'S Q-SYSTEM (NGI ROCK MASS CLASSIFICATION) CALCULATOR ENGINE
// ============================================================================

export function createDefaultQIndexParameters(): QIndexParameters {
  return {
    rqd: 65,
    jn: 9,
    jnDescription: 'Three joint sets (Jn = 9)',
    jr: 2.0,
    jrDescription: 'Smooth, undulating or rough planar (Jr = 2.0)',
    ja: 2.0,
    jaDescription: 'Slightly altered joint walls, non-softening mineral coatings (Ja = 2.0)',
    jw: 1.0,
    jwDescription: 'Dry excavations or minor inflow, < 5 L/min locally (Jw = 1.0)',
    srf: 2.5,
    srfDescription: 'Single weakness/shear zone in competent rock (depth > 50m) (SRF = 2.5)',
    esr: 1.0,
    isIntersection: false,
    isPortal: false,
    volumetricJointCountJv: 15.2,
  };
}

export function createDefaultRockMassSummary(lithology = ''): RockMassSummaryTable {
  return {
    rockType: lithology || '',
    rockUnit: '',
    weatheringGrade: '',
    strengthGrade: '',
    foliationBeddingSpacing: '',
    groundwaterCondition: '',
    overbreakCondition: '',
    installedSupport: '',
    geologistRemarks: '',
  };
}

export interface QIndexComputedResult {
  effectiveRqd: number;
  effectiveJn: number;
  blockSizeQuotient: number;    // RQD / Jn
  shearStrengthQuotient: number;// Jr / Ja
  activeStressQuotient: number; // Jw / SRF
  qValue: number;               // Final Barton Q-value
  rockMassClass: string;        // e.g., "Class III — Fair Rock"
  rockQualityCategory: string;  // e.g., "Fair"
  estimatedRmr: number;         // Bieniawski RMR correlation: 9 * ln(Q) + 44
  equivalentDimensionDe: number;// Span / ESR
  recommendedSupport: string;
  colorHex: string;
}

export function calculateBartonQSystem(
  params: QIndexParameters,
  tunnelSpanMeters = 8.4
): QIndexComputedResult {
  // Per Barton (1974 / 2002): Nominal minimum RQD in Q formula is 10
  const effectiveRqd = Math.max(10, Math.min(100, params.rqd));
  const jnMultiplier = params.isIntersection ? 3.0 : params.isPortal ? 2.0 : 1.0;
  const effectiveJn = Math.max(0.5, params.jn * jnMultiplier);
  const safeJa = Math.max(0.5, params.ja);
  const safeSrf = Math.max(0.5, params.srf);

  const blockSizeQuotient = effectiveRqd / effectiveJn;
  const shearStrengthQuotient = params.jr / safeJa;
  const activeStressQuotient = params.jw / safeSrf;

  const qValue = blockSizeQuotient * shearStrengthQuotient * activeStressQuotient;

  let rockMassClass = 'Class III — Fair Rock';
  let rockQualityCategory = 'Fair';
  let colorHex = '#10B981';
  let recommendedSupport =
    'Systematic bolting (L=3.5–4.0m @ 1.5–2.0m c/c) + 50–90mm fiber-reinforced shotcrete (SFRS)';

  if (qValue > 400) {
    rockMassClass = 'Class I-A — Exceptionally Good';
    rockQualityCategory = 'Exceptionally Good';
    colorHex = '#059669';
    recommendedSupport = 'Unsupported or spot bolting only where local wedges occur';
  } else if (qValue > 100) {
    rockMassClass = 'Class I-B — Extremely Good';
    rockQualityCategory = 'Extremely Good';
    colorHex = '#059669';
    recommendedSupport = 'Spot bolting (L=3.0m) in crown arch as required';
  } else if (qValue > 40) {
    rockMassClass = 'Class I — Very Good Rock';
    rockQualityCategory = 'Very Good';
    colorHex = '#10B981';
    recommendedSupport = 'Systematic bolting (L=3.0m @ 2.0–2.5m c/c) + unreinforced shotcrete 40mm';
  } else if (qValue > 10) {
    rockMassClass = 'Class II — Good Rock';
    rockQualityCategory = 'Good';
    colorHex = '#22C55E';
    recommendedSupport = 'Systematic bolting (L=3.5m @ 1.7–2.0m c/c) + 50mm SFRS in crown';
  } else if (qValue > 4) {
    rockMassClass = 'Class III — Fair Rock';
    rockQualityCategory = 'Fair';
    colorHex = '#06B6D4';
    recommendedSupport =
      'Systematic bolting (L=4.0m @ 1.5m c/c) + 75–100mm fiber-reinforced shotcrete (SFRS)';
  } else if (qValue > 1) {
    rockMassClass = 'Class IV — Poor Rock';
    rockQualityCategory = 'Poor';
    colorHex = '#F59E0B';
    recommendedSupport =
      'Systematic bolting (L=4.0m @ 1.2–1.5m c/c) + 100–150mm SFRS + Bolt-anchored straps';
  } else if (qValue > 0.1) {
    rockMassClass = 'Class V — Very Poor Rock';
    rockQualityCategory = 'Very Poor';
    colorHex = '#F97316';
    recommendedSupport =
      '150–200mm SFRS + Steel ribs / Lattice girders @ 1.0–1.2m + Systematic bolting (L=4.5m)';
  } else if (qValue > 0.01) {
    rockMassClass = 'Class VI — Extremely Poor Rock';
    rockQualityCategory = 'Extremely Poor';
    colorHex = '#EF4444';
    recommendedSupport =
      'Heavy steel ribs / Lattice girders @ 0.75–1.0m + 200–250mm SFRS + Forepoling / Spiling + Invert arch';
  } else {
    rockMassClass = 'Class VII — Exceptionally Poor (Squeezing/Flowing)';
    rockQualityCategory = 'Exceptionally Poor';
    colorHex = '#DC2626';
    recommendedSupport =
      'Multi-stage canopy pipe umbrella + Heavy yielding steel ribs + >250mm SFRS + Reinforced concrete invert';
  }

  const estimatedRmr = Math.max(10, Math.min(98, Math.round(9 * Math.log(Math.max(0.001, qValue)) + 44)));
  const equivalentDimensionDe = tunnelSpanMeters / Math.max(0.5, params.esr || 1.0);

  return {
    effectiveRqd: Number(effectiveRqd.toFixed(1)),
    effectiveJn: Number(effectiveJn.toFixed(2)),
    blockSizeQuotient: Number(blockSizeQuotient.toFixed(2)),
    shearStrengthQuotient: Number(shearStrengthQuotient.toFixed(2)),
    activeStressQuotient: Number(activeStressQuotient.toFixed(2)),
    qValue: Number(qValue.toFixed(3)),
    rockMassClass,
    rockQualityCategory,
    estimatedRmr,
    equivalentDimensionDe: Number(equivalentDimensionDe.toFixed(2)),
    recommendedSupport,
    colorHex,
  };
}

/**
 * Automatically estimates Barton Q-Index parameters directly from the mapped vector
 * geological discontinuities, clustered sets, persistence, roughness, infilling, and water condition.
 */
export function autoEstimateQIndexFromMappedJoints(
  joints: Joint[],
  jointSets: JointSet[],
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  currentParams: QIndexParameters
): QIndexParameters {
  if (joints.length === 0) return currentParams;

  // 1. Estimate Volumetric Joint Count Jv and RQD (Palmström: RQD = 115 - 3.3 * Jv)
  const faceArea = geometry.width * geometry.height * 0.88;
  const totalTraceLen = joints.reduce((acc, j) => acc + (j.persistenceMeters || 1.5), 0);
  // Areal fracture intensity P21 (m / m^2) -> Volumetric joint count Jv
  const p21 = totalTraceLen / Math.max(12, faceArea);
  const jv = Math.max(3, Math.min(32, p21 * 4.2 + jointSets.length * 1.6));
  const estRqd = Math.round(Math.max(15, Math.min(98, 115 - 3.3 * jv)));

  // 2. Estimate Jn from number of distinct joint sets (excluding fault F1)
  const regularSetCount = jointSets.filter((s) => s.id !== 'F1').length;
  let jn = 9;
  let jnDescription = 'Three joint sets (Jn = 9)';
  if (regularSetCount <= 1) {
    jn = 3;
    jnDescription = 'One joint set plus random joints (Jn = 3)';
  } else if (regularSetCount === 2) {
    jn = 6;
    jnDescription = 'Two joint sets plus random joints (Jn = 6)';
  } else if (regularSetCount === 3) {
    jn = 9;
    jnDescription = 'Three joint sets (Jn = 9)';
  } else if (regularSetCount === 4) {
    jn = 12;
    jnDescription = 'Three joint sets plus random joints (Jn = 12)';
  } else {
    jn = 15;
    jnDescription = 'Four or more joint sets, heavily jointed (Jn = 15)';
  }

  // 3. Estimate Jr from mapped roughness & waviness
  const avgWaviness =
    joints.reduce((acc, j) => acc + (j.wavinessAngleDeg ?? 6), 0) / Math.max(1, joints.length);
  let jr = 2.0;
  let jrDescription = 'Smooth, undulating (Jr = 2.0)';
  if (avgWaviness >= 9) {
    jr = 3.0;
    jrDescription = 'Rough or irregular, undulating (Jr = 3.0)';
  } else if (avgWaviness >= 4.5) {
    jr = 2.0;
    jrDescription = 'Smooth, undulating or rough planar (Jr = 2.0)';
  } else {
    jr = 1.5;
    jrDescription = 'Rough or irregular, planar (Jr = 1.5)';
  }

  // 4. Estimate Ja from infilling / shear presence
  const hasShearOrFault = joints.some(
    (j) => j.featureType === 'shear' || j.featureType === 'fault' || j.set === 'F1'
  );
  const hasClayInfill = joints.some((j) =>
    (j.infilling || '').toLowerCase().includes('clay')
  );
  let ja = 2.0;
  let jaDescription = 'Slightly altered joint walls, non-softening coatings (Ja = 2.0)';
  if (hasShearOrFault) {
    ja = 4.0;
    jaDescription = 'Low-friction clay / chlorite mineral coatings or thin shear infill (Ja = 4.0)';
  } else if (hasClayInfill) {
    ja = 3.0;
    jaDescription = 'Silty or sandy-clay coatings, small clay fraction (Ja = 3.0)';
  }

  // 5. Estimate Jw from water conditions
  const hasFlowing = joints.some((j) => j.waterCondition === 'Flowing');
  const hasDripping = joints.some(
    (j) => j.waterCondition === 'Dripping' || j.featureType === 'water_seepage'
  );
  const hasWet = joints.some((j) => j.waterCondition === 'Wet');
  let jw = 1.0;
  let jwDescription = 'Dry excavations or minor inflow < 5 L/min (Jw = 1.0)';
  if (hasFlowing) {
    jw = 0.5;
    jwDescription = 'Large inflow or high pressure in competent rock (Jw = 0.5)';
  } else if (hasDripping || hasWet) {
    jw = 0.66;
    jwDescription = 'Medium inflow or pressure, occasional outwash of joint fillings (Jw = 0.66)';
  }

  // 6. Estimate SRF from shear/fault zones
  const shearCount = joints.filter(
    (j) => j.featureType === 'shear' || j.featureType === 'fault' || j.set === 'F1'
  ).length;
  let srf = 1.0;
  let srfDescription = 'Medium stress, favorable stress condition (SRF = 1.0)';
  if (shearCount >= 2) {
    srf = 5.0;
    srfDescription = 'Multiple shear/weakness zones in competent rock (SRF = 5.0)';
  } else if (shearCount === 1) {
    srf = 2.5;
    srfDescription = 'Single shear zone in competent rock (excavation depth > 50m) (SRF = 2.5)';
  }

  return {
    ...currentParams,
    rqd: estRqd,
    jn,
    jnDescription,
    jr,
    jrDescription,
    ja,
    jaDescription,
    jw,
    jwDescription,
    srf,
    srfDescription,
    volumetricJointCountJv: Number(jv.toFixed(1)),
  };
}

/**
 * Generates an AutoCAD R12/2000 compatible .DXF vector file containing:
 * - Layer TUNNEL_PROFILE: Master tunnel excavation cross-section & perimeter frames in real-world meters
 * - Layer JOINT_SETS (J0..J5, F1): Multi-point vector geological polylines
 * - Layer ORIENTATION_LABELS: Dip direction / dip text annotations
 */
export function exportMappingSheetToDXF(
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  joints: Joint[],
  overbreakAnalysis?: OverbreakUndercutAnalysis,
  controlPoints: SurveyControlPoint[] = []
): string {
  const lines: string[] = [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$INSUNITS',
    '70',
    '6', // Meters
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
  ];

  // 1. Export Master Tunnel Cross-Section Profile as closed LWPOLYLINE / LINE segments
  const cs = geometry.crossSectionPoints;
  for (let i = 0; i < cs.length; i++) {
    const a = cs[i];
    const b = cs[(i + 1) % cs.length];
    lines.push(
      '0',
      'LINE',
      '8',
      'TUNNEL_PROFILE_DESIGN',
      '62',
      '4', // Cyan
      '10',
      a.x.toFixed(4),
      '20',
      a.y.toFixed(4),
      '30',
      '0.0',
      '11',
      b.x.toFixed(4),
      '21',
      b.y.toFixed(4),
      '31',
      '0.0'
    );
  }

  // 1b. Export Connected Surveyed / As-Built Profile, Overbreak & Undercut Regions
  if (overbreakAnalysis && overbreakAnalysis.surveyedPolygon.length >= 2) {
    const sp = overbreakAnalysis.surveyedPolygon;
    for (let i = 0; i < sp.length; i++) {
      const a = sp[i];
      const b = sp[(i + 1) % sp.length];
      lines.push(
        '0',
        'LINE',
        '8',
        'SURVEY_PROFILE_AS_BUILT',
        '62',
        '3', // Green
        '10',
        a.x.toFixed(4),
        '20',
        a.y.toFixed(4),
        '30',
        '0.0',
        '11',
        b.x.toFixed(4),
        '21',
        b.y.toFixed(4),
        '31',
        '0.0'
      );
    }

    for (const reg of overbreakAnalysis.overbreakRegions) {
      for (let i = 0; i < reg.polygon.length; i++) {
        const a = reg.polygon[i];
        const b = reg.polygon[(i + 1) % reg.polygon.length];
        lines.push(
          '0',
          'LINE',
          '8',
          'OVERBREAK_REGION',
          '62',
          '1', // Red
          '10',
          a.x.toFixed(4),
          '20',
          a.y.toFixed(4),
          '30',
          '0.0',
          '11',
          b.x.toFixed(4),
          '21',
          b.y.toFixed(4),
          '31',
          '0.0'
        );
      }
      lines.push(
        '0',
        'TEXT',
        '8',
        'OVERBREAK_LABELS',
        '10',
        reg.maxRadialPoint.x.toFixed(4),
        '20',
        reg.maxRadialPoint.y.toFixed(4),
        '30',
        '0.0',
        '40',
        '0.16',
        '1',
        `${reg.id}: +${reg.areaSqMeters.toFixed(2)}m2 (Max +${reg.maxRadialMeters.toFixed(2)}m) [${reg.reasonCategory}]`
      );
    }

    for (const reg of overbreakAnalysis.undercutRegions) {
      for (let i = 0; i < reg.polygon.length; i++) {
        const a = reg.polygon[i];
        const b = reg.polygon[(i + 1) % reg.polygon.length];
        lines.push(
          '0',
          'LINE',
          '8',
          'UNDERCUT_REGION',
          '62',
          '2', // Yellow
          '10',
          a.x.toFixed(4),
          '20',
          a.y.toFixed(4),
          '30',
          '0.0',
          '11',
          b.x.toFixed(4),
          '21',
          b.y.toFixed(4),
          '31',
          '0.0'
        );
      }
      lines.push(
        '0',
        'TEXT',
        '8',
        'UNDERCUT_LABELS',
        '10',
        reg.maxRadialPoint.x.toFixed(4),
        '20',
        reg.maxRadialPoint.y.toFixed(4),
        '30',
        '0.0',
        '40',
        '0.16',
        '1',
        `${reg.id}: -${reg.areaSqMeters.toFixed(2)}m2 (Max -${reg.maxRadialMeters.toFixed(2)}m) [${reg.reasonCategory}]`
      );
    }
  }

  // 1c. Export Survey Control Points
  for (const cp of controlPoints.filter((c) => c.visible !== false)) {
    lines.push(
      '0',
      'POINT',
      '8',
      'SURVEY_CONTROL_POINTS',
      '10',
      cp.point.x.toFixed(4),
      '20',
      cp.point.y.toFixed(4),
      '30',
      '0.0',
      '0',
      'TEXT',
      '8',
      'SURVEY_CONTROL_POINTS',
      '10',
      (cp.point.x + 0.08).toFixed(4),
      '20',
      (cp.point.y + 0.08).toFixed(4),
      '30',
      '0.0',
      '40',
      '0.15',
      '1',
      `${cp.label} (${cp.point.x.toFixed(2)}, ${cp.point.y.toFixed(2)})`
    );
  }

  // 2. Export all Mapped Vector Geological Traces in real-world meters
  for (const j of joints) {
    if (j.geometry.length < 2) continue;
    const yOffset = j.surface === 'face' ? 0 : geometry.height + 2.0;
    const xOffset =
      j.surface === 'leftWall'
        ? -(geometry.width / 2 + geometry.wallHeight / 2 + 1.0)
        : j.surface === 'rightWall'
        ? geometry.width / 2 + geometry.wallHeight / 2 + 1.0
        : 0;

    for (let i = 0; i < j.geometry.length - 1; i++) {
      const a = j.geometry[i];
      const b = j.geometry[i + 1];
      lines.push(
        '0',
        'LINE',
        '8',
        `GEOLOGY_${j.set}_${j.surface.toUpperCase()}`,
        '62',
        j.set === 'F1' ? '1' : j.set === 'J1' ? '1' : j.set === 'J2' ? '5' : '3',
        '10',
        (a.x + xOffset).toFixed(4),
        '20',
        (a.y + yOffset).toFixed(4),
        '30',
        '0.0',
        '11',
        (b.x + xOffset).toFixed(4),
        '21',
        (b.y + yOffset).toFixed(4),
        '31',
        '0.0'
      );
    }

    const mid = j.geometry[Math.floor(j.geometry.length / 2)];
    lines.push(
      '0',
      'TEXT',
      '8',
      'ORIENTATION_LABELS',
      '10',
      (mid.x + xOffset + 0.1).toFixed(4),
      '20',
      (mid.y + yOffset + 0.1).toFixed(4),
      '30',
      '0.0',
      '40',
      '0.18',
      '1',
      `${j.set}: ${String(Math.round(j.dipDirection)).padStart(3, '0')}/${String(Math.round(j.dip)).padStart(2, '0')} (${j.featureType})`
    );
  }

  // 3. Export Title Metadata Text
  lines.push(
    '0',
    'TEXT',
    '8',
    'TITLE_BLOCK',
    '10',
    (-geometry.width / 2).toFixed(4),
    '20',
    '-1.2000',
    '30',
    '0.0',
    '40',
    '0.25',
    '1',
    `${settings.tunnelName} | ${settings.faceChainage} | Drive N${String(Math.round(settings.driveDirection)).padStart(3, '0')}E | ${geometry.width}m x ${geometry.height}m`
  );

  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\n');
}

/**
 * Generates a comprehensive CSV Engineering Report containing:
 * 1. Tunnel Header & Master Geometry
 * 2. Barton's Q-Index Calculation & Rock Mass Summary
 * 3. Discontinuity-Set Engineering Table
 * 4. Individual Mapped Structural Traces Log
 */
export function exportGeologyAndQIndexToCSV(
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  joints: Joint[],
  jointSets: JointSet[],
  qIndexParams: QIndexParameters,
  rockMass: RockMassSummaryTable,
  overbreakAnalysis?: OverbreakUndercutAnalysis,
  controlPoints: SurveyControlPoint[] = [],
  sectionVolumeRows: SectionToSectionVolumeRow[] = []
): string {
  const qRes = calculateBartonQSystem(qIndexParams, geometry.width);
  const rows: string[][] = [
    ['AKASH TUNNEL MAPPER - ENGINEERING GEOLOGICAL MAPPING, OVERBREAK/UNDERCUT & QUANTITY LOG'],
    ['Tunnel Name', settings.tunnelName, 'Location / Project', settings.locationName || 'Underground Tunnel Works'],
    ['Chainage Interval', settings.chainage, 'Face Chainage', settings.faceChainage],
    ['Round / Pull Length (m)', String(settings.roundLength), 'Drive Azimuth (deg)', String(settings.driveDirection)],
    ['Width / Span (m)', String(geometry.width), 'Total Height (m)', String(geometry.height)],
    ['Date', settings.date, 'Mapped By', settings.mappedBy],
    [],
    ['OVERBREAK & UNDERCUT ENGINEERING QUANTITY SUMMARY'],
    [
      'Design Area (m2)',
      'Surveyed Area (m2)',
      'Overbreak Area (m2)',
      'Overbreak (%)',
      'Max Overbreak (m)',
      'Avg Overbreak (m)',
      'Overbreak Perimeter (m)',
      'Undercut Area (m2)',
      'Undercut (%)',
      'Max Undercut (m)',
      'Avg Undercut (m)',
      'Undercut Perimeter (m)',
      'Pull Interval (m)',
      'Design Volume (m3)',
      'Surveyed Volume (m3)',
      'Overbreak Volume (m3)',
      'Undercut Volume (m3)',
      'Primary Overbreak Reason Category',
      'Overbreak Reason Detail',
      'Primary Undercut Reason Category',
      'Undercut Reason Detail',
    ],
    overbreakAnalysis
      ? [
          overbreakAnalysis.designAreaSqMeters.toFixed(2),
          overbreakAnalysis.surveyedAreaSqMeters.toFixed(2),
          overbreakAnalysis.overbreakAreaSqMeters.toFixed(2),
          overbreakAnalysis.overbreakPercent.toFixed(2),
          overbreakAnalysis.maxRadialOverbreakMeters.toFixed(3),
          overbreakAnalysis.avgRadialOverbreakMeters.toFixed(3),
          overbreakAnalysis.affectedOverbreakPerimeterMeters.toFixed(2),
          overbreakAnalysis.undercutAreaSqMeters.toFixed(2),
          overbreakAnalysis.undercutPercent.toFixed(2),
          overbreakAnalysis.maxRadialUndercutMeters.toFixed(3),
          overbreakAnalysis.avgRadialUndercutMeters.toFixed(3),
          overbreakAnalysis.affectedUndercutPerimeterMeters.toFixed(2),
          overbreakAnalysis.pullIntervalMeters !== null
            ? overbreakAnalysis.pullIntervalMeters.toFixed(2)
            : 'N/A',
          overbreakAnalysis.designVolumeCubicMeters !== null
            ? overbreakAnalysis.designVolumeCubicMeters.toFixed(2)
            : overbreakAnalysis.volumeStatusMessage,
          overbreakAnalysis.surveyedVolumeCubicMeters !== null
            ? overbreakAnalysis.surveyedVolumeCubicMeters.toFixed(2)
            : overbreakAnalysis.volumeStatusMessage,
          overbreakAnalysis.overbreakVolumeCubicMeters !== null
            ? overbreakAnalysis.overbreakVolumeCubicMeters.toFixed(2)
            : overbreakAnalysis.volumeStatusMessage,
          overbreakAnalysis.undercutVolumeCubicMeters !== null
            ? overbreakAnalysis.undercutVolumeCubicMeters.toFixed(2)
            : overbreakAnalysis.volumeStatusMessage,
          overbreakAnalysis.overallOverbreakCategory,
          overbreakAnalysis.overallOverbreakReason,
          overbreakAnalysis.overallUndercutCategory,
          overbreakAnalysis.overallUndercutReason,
        ]
      : ['No active survey profile connected'],
    [],
    ...(overbreakAnalysis &&
    (overbreakAnalysis.overbreakRegions.length > 0 || overbreakAnalysis.undercutRegions.length > 0)
      ? [
          ['OVERBREAK & UNDERCUT REGIONAL BREAKDOWN (GEOLOGICAL VS MECHANICAL REASONS)'],
          [
            'Zone ID',
            'Type',
            'Location Sector',
            'Chainage',
            'Area (m2)',
            'Percent (%)',
            'Max Radial (m)',
            'Avg Radial (m)',
            'Affected Perimeter (m)',
            'Reason Category',
            'Linked Joint Sets',
            'Engineering / Geological Remarks',
          ],
          ...[...overbreakAnalysis.overbreakRegions, ...overbreakAnalysis.undercutRegions].map(
            (z) => [
              z.id,
              z.type,
              z.locationLabel,
              z.chainage,
              z.areaSqMeters.toFixed(3),
              z.percentageOfDesign.toFixed(2),
              z.maxRadialMeters.toFixed(3),
              z.avgRadialMeters.toFixed(3),
              z.affectedPerimeterMeters.toFixed(2),
              z.reasonCategory,
              z.linkedJointSets || 'None',
              z.reasonDetail,
            ]
          ),
          [],
        ]
      : []),
    ...(sectionVolumeRows.length > 0
      ? [
          ['SECTION-TO-SECTION EXCAVATION VOLUME TABLE (AVERAGE END AREA & PRISMOIDAL)'],
          [
            'Interval ID',
            'From Chainage',
            'To Chainage',
            'Interval Length L (m)',
            'Design Vol (m3)',
            'Surveyed Vol (m3)',
            'Overbreak Vol AvgEndArea (m3)',
            'Overbreak Vol Prismoidal (m3)',
            'Undercut Vol AvgEndArea (m3)',
            'Undercut Vol Prismoidal (m3)',
            'Primary Overbreak Reason',
          ],
          ...sectionVolumeRows.map((v) => [
            v.id,
            v.fromChainageLabel,
            v.toChainageLabel,
            v.intervalLengthMeters.toFixed(2),
            v.designVolumeCubicMeters.toFixed(2),
            v.surveyedVolumeCubicMeters.toFixed(2),
            v.overbreakVolumeAvgEndAreaCubicMeters.toFixed(2),
            v.overbreakVolumePrismoidalCubicMeters.toFixed(2),
            v.undercutVolumeAvgEndAreaCubicMeters.toFixed(2),
            v.undercutVolumePrismoidalCubicMeters.toFixed(2),
            v.primaryOverbreakReason,
          ]),
          [],
        ]
      : []),
    ...(controlPoints.length > 0
      ? [
          ['SURVEY CONTROL POINTS LOG'],
          ['Control Point ID', 'Label', 'Surface', 'X (m)', 'Y (m)', 'Visible', 'Locked'],
          ...controlPoints.map((cp) => [
            cp.id,
            cp.label,
            cp.surface,
            cp.point.x.toFixed(3),
            cp.point.y.toFixed(3),
            String(cp.visible !== false),
            String(Boolean(cp.locked)),
          ]),
          [],
        ]
      : []),
    ['BARTON NGI Q-SYSTEM ROCK MASS CLASSIFICATION'],
    ['RQD (%)', 'Jn', 'Jr', 'Ja', 'Jw', 'SRF', 'Q-Value', 'Rock Mass Class', 'Est. RMR89', 'ESR', 'De (m)', 'Recommended Support'],
    [
      String(qRes.effectiveRqd),
      String(qRes.effectiveJn),
      String(qIndexParams.jr),
      String(qIndexParams.ja),
      String(qIndexParams.jw),
      String(qIndexParams.srf),
      String(qRes.qValue),
      qRes.rockMassClass,
      String(qRes.estimatedRmr),
      String(qIndexParams.esr),
      String(qRes.equivalentDimensionDe),
      qRes.recommendedSupport,
    ],
    [],
    ['ROCK MASS & LITHOLOGY SUMMARY'],
    ['Rock Type', 'Rock Unit', 'Weathering Grade', 'Strength Grade', 'Foliation/Bedding Spacing', 'Groundwater', 'Overbreak Condition', 'Installed Support', 'Geologist Remarks'],
    [
      rockMass.rockType,
      rockMass.rockUnit,
      rockMass.weatheringGrade,
      rockMass.strengthGrade,
      rockMass.foliationBeddingSpacing,
      rockMass.groundwaterCondition,
      rockMass.overbreakCondition,
      rockMass.installedSupport,
      rockMass.geologistRemarks,
    ],
    [],
    ['DISCONTINUITY-SET TABLE'],
    ['Set ID', 'Orientation (DipDir/Dip)', 'Avg Strike (deg)', 'Spacing', 'Persistence', 'Aperture', 'Roughness', 'Infilling', 'Water Condition'],
    ...jointSets.map((js) => [
      js.id,
      js.orientation,
      js.avgStrike !== null ? String(js.avgStrike) : 'N/A',
      js.spacing,
      js.persistence,
      js.aperture,
      js.roughness,
      js.infilling,
      js.water,
    ]),
    [],
    ['INDIVIDUAL MAPPED STRUCTURAL TRACES LOG'],
    ['Trace ID', 'Surface', 'Set', 'Feature Type', 'Dip Direction (deg)', 'Dip (deg)', 'Strike (deg)', 'Persistence (m)', 'Vertices', 'Aperture', 'Roughness', 'Infilling', 'Water', 'Orientation Status'],
    ...joints.map((j) => [
      j.id,
      j.surface,
      j.set,
      j.featureType,
      String(Math.round(j.dipDirection)),
      String(Math.round(j.dip)),
      String(Math.round(j.strike)),
      j.persistenceMeters.toFixed(2),
      String(j.geometry.length),
      j.apertureMm || '1-3 mm',
      j.roughness || 'Rough / Undulating',
      j.infilling || 'Clean',
      j.waterCondition || 'Dry',
      j.orientationStatus,
    ]),
  ];

  return rows
    .map((r) =>
      r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
    )
    .join('\n');
}
