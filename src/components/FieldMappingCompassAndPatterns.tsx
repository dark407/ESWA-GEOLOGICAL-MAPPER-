import React, { useRef, useState } from 'react';
import {
  buildDipSurfaceOutlineAndCentroid,
  buildSmoothSvgPath,
  computeCrownLengthMeters,
  computeFaceTunnelOutlineDetails,
  computePanelCanvasGeometry,
  computePanelOrientationReferenceMeta,
  computePaylinePolygon,
  computeTraceInlineLabelPlacements,
  computeTraceOrientationFromTunnelDrive,
  computeTraceScreenDipTickVector,
  FIELD_JOINT_GROUP_COLORS,
  FIELD_JOINT_SET_IDS,
  FIELD_LITHOLOGY_CATALOG,
  FieldDipPlaneSurface,
  FieldExcavationRound,
  FieldJointGroupingId,
  FieldLithologyStroke,
  FieldPanelId,
  FieldJointTrace,
  FieldPoint2D,
  FieldRememberedRockItem,
  FieldStructuralFeature,
  FieldTransformStageMode,
  FieldTunnelLocationItem,
  FieldWaterCondition,
  FieldWaterMark,
  pruneFullyErasedLithologyStrokes,
  resolveRockDisplayInfo,
} from '../engine/fieldMappingEngine';
import {
  Compass,
} from 'lucide-react';
import {
  getTunnelRelativeDirectionLabel,
  getCrownStrikePair,
  calculatePlaneSurfaceIntersections,
  constructJointPlane,
  deriveAnchorPointFromPoints,
  calculateSurfaceApparentTraceAngles,
  TunnelSpatialGeometry,
} from '../engine/joint3DInspectorEngine';
import { getSurfacePanelLabelMap } from '../engine/surfaceMappingEngine';

/**
 * Geological SVG Hatch Patterns
 * Supports both Monochrome Black-to-Grey (Field Canvas & B/W Report) and Colourful (Color Report).
 */
export const FieldMonochromeGeologicalPatterns: React.FC<{
  prefix?: string;
  colorMode?: 'bw' | 'color';
  symbolDensity?: number;
  symbolDensityByPattern?: Record<string, number>;
  customColorsByRock?: Record<string, string>;
  extraLithologyDensities?: {
    patId: string;
    density: number;
    customColor?: string;
    domSuffix?: string;
    angleDeg?: number;
  }[];
  alternateStrokes?: FieldLithologyStroke[];
  alternatingStrokes?: FieldLithologyStroke[];
  rememberedRocks?: FieldRememberedRockItem[];
  bandSymbolDensity?: number;
  symbolAngleByPattern?: Record<string, number>;
  lithologyPatternAngle?: number;
  alternatingAngleDeg?: number;
}> = ({
  prefix = 'fpat',
  colorMode = 'bw',
  symbolDensity = 85,
  symbolDensityByPattern,
  customColorsByRock,
  extraLithologyDensities = [],
  alternateStrokes = [],
  alternatingStrokes = [],
  rememberedRocks = [],
  bandSymbolDensity = 85,
  symbolAngleByPattern,
  lithologyPatternAngle,
  alternatingAngleDeg,
}) => {
  const isColor = colorMode === 'color';
  const effectiveAltStrokes =
    alternatingStrokes && alternatingStrokes.length > 0
      ? alternatingStrokes
      : alternateStrokes;

  // Helper to render any rock lithology pattern with its own individual density, custom colour & orientation angle
  // (reducing density increases tile spacing while keeping symbol size constant, angleDeg applies patternTransform rotation)
  const renderRockPatternDef = (
    patId: string,
    domId: string,
    rawDensity: number,
    overrideColor?: string,
    angleDeg: number = 0
  ) => {
    const clampedDensity = Math.max(25, Math.min(220, rawDensity || 85));
    const s = Number((100 / clampedDensity).toFixed(3));
    const sc = (val: number) => Number((val * s).toFixed(2));
    const rockEntry = FIELD_LITHOLOGY_CATALOG.find(
      (r) => r.patternId === patId || r.id === patId
    );
    const chosenColor =
      overrideColor ||
      customColorsByRock?.[patId] ||
      (rockEntry ? customColorsByRock?.[rockEntry.id] : undefined) ||
      rockEntry?.colorTint ||
      '#f8fafc';
    const bg = isColor ? chosenColor : '#ffffff';

    const buildPatternNode = () => {
      switch (patId) {
      case 'quartzite':
        return (
          <pattern
            key={domId}
            id={domId}
            width={sc(56)}
            height={sc(56)}
            patternUnits="userSpaceOnUse"
          >
            <rect width={sc(56)} height={sc(56)} fill={bg} fillOpacity="0.96" />
            <circle cx={sc(12)} cy={sc(14)} r="1.45" fill="#0f172a" />
            <circle cx={sc(42)} cy={sc(18)} r="1.35" fill="#0f172a" />
            <circle cx={sc(26)} cy={sc(40)} r="1.45" fill="#0f172a" />
            <circle cx={sc(46)} cy={sc(44)} r="1.25" fill="#0f172a" />
            <path
              d={`M${sc(16) - 4} ${sc(36)} L${sc(16) + 4} ${sc(36)} M${sc(16)} ${sc(36) - 4} L${sc(16)} ${sc(36) + 4}`}
              stroke="#0f172a"
              strokeWidth="1.2"
            />
            <path
              d={`M${sc(40) - 4} ${sc(10)} L${sc(40) + 4} ${sc(10)} M${sc(40)} ${sc(10) - 4} L${sc(40)} ${sc(10) + 4}`}
              stroke="#0f172a"
              strokeWidth="1.15"
            />
          </pattern>
        );
      case 'phyllite':
        return (
          <pattern
            key={domId}
            id={domId}
            width={sc(68)}
            height={sc(44)}
            patternUnits="userSpaceOnUse"
          >
            <rect width={sc(68)} height={sc(44)} fill={bg} fillOpacity="0.96" />
            <path
              d={`M${sc(18) - 10} ${sc(14)} Q ${sc(18) - 5} ${sc(14) - 3.5}, ${sc(18)} ${sc(14)} T ${sc(18) + 10} ${sc(14)}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.25"
            />
            <path
              d={`M${sc(50) - 10} ${sc(14)} Q ${sc(50) - 5} ${sc(14) - 3.5}, ${sc(50)} ${sc(14)} T ${sc(50) + 10} ${sc(14)}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.25"
            />
            <path
              d={`M${sc(34) - 10} ${sc(34)} Q ${sc(34) - 5} ${sc(34) - 3.5}, ${sc(34)} ${sc(34)} T ${sc(34) + 10} ${sc(34)}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.25"
            />
          </pattern>
        );
      case 'schist':
        return (
          <pattern
            key={domId}
            id={domId}
            width={sc(72)}
            height={sc(48)}
            patternUnits="userSpaceOnUse"
          >
            <rect width={sc(72)} height={sc(48)} fill={bg} fillOpacity="0.96" />
            <path
              d={`M${sc(20) - 11} ${sc(14)} C ${sc(20) - 5} ${sc(14) - 4}, ${sc(20) + 5} ${sc(14) + 4}, ${sc(20) + 11} ${sc(14)}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.3"
            />
            <path
              d={`M${sc(54) - 11} ${sc(14)} C ${sc(54) - 5} ${sc(14) - 4}, ${sc(54) + 5} ${sc(14) + 4}, ${sc(54) + 11} ${sc(14)}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.3"
            />
            <path
              d={`M${sc(37) - 11} ${sc(38)} C ${sc(37) - 5} ${sc(38) - 4}, ${sc(37) + 5} ${sc(38) + 4}, ${sc(37) + 11} ${sc(38)}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.3"
            />
            <line
              x1={sc(27) - 5}
              y1={sc(26) - 1.8}
              x2={sc(27) + 5}
              y2={sc(26) + 1.8}
              stroke="#0f172a"
              strokeWidth="1.2"
            />
          </pattern>
        );
      case 'gneiss':
        return (
          <pattern
            key={domId}
            id={domId}
            width={sc(74)}
            height={sc(52)}
            patternUnits="userSpaceOnUse"
          >
            <rect width={sc(74)} height={sc(52)} fill={bg} fillOpacity="0.96" />
            <path
              d={`M${sc(18) - 9} ${sc(12)} L${sc(18) + 9} ${sc(12)} M${sc(56) - 9} ${sc(12)} L${sc(56) + 9} ${sc(12)}`}
              stroke="#0f172a"
              strokeWidth="1.3"
            />
            <ellipse
              cx={sc(37)}
              cy={sc(26)}
              rx="9.5"
              ry="4.2"
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.25"
            />
            <path
              d={`M${sc(16) - 9} ${sc(42)} L${sc(16) + 9} ${sc(42)} M${sc(54) - 9} ${sc(42)} L${sc(54) + 9} ${sc(42)}`}
              stroke="#0f172a"
              strokeWidth="1.3"
            />
          </pattern>
        );
      case 'granite':
        return (
          <pattern
            key={domId}
            id={domId}
            width={sc(60)}
            height={sc(60)}
            patternUnits="userSpaceOnUse"
          >
            <rect width={sc(60)} height={sc(60)} fill={bg} fillOpacity="0.96" />
            <path
              d={`M${sc(16) - 4} ${sc(16)} L${sc(16) + 4} ${sc(16)} M${sc(16)} ${sc(16) - 4} L${sc(16)} ${sc(16) + 4}`}
              stroke="#0f172a"
              strokeWidth="1.3"
            />
            <path
              d={`M${sc(44) - 4} ${sc(17) - 3.2} L${sc(44)} ${sc(17) + 3.2} L${sc(44) + 4} ${sc(17) - 3.2}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.25"
            />
            <path
              d={`M${sc(42) - 4} ${sc(42)} L${sc(42) + 4} ${sc(42)} M${sc(42)} ${sc(42) - 4} L${sc(42)} ${sc(42) + 4}`}
              stroke="#0f172a"
              strokeWidth="1.3"
            />
            <path
              d={`M${sc(18) - 4} ${sc(45) - 3.2} L${sc(18)} ${sc(45) + 3.2} L${sc(18) + 4} ${sc(45) - 3.2}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.25"
            />
          </pattern>
        );
      case 'basalt':
        return (
          <pattern
            key={domId}
            id={domId}
            width={sc(54)}
            height={sc(54)}
            patternUnits="userSpaceOnUse"
          >
            <rect width={sc(54)} height={sc(54)} fill={bg} fillOpacity="0.96" />
            <path
              d={`M${sc(16) - 4} ${sc(17) - 3.2} L${sc(16)} ${sc(17) + 3.2} L${sc(16) + 4} ${sc(17) - 3.2}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.35"
            />
            <path
              d={`M${sc(38) - 4} ${sc(39) - 3.2} L${sc(38)} ${sc(39) + 3.2} L${sc(38) + 4} ${sc(39) - 3.2}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.35"
            />
            <circle cx={sc(38)} cy={sc(16)} r="1.4" fill="#0f172a" />
            <circle cx={sc(16)} cy={sc(38)} r="1.4" fill="#0f172a" />
          </pattern>
        );
      case 'dolerite':
        return (
          <pattern
            key={domId}
            id={domId}
            width={sc(58)}
            height={sc(50)}
            patternUnits="userSpaceOnUse"
          >
            <rect width={sc(58)} height={sc(50)} fill={bg} fillOpacity="0.96" />
            <polygon
              points={`${sc(16)},${sc(15) - 4.2} ${sc(16) - 4.5},${sc(15) + 3.8} ${sc(16) + 4.5},${sc(15) + 3.8}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.25"
            />
            <polygon
              points={`${sc(42)},${sc(35) + 4.2} ${sc(42) - 4.5},${sc(35) - 3.8} ${sc(42) + 4.5},${sc(35) - 3.8}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.25"
            />
            <line x1={sc(36)} y1={sc(14)} x2={sc(46)} y2={sc(18)} stroke="#0f172a" strokeWidth="1.2" />
            <line x1={sc(14)} y1={sc(36)} x2={sc(24)} y2={sc(32)} stroke="#0f172a" strokeWidth="1.2" />
          </pattern>
        );
      case 'shale':
        return (
          <pattern
            key={domId}
            id={domId}
            width={sc(60)}
            height={sc(40)}
            patternUnits="userSpaceOnUse"
          >
            <rect width={sc(60)} height={sc(40)} fill={bg} fillOpacity="0.96" />
            <line x1={sc(8)} y1={sc(10)} x2={sc(24)} y2={sc(10)} stroke="#0f172a" strokeWidth="1.25" />
            <line x1={sc(34)} y1={sc(10)} x2={sc(50)} y2={sc(10)} stroke="#0f172a" strokeWidth="1.25" />
            <line x1={sc(18)} y1={sc(22)} x2={sc(36)} y2={sc(22)} stroke="#0f172a" strokeWidth="1.25" />
            <line x1={sc(10)} y1={sc(34)} x2={sc(26)} y2={sc(34)} stroke="#0f172a" strokeWidth="1.25" />
            <line x1={sc(38)} y1={sc(34)} x2={sc(54)} y2={sc(34)} stroke="#0f172a" strokeWidth="1.25" />
          </pattern>
        );
      case 'limestone':
        return (
          <pattern
            key={domId}
            id={domId}
            width={sc(68)}
            height={sc(44)}
            patternUnits="userSpaceOnUse"
          >
            <rect width={sc(68)} height={sc(44)} fill={bg} fillOpacity="0.96" />
            <path
              d={`M${sc(20) - 12} ${sc(14)} L${sc(20) + 12} ${sc(14)} M${sc(20)} ${sc(14) - 5.5} L${sc(20)} ${sc(14) + 5.5}`}
              stroke="#0f172a"
              strokeWidth="1.25"
            />
            <path
              d={`M${sc(52) - 12} ${sc(34)} L${sc(52) + 12} ${sc(34)} M${sc(52)} ${sc(34) - 5.5} L${sc(52)} ${sc(34) + 5.5}`}
              stroke="#0f172a"
              strokeWidth="1.25"
            />
          </pattern>
        );
      case 'dolomite':
        return (
          <pattern
            key={domId}
            id={domId}
            width={sc(68)}
            height={sc(44)}
            patternUnits="userSpaceOnUse"
          >
            <rect width={sc(68)} height={sc(44)} fill={bg} fillOpacity="0.96" />
            <path
              d={`M${sc(20) - 12} ${sc(14)} L${sc(20) + 12} ${sc(14)} M${sc(20) + 3} ${sc(14) - 5.5} L${sc(20) - 3} ${sc(14) + 5.5}`}
              stroke="#0f172a"
              strokeWidth="1.25"
            />
            <path
              d={`M${sc(52) - 12} ${sc(34)} L${sc(52) + 12} ${sc(34)} M${sc(52) + 3} ${sc(34) - 5.5} L${sc(52) - 3} ${sc(34) + 5.5}`}
              stroke="#0f172a"
              strokeWidth="1.25"
            />
          </pattern>
        );
      case 'slate':
        // Slate / Argillite (SLT): Closely-spaced straight parallel slaty cleavage lines with oblique cleavage ticks
        return (
          <pattern
            key={domId}
            id={domId}
            width={sc(64)}
            height={sc(40)}
            patternUnits="userSpaceOnUse"
          >
            <rect width={sc(64)} height={sc(40)} fill={bg} fillOpacity="0.96" />
            <line x1={sc(8)} y1={sc(12)} x2={sc(28)} y2={sc(12)} stroke="#0f172a" strokeWidth="1.25" />
            <line x1={sc(18)} y1={sc(12)} x2={sc(22)} y2={sc(8)} stroke="#0f172a" strokeWidth="1.1" />
            <line x1={sc(38)} y1={sc(12)} x2={sc(58)} y2={sc(12)} stroke="#0f172a" strokeWidth="1.25" />
            <line x1={sc(48)} y1={sc(12)} x2={sc(52)} y2={sc(8)} stroke="#0f172a" strokeWidth="1.1" />
            <line x1={sc(22)} y1={sc(30)} x2={sc(44)} y2={sc(30)} stroke="#0f172a" strokeWidth="1.25" />
            <line x1={sc(33)} y1={sc(30)} x2={sc(37)} y2={sc(26)} stroke="#0f172a" strokeWidth="1.1" />
          </pattern>
        );
      case 'amphibolite':
        // Amphibolite (AMP): Hornblende 120°/60° diamond cleavage rhomb prisms + nematoblastic needles
        return (
          <pattern
            key={domId}
            id={domId}
            width={sc(66)}
            height={sc(48)}
            patternUnits="userSpaceOnUse"
          >
            <rect width={sc(66)} height={sc(48)} fill={bg} fillOpacity="0.96" />
            <polygon
              points={`${sc(18)},${sc(14) - 4.5} ${sc(18) + 7.5},${sc(14)} ${sc(18)},${sc(14) + 4.5} ${sc(18) - 7.5},${sc(14)}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.25"
            />
            <line x1={sc(18) - 7.5} y1={sc(14)} x2={sc(18) + 7.5} y2={sc(14)} stroke="#0f172a" strokeWidth="1.0" />
            <polygon
              points={`${sc(48)},${sc(34) - 4.5} ${sc(48) + 7.5},${sc(34)} ${sc(48)},${sc(34) + 4.5} ${sc(48) - 7.5},${sc(34)}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.25"
            />
            <line x1={sc(48) - 7.5} y1={sc(34)} x2={sc(48) + 7.5} y2={sc(34)} stroke="#0f172a" strokeWidth="1.0" />
            <line x1={sc(42)} y1={sc(14)} x2={sc(54)} y2={sc(14)} stroke="#0f172a" strokeWidth="1.2" />
            <line x1={sc(12)} y1={sc(34)} x2={sc(24)} y2={sc(34)} stroke="#0f172a" strokeWidth="1.2" />
          </pattern>
        );
      case 'marble':
        // Marble / Calc-Silicate (MRB): Interlocking crystalline carbonate blocks with twin lamellae diagonals
        return (
          <pattern
            key={domId}
            id={domId}
            width={sc(68)}
            height={sc(46)}
            patternUnits="userSpaceOnUse"
          >
            <rect width={sc(68)} height={sc(46)} fill={bg} fillOpacity="0.96" />
            <rect
              x={sc(10)}
              y={sc(8)}
              width="16"
              height="10"
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.2"
            />
            <line x1={sc(10) + 3} y1={sc(8) + 10} x2={sc(10) + 13} y2={sc(8)} stroke="#0f172a" strokeWidth="1.0" />
            <rect
              x={sc(42)}
              y={sc(26)}
              width="16"
              height="10"
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.2"
            />
            <line x1={sc(42) + 3} y1={sc(26) + 10} x2={sc(42) + 13} y2={sc(26)} stroke="#0f172a" strokeWidth="1.0" />
          </pattern>
        );
      case 'migmatite':
        // Migmatite (MIG): Ptygmatic folded leucosome S-waves & gneissic dashes
        return (
          <pattern
            key={domId}
            id={domId}
            width={sc(70)}
            height={sc(50)}
            patternUnits="userSpaceOnUse"
          >
            <rect width={sc(70)} height={sc(50)} fill={bg} fillOpacity="0.96" />
            <path
              d={`M${sc(14)} ${sc(16)} C ${sc(22)} ${sc(6)}, ${sc(26)} ${sc(26)}, ${sc(34)} ${sc(16)}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.3"
            />
            <path
              d={`M${sc(38)} ${sc(36)} C ${sc(46)} ${sc(26)}, ${sc(50)} ${sc(46)}, ${sc(58)} ${sc(36)}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.3"
            />
            <path
              d={`M${sc(50) - 3.5} ${sc(16)} L${sc(50) + 3.5} ${sc(16)} M${sc(50)} ${sc(16) - 3.5} L${sc(50)} ${sc(16) + 3.5}`}
              stroke="#0f172a"
              strokeWidth="1.15"
            />
          </pattern>
        );
      case 'conglomerate':
        // Conglomerate / Tuff / Breccia (CNG): Rounded clast pebbles + matrix stipples
        return (
          <pattern
            key={domId}
            id={domId}
            width={sc(64)}
            height={sc(50)}
            patternUnits="userSpaceOnUse"
          >
            <rect width={sc(64)} height={sc(50)} fill={bg} fillOpacity="0.96" />
            <ellipse cx={sc(18)} cy={sc(16)} rx="6" ry="4" fill="none" stroke="#0f172a" strokeWidth="1.25" />
            <ellipse cx={sc(46)} cy={sc(34)} rx="6.5" ry="4.2" fill="none" stroke="#0f172a" strokeWidth="1.25" />
            <circle cx={sc(44)} cy={sc(14)} r="1.4" fill="#0f172a" />
            <circle cx={sc(20)} cy={sc(36)} r="1.4" fill="#0f172a" />
          </pattern>
        );
      case 'siltstone':
        // Siltstone (SLT): Alternating fine dots and short bedding dashes
        return (
          <pattern
            key={domId}
            id={domId}
            width={sc(58)}
            height={sc(42)}
            patternUnits="userSpaceOnUse"
          >
            <rect width={sc(58)} height={sc(42)} fill={bg} fillOpacity="0.96" />
            <line x1={sc(10)} y1={sc(14)} x2={sc(24)} y2={sc(14)} stroke="#0f172a" strokeWidth="1.2" />
            <circle cx={sc(36)} cy={sc(14)} r="1.35" fill="#0f172a" />
            <circle cx={sc(16)} cy={sc(32)} r="1.35" fill="#0f172a" />
            <line x1={sc(30)} y1={sc(32)} x2={sc(46)} y2={sc(32)} stroke="#0f172a" strokeWidth="1.2" />
          </pattern>
        );
      case 'charnockite':
      case 'gabbro':
      case 'serpentinite':
        return (
          <pattern
            key={domId}
            id={domId}
            width={sc(60)}
            height={sc(52)}
            patternUnits="userSpaceOnUse"
          >
            <rect width={sc(60)} height={sc(52)} fill={bg} fillOpacity="0.96" />
            <polygon
              points={`${sc(18)},${sc(14) - 4} ${sc(18) - 4.5},${sc(14) + 4} ${sc(18) + 4.5},${sc(14) + 4}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.25"
            />
            <polygon
              points={`${sc(44)},${sc(36) + 4} ${sc(44) - 4.5},${sc(36) - 4} ${sc(44) + 4.5},${sc(36) - 4}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.25"
            />
            <line x1={sc(38)} y1={sc(14)} x2={sc(48)} y2={sc(14)} stroke="#0f172a" strokeWidth="1.2" />
          </pattern>
        );
      case 'sandstone':
      default:
        return (
          <pattern
            key={domId}
            id={domId}
            width={sc(54)}
            height={sc(42)}
            patternUnits="userSpaceOnUse"
          >
            <rect width={sc(54)} height={sc(42)} fill={bg} fillOpacity="0.96" />
            <circle cx={sc(12)} cy={sc(12)} r="1.45" fill="#0f172a" />
            <circle cx={sc(38)} cy={sc(14)} r="1.35" fill="#0f172a" />
            <circle cx={sc(24)} cy={sc(28)} r="1.45" fill="#0f172a" />
            <line
              x1={sc(27) - 8}
              y1={sc(38)}
              x2={sc(27) + 8}
              y2={sc(38)}
              stroke="#0f172a"
              strokeWidth="1.15"
            />
          </pattern>
        );
      }
    };

    const patEl = buildPatternNode();
    const rotAngle = Math.round(angleDeg || 0);
    if (rotAngle !== 0 && React.isValidElement(patEl)) {
      return React.cloneElement(patEl as React.ReactElement<{ patternTransform?: string }>, {
        patternTransform: `rotate(${rotAngle}, 500, 500)`,
      });
    }
    return patEl;
  };

  const baseRockPatterns = [
    'quartzite',
    'phyllite',
    'schist',
    'gneiss',
    'granite',
    'basalt',
    'dolerite',
    'shale',
    'limestone',
    'dolomite',
    'sandstone',
    'slate',
    'amphibolite',
    'marble',
    'migmatite',
    'conglomerate',
    'siltstone',
    'charnockite',
    'gabbro',
    'serpentinite',
  ];

  // Deduplicate extra (patId, density, customColor, angleDeg) pairs so each stroke/lithology gets its own exact density, colour & orientation angle
  const uniqueExtraMap = new Map<
    string,
    { patId: string; density: number; customColor?: string; angleDeg?: number }
  >();
  extraLithologyDensities.forEach((item) => {
    const d = Math.round(item.density || 85);
    const a = Math.round(
      item.angleDeg ??
        symbolAngleByPattern?.[item.patId] ??
        lithologyPatternAngle ??
        0
    );
    const angledSuffix = `${item.patId}-d${d}-a${a}`;
    const plainSuffix = `${item.patId}-d${d}`;
    const key = item.domSuffix || (a !== 0 ? angledSuffix : plainSuffix);
    if (!uniqueExtraMap.has(key)) {
      uniqueExtraMap.set(key, {
        patId: item.patId,
        density: d,
        customColor: item.customColor,
        angleDeg: a,
      });
    }
    // Also ensure plainSuffix is registered so fallback URLs always resolve
    if (!uniqueExtraMap.has(plainSuffix)) {
      uniqueExtraMap.set(plainSuffix, {
        patId: item.patId,
        density: d,
        customColor: item.customColor,
        angleDeg: a,
      });
    }
  });

  // Ensure all sub-rocks in any alternating lithology bands have their base pattern definitions registered with proper angle
  effectiveAltStrokes.forEach((st) => {
    const subRocks = st.alternatingRockIds?.length
      ? st.alternatingRockIds
      : st.alternateRockTypes || [];
    const stAngle = Math.round(st.alternateAngleDeg ?? alternatingAngleDeg ?? -22);
    if (subRocks.length >= 2) {
      subRocks.forEach((rId) => {
        const rm = resolveRockDisplayInfo(rId, rememberedRocks);
        const rPat = rm.patternId || 'quartzite';
        const rDens = Math.round(
          symbolDensityByPattern?.[rId] ??
            symbolDensityByPattern?.[rPat] ??
            symbolDensity ??
            85
        );
        const rCol =
          customColorsByRock?.[rId] ||
          customColorsByRock?.[rPat] ||
          rm.colorTint;
        const key = `${rPat}-d${rDens}`;
        if (!uniqueExtraMap.has(key)) {
          uniqueExtraMap.set(key, {
            patId: rPat,
            density: rDens,
            customColor: rCol,
            angleDeg: stAngle,
          });
        }
        const aKey = `${rPat}-d${rDens}-a${stAngle}`;
        if (!uniqueExtraMap.has(aKey)) {
          uniqueExtraMap.set(aKey, {
            patId: rPat,
            density: rDens,
            customColor: rCol,
            angleDeg: stAngle,
          });
        }
      });
    }
  });

  // Vein & Foliation Band spacing (sb): completely independent from Rock Lithology symbol density!
  const clampedBandDensity = Math.max(25, Math.min(220, bandSymbolDensity || 85));
  const sb = Number((100 / clampedBandDensity).toFixed(3));
  const scb = (val: number) => Number((val * sb).toFixed(2));

  return (
    <defs>
      {/* Standard per-lithology patterns */}
      {baseRockPatterns.map((patId) => {
        const rockAngle =
          symbolAngleByPattern?.[patId] ??
          lithologyPatternAngle ??
          0;
        return renderRockPatternDef(
          patId,
          `${prefix}-${patId}`,
          symbolDensityByPattern?.[patId] ?? symbolDensity,
          customColorsByRock?.[patId],
          rockAngle
        );
      })}

      {/* Per-stroke / per-custom-lithology specific density, colour & angle pattern instances */}
      {Array.from(uniqueExtraMap.entries()).map(([suffix, item]) =>
        renderRockPatternDef(
          item.patId,
          `${prefix}-${suffix}`,
          item.density,
          item.customColor,
          item.angleDeg ?? 0
        )
      )}

      {/* Alternating Sedimentary / Metamorphic Lithology Bands (2 or 3 Rocks with Choosable Spacing) */}
      {effectiveAltStrokes
        .filter((st) => {
          const rList = st.alternatingRockIds?.length
            ? st.alternatingRockIds
            : st.alternateRockTypes || [];
          return rList.length >= 2;
        })
        .map((st) => {
          const rawRocks = st.alternatingRockIds?.length
            ? st.alternatingRockIds
            : st.alternateRockTypes || [];
          const rocks = rawRocks.slice(0, 3);
          const bandW = Math.max(
            8,
            Math.min(180, st.alternatingSpacingPx ?? st.alternateSpacingPx ?? 24)
          );
          const totalPeriod = rocks.length * bandW;
          const angle = st.alternateAngleDeg ?? alternatingAngleDeg ?? -22;
          return (
            <pattern
              key={`${prefix}-alt-${st.id}`}
              id={`${prefix}-alt-${st.id}`}
              width="1400"
              height={totalPeriod}
              patternUnits="userSpaceOnUse"
              patternTransform={`rotate(${angle}, 500, 500)`}
            >
              {rocks.map((rId, idx) => {
                const rm = resolveRockDisplayInfo(rId, rememberedRocks);
                const rPat = rm.patternId || 'quartzite';
                const rDens = Math.round(
                  symbolDensityByPattern?.[rId] ??
                    symbolDensityByPattern?.[rPat] ??
                    symbolDensity ??
                    85
                );
                const rBg = isColor
                  ? customColorsByRock?.[rId] ||
                    customColorsByRock?.[rPat] ||
                    rm.colorTint ||
                    '#fef9c3'
                  : '#ffffff';
                return (
                  <g key={`${st.id}-alt-band-${idx}`}>
                    <rect
                      x="-600"
                      y={idx * bandW}
                      width="2600"
                      height={bandW}
                      fill={rBg}
                    />
                    <rect
                      x="-600"
                      y={idx * bandW}
                      width="2600"
                      height={bandW}
                      fill={`url(#${prefix}-${rPat}-d${rDens})`}
                    />
                    <line
                      x1="-600"
                      y1={(idx + 1) * bandW}
                      x2="2000"
                      y2={(idx + 1) * bandW}
                      stroke="#334155"
                      strokeWidth="1.25"
                      strokeDasharray="7,4"
                    />
                  </g>
                );
              })}
            </pattern>
          );
        })}

      {/* ==================== VEIN & FOLIATION BAND PATTERNS (Controlled ONLY by bandSymbolDensity) ==================== */}

      {/* Foliation / Schistosity Band (S1): constant-size sigmoidal foliation waves + cleavage ticks */}
      <pattern
        id={`${prefix}-band_foliation_s1`}
        width={scb(52)}
        height={scb(36)}
        patternUnits="userSpaceOnUse"
      >
        <rect
          width={scb(52)}
          height={scb(36)}
          fill={isColor ? '#dcfce7' : '#e2e8f0'}
          fillOpacity="0.92"
        />
        <path
          d={`M${scb(15) - 9} ${scb(11)} Q ${scb(15) - 4.5} ${scb(11) - 3.5}, ${scb(15)} ${scb(11)} T ${scb(15) + 9} ${scb(11)}`}
          fill="none"
          stroke="#0f172a"
          strokeWidth="1.25"
        />
        <line
          x1={scb(15)}
          y1={scb(11)}
          x2={scb(15)}
          y2={scb(11) + 4.5}
          stroke="#0f172a"
          strokeWidth="1.15"
        />
        <path
          d={`M${scb(38) - 9} ${scb(25)} Q ${scb(38) - 4.5} ${scb(25) - 3.5}, ${scb(38)} ${scb(25)} T ${scb(38) + 9} ${scb(25)}`}
          fill="none"
          stroke="#0f172a"
          strokeWidth="1.25"
        />
        <line
          x1={scb(38)}
          y1={scb(25)}
          x2={scb(38)}
          y2={scb(25) + 4.5}
          stroke="#0f172a"
          strokeWidth="1.15"
        />
      </pattern>

      {/* Bedding / Stratification Band (S0): constant-size parallel bedding lines + interbed dots */}
      <pattern
        id={`${prefix}-band_bedding_s0`}
        width={scb(50)}
        height={scb(36)}
        patternUnits="userSpaceOnUse"
      >
        <rect
          width={scb(50)}
          height={scb(36)}
          fill={isColor ? '#fef9c3' : '#e2e8f0'}
          fillOpacity="0.92"
        />
        <line
          x1={scb(16) - 9}
          y1={scb(11)}
          x2={scb(16) + 9}
          y2={scb(11)}
          stroke="#0f172a"
          strokeWidth="1.25"
        />
        <circle cx={scb(36)} cy={scb(11)} r="1.4" fill="#1e293b" />
        <circle cx={scb(14)} cy={scb(25)} r="1.4" fill="#1e293b" />
        <line
          x1={scb(34) - 9}
          y1={scb(25)}
          x2={scb(34) + 9}
          y2={scb(25)}
          stroke="#0f172a"
          strokeWidth="1.25"
        />
      </pattern>

      {/* Shale Band / Interbed: constant-size horizontal dashed laminations with adjustable band spacing */}
      <pattern
        id={`${prefix}-shale_vein`}
        width={scb(56)}
        height={scb(32)}
        patternUnits="userSpaceOnUse"
      >
        <rect
          width={scb(56)}
          height={scb(32)}
          fill={isColor ? '#e2e8f0' : '#cbd5e1'}
          fillOpacity="0.92"
        />
        <line
          x1={scb(15) - 7}
          y1={scb(10)}
          x2={scb(15) + 7}
          y2={scb(10)}
          stroke="#1e293b"
          strokeWidth="1.25"
        />
        <line
          x1={scb(39) - 7}
          y1={scb(22)}
          x2={scb(39) + 7}
          y2={scb(22)}
          stroke="#1e293b"
          strokeWidth="1.25"
        />
      </pattern>

      {/* Quartz / Calcite Vein Band: constant-size cross-vein ticks with adjustable band spacing */}
      <pattern
        id={`${prefix}-quartz_vein`}
        width={scb(48)}
        height={scb(48)}
        patternUnits="userSpaceOnUse"
      >
        <rect width={scb(48)} height={scb(48)} fill="#ffffff" fillOpacity="0.95" />
        <path
          d={`M${scb(24) - 8} ${scb(24) + 8} L${scb(24) + 8} ${scb(24) - 8} M${scb(24) - 4} ${scb(24) - 6} L${scb(24) + 4} ${scb(24) + 2}`}
          stroke="#1e293b"
          strokeWidth="1.15"
        />
      </pattern>

      {/* Pegmatite / Aplite Vein Band: constant-size × and diamond crystalline symbols with adjustable band spacing */}
      <pattern
        id={`${prefix}-band_pegmatite`}
        width={scb(50)}
        height={scb(44)}
        patternUnits="userSpaceOnUse"
      >
        <rect
          width={scb(50)}
          height={scb(44)}
          fill={isColor ? '#ffe4e6' : '#f1f5f9'}
          fillOpacity="0.94"
        />
        <path
          d={`M${scb(15) - 4} ${scb(14) - 4} L${scb(15) + 4} ${scb(14) + 4} M${scb(15) - 4} ${scb(14) + 4} L${scb(15) + 4} ${scb(14) - 4}`}
          stroke="#0f172a"
          strokeWidth="1.2"
        />
        <polygon
          points={`${scb(36)},${scb(29) - 4.5} ${scb(36) + 4.5},${scb(29)} ${scb(36)},${scb(29) + 4.5} ${scb(36) - 4.5},${scb(29)}`}
          fill="none"
          stroke="#1e293b"
          strokeWidth="1.15"
        />
      </pattern>

      {/* Dolerite / Mafic Dyke Band: constant-size interlocking triangle laths with adjustable band spacing */}
      <pattern
        id={`${prefix}-band_mafic_dyke`}
        width={scb(48)}
        height={scb(44)}
        patternUnits="userSpaceOnUse"
      >
        <rect
          width={scb(48)}
          height={scb(44)}
          fill={isColor ? '#cbd5e1' : '#cbd5e1'}
          fillOpacity="0.94"
        />
        <polygon
          points={`${scb(15)},${scb(14) - 4} ${scb(15) - 4},${scb(14) + 3.5} ${scb(15) + 4},${scb(14) + 3.5}`}
          fill="none"
          stroke="#0f172a"
          strokeWidth="1.2"
        />
        <polygon
          points={`${scb(34)},${scb(30) + 4} ${scb(34) - 4},${scb(30) - 3.5} ${scb(34) + 4},${scb(30) - 3.5}`}
          fill="none"
          stroke="#0f172a"
          strokeWidth="1.2"
        />
      </pattern>

      {/* Shear / Fault Gouge Band: constant-size braided shear ticks with adjustable band spacing */}
      <pattern
        id={`${prefix}-shear_zone`}
        width={scb(48)}
        height={scb(48)}
        patternUnits="userSpaceOnUse"
      >
        <rect
          width={scb(48)}
          height={scb(48)}
          fill={isColor ? '#fee2e2' : '#cbd5e1'}
          fillOpacity="0.92"
        />
        <path
          d={`M${scb(24) - 8} ${scb(24) + 8} L${scb(24) + 8} ${scb(24) - 8} M${scb(24) - 5} ${scb(24) - 5} L${scb(24) + 5} ${scb(24) + 5}`}
          stroke="#0f172a"
          strokeWidth="1.2"
        />
      </pattern>

      {/* Dip Plane Surface exposed facet shading */}
      <pattern id={`${prefix}-dip-plane`} width="28" height="28" patternUnits="userSpaceOnUse">
        <rect
          width="28"
          height="28"
          fill={isColor ? '#fef3c7' : '#cbd5e1'}
          fillOpacity="0.42"
        />
        <line x1="0" y1="28" x2="28" y2="0" stroke="#1e293b" strokeWidth="1.15" strokeDasharray="6,4" />
      </pattern>
    </defs>
  );
};

/**
 * Renders an individual geological structure symbol for a specific Vein / Foliation Band type,
 * centered at (0,0) and scaled to half-width `w` and half-height `h` (which grow with band thickness).
 */
export const renderVeinFoliationStructureSymbolAtOrigin = (
  patId: string,
  rockType: string,
  w: number,
  h: number,
  sw: number,
  strokeColor: string,
  _isColor: boolean
) => {
  const key = patId || rockType;
  const isColor = false;
  switch (key) {
    case 'band_foliation_s1':
    case 'foliation_s1':
      // Foliation / Schistosity Band (S1): Double sigmoidal S-cleavage waves + oblique foliation tick
      return (
        <g stroke={strokeColor} strokeWidth={sw} fill="none" strokeLinecap="round">
          <path
            d={`M ${-w} ${-h * 0.38} Q ${-w * 0.48} ${-h * 0.95}, 0 ${-h * 0.38} T ${w} ${-h * 0.38}`}
          />
          <path
            d={`M ${-w} ${h * 0.38} Q ${-w * 0.48} ${-h * 0.18}, 0 ${h * 0.38} T ${w} ${h * 0.38}`}
          />
          <line x1={-w * 0.22} y1={-h * 0.72} x2={w * 0.22} y2={h * 0.72} strokeWidth={sw * 0.95} />
          <circle
            cx={0}
            cy={0}
            r={Math.max(1.3, h * 0.16)}
            fill={strokeColor}
            stroke="none"
          />
        </g>
      );

    case 'band_bedding_s0':
    case 'bedding_s0':
      // Bedding / Stratification Band (S0): Parallel sedimentary strata lines + cross-bed ties + graded grains
      return (
        <g stroke={strokeColor} strokeWidth={sw} fill="none" strokeLinecap="round">
          <line x1={-w} y1={-h * 0.52} x2={w} y2={-h * 0.52} />
          <line x1={-w} y1={h * 0.52} x2={w} y2={h * 0.52} />
          <line x1={-w * 0.48} y1={-h * 0.52} x2={-w * 0.2} y2={h * 0.52} strokeWidth={sw * 0.85} />
          <line x1={w * 0.25} y1={-h * 0.52} x2={w * 0.52} y2={h * 0.52} strokeWidth={sw * 0.85} />
          <circle
            cx={0}
            cy={0}
            r={Math.max(1.5, h * 0.2)}
            fill={strokeColor}
            stroke="none"
          />
        </g>
      );

    case 'quartz_vein':
      // Quartz / Calcite Vein Band (QVN): Crystalline euhedral diamond prism + internal cross-axes + wall comb ticks
      return (
        <g stroke={strokeColor} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polygon
            points={`0,${-h * 0.82} ${w * 0.72},0 0,${h * 0.82} ${-w * 0.72},0`}
            fill="none"
          />
          <line x1={-w * 0.72} y1={0} x2={w * 0.72} y2={0} strokeWidth={sw * 0.85} />
          <line x1={0} y1={-h * 0.82} x2={0} y2={h * 0.82} strokeWidth={sw * 0.85} />
          <line x1={-w * 0.92} y1={-h * 0.78} x2={-w * 0.68} y2={-h * 0.35} strokeWidth={sw * 0.8} />
          <line x1={w * 0.92} y1={h * 0.78} x2={w * 0.68} y2={h * 0.35} strokeWidth={sw * 0.8} />
        </g>
      );

    case 'shale_vein':
      // Shale / Argillaceous Interbed Band (SHL): Three-tier fissile laminated cleavage dashes + clay lenticles
      return (
        <g stroke={strokeColor} strokeWidth={sw} fill="none" strokeLinecap="round">
          <line x1={-w * 0.95} y1={-h * 0.56} x2={-w * 0.12} y2={-h * 0.56} />
          <line x1={w * 0.12} y1={-h * 0.56} x2={w * 0.95} y2={-h * 0.56} />
          <line x1={-w * 0.65} y1={0} x2={w * 0.65} y2={0} strokeWidth={sw * 1.1} />
          <line x1={-w * 0.95} y1={h * 0.56} x2={-w * 0.12} y2={h * 0.56} />
          <line x1={w * 0.12} y1={h * 0.56} x2={w * 0.95} y2={h * 0.56} />
          <circle cx={-w * 0.82} cy={0} r={Math.max(1.2, h * 0.15)} fill={strokeColor} stroke="none" />
          <circle cx={w * 0.82} cy={0} r={Math.max(1.2, h * 0.15)} fill={strokeColor} stroke="none" />
        </g>
      );

    case 'band_pegmatite':
    case 'pegmatite_vein':
      // Pegmatite / Aplite Vein Band (PEG): Coarse crystalline graphic-granite star ×/+ with feldspar rhombs
      return (
        <g stroke={strokeColor} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <line x1={-w * 0.55} y1={-h * 0.72} x2={w * 0.55} y2={h * 0.72} />
          <line x1={-w * 0.55} y1={h * 0.72} x2={w * 0.55} y2={-h * 0.72} />
          <line x1={0} y1={-h * 0.82} x2={0} y2={h * 0.82} strokeWidth={sw * 0.85} />
          <polygon
            points={`${-w * 0.95},0 ${-w * 0.72},${-h * 0.36} ${-w * 0.48},0 ${-w * 0.72},${h * 0.36}`}
            fill="none"
            strokeWidth={sw * 0.85}
          />
          <polygon
            points={`${w * 0.48},0 ${w * 0.72},${-h * 0.36} ${w * 0.95},0 ${w * 0.72},${h * 0.36}`}
            fill="none"
            strokeWidth={sw * 0.85}
          />
        </g>
      );

    case 'band_mafic_dyke':
    case 'mafic_dyke_band':
      // Dolerite / Mafic Dyke Band (DYK): Interlocking ophitic triangles (△ ▽) + chilled-margin ticks
      return (
        <g stroke={strokeColor} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polygon
            points={`${-w * 0.82},${h * 0.68} ${-w * 0.32},${-h * 0.72} ${w * 0.18},${h * 0.68}`}
            fill="none"
          />
          <polygon
            points={`${-w * 0.18},${-h * 0.68} ${w * 0.32},${h * 0.72} ${w * 0.82},${-h * 0.68}`}
            fill="none"
          />
        </g>
      );

    case 'shear_zone':
    default:
      // Shear / Clay Gouge Band (SHR): Anastomosing shear phacoid lens + Riedel opposing shear sense half-arrows (⇌)
      return (
        <g stroke={strokeColor} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path
            d={`M ${-w * 0.92} 0 Q 0 ${-h * 0.92} ${w * 0.92} 0 Q 0 ${h * 0.92} ${-w * 0.92} 0`}
            fill="none"
          />
          {/* Upper dextral half-arrow */}
          <path d={`M ${-w * 0.52} ${-h * 0.22} L ${w * 0.52} ${-h * 0.22} L ${w * 0.22} ${-h * 0.58}`} />
          {/* Lower opposing half-arrow */}
          <path d={`M ${w * 0.52} ${h * 0.22} L ${-w * 0.52} ${h * 0.22} L ${-w * 0.22} ${h * 0.58}`} />
        </g>
      );
  }
};

/**
 * Small inline preview badge for Tool 2 selector buttons & legends showing each band's geological structure symbol
 */
export const FieldVeinFoliationSymbolPreviewSvg: React.FC<{
  patternId: string;
  rockType: string;
  colorTint?: string;
  colorMode?: 'bw' | 'color';
}> = ({ patternId, rockType }) => {
  return (
    <svg viewBox="-22 -14 44 28" className="w-11 h-7 shrink-0 rounded border border-slate-600 bg-white">
      <line x1="-20" y1="-9" x2="20" y2="-9" stroke="#0f172a" strokeWidth="1.4" />
      <line x1="-20" y1="9" x2="20" y2="9" stroke="#0f172a" strokeWidth="1.4" />
      {renderVeinFoliationStructureSymbolAtOrigin(
        patternId,
        rockType,
        13,
        7.0,
        1.5,
        '#0f172a',
        false
      )}
    </svg>
  );
};

/**
 * Shared SVG Renderer for Vein & Foliation Bands (Tool 2) on both the Field Mapping Canvas and Unfolded Report.
 * - Shows a clear dual-rail geological band outline around the full band thickness (`bandThicknessPx`).
 * - Scales the internal geological structure symbols proportionally with `bandThicknessPx`.
 * - Spaces the symbols along the band trajectory according to that band's individual `symbolDensity`.
 */
export const FieldVeinFoliationBandSvgElement: React.FC<{
  stroke: FieldLithologyStroke;
  round: FieldExcavationRound;
  rememberedRocks?: FieldRememberedRockItem[];
  colorMode?: 'bw' | 'color';
  isSelected?: boolean;
  isReportSheet?: boolean;
  onClick?: (e: React.MouseEvent<SVGGElement>) => void;
}> = ({
  stroke: st,
  round,
  rememberedRocks = [],
  colorMode = 'bw',
  isSelected = false,
  isReportSheet = false,
  onClick,
}) => {
  if (!st.points || st.points.length === 0) return null;
  const isColor = colorMode === 'color';
  const rockMeta = resolveRockDisplayInfo(st.rockType, rememberedRocks);
  const patId = st.patternId || rockMeta.patternId || 'quartz_vein';

  // Resolve this band's individual showing thickness (px) — supports ultra-thin 2px up to 96px
  const bandThickPx = Math.max(
    2,
    Math.min(
      96,
      st.bandThicknessPx ??
        round.veinBandThicknessByType?.[st.rockType] ??
        round.veinBandThicknessByType?.[patId] ??
        round.defaultBandThicknessPx ??
        (st.brushRadius * 2 || 28)
    )
  );

  // Resolve this band's individual symbol density (%) — supports very low 10% up to 200%
  const bandDensity = Math.max(
    10,
    Math.min(
      200,
      Math.round(
        st.symbolDensity ??
          round.veinBandDensityByType?.[st.rockType] ??
          round.veinBandDensityByType?.[patId] ??
          round.veinBandSymbolDensity ??
          100
      )
    )
  );

  // Build left/right offset boundary rails at ±(bandThickPx / 2) and normal vectors at each vertex
  const pts = st.points;
  const halfW = bandThickPx / 2;
  const leftRailPts: { x: number; y: number }[] = [];
  const rightRailPts: { x: number; y: number }[] = [];

  if (pts.length === 1) {
    leftRailPts.push({ x: pts[0].x - 10, y: pts[0].y - halfW }, { x: pts[0].x + 10, y: pts[0].y - halfW });
    rightRailPts.push({ x: pts[0].x - 10, y: pts[0].y + halfW }, { x: pts[0].x + 10, y: pts[0].y + halfW });
  } else {
    for (let i = 0; i < pts.length; i++) {
      const pPrev = pts[Math.max(0, i - 1)];
      const pNext = pts[Math.min(pts.length - 1, i + 1)];
      let dx = pNext.x - pPrev.x;
      let dy = pNext.y - pPrev.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.001) {
        dx = 1;
        dy = 0;
      } else {
        dx /= len;
        dy /= len;
      }
      const nx = -dy;
      const ny = dx;
      leftRailPts.push({ x: pts[i].x + nx * halfW, y: pts[i].y + ny * halfW });
      rightRailPts.push({ x: pts[i].x - nx * halfW, y: pts[i].y - ny * halfW });
    }
  }

  const leftRailD =
    leftRailPts.length > 1
      ? leftRailPts
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(' ')
      : '';
  const rightRailD =
    rightRailPts.length > 1
      ? rightRailPts
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(' ')
      : '';
  const startCapD =
    leftRailPts.length > 0 && rightRailPts.length > 0
      ? `M ${leftRailPts[0].x.toFixed(1)} ${leftRailPts[0].y.toFixed(1)} L ${rightRailPts[0].x.toFixed(1)} ${rightRailPts[0].y.toFixed(1)}`
      : '';
  const endCapD =
    leftRailPts.length > 1 && rightRailPts.length > 1
      ? `M ${leftRailPts[leftRailPts.length - 1].x.toFixed(1)} ${leftRailPts[leftRailPts.length - 1].y.toFixed(1)} L ${rightRailPts[rightRailPts.length - 1].x.toFixed(1)} ${rightRailPts[rightRailPts.length - 1].y.toFixed(1)}`
      : '';

  // Multi-row symbol scaling + individual symbolSize multiplier:
  // As band size increases, symbol size increases first; when band size increases further (>= 26px, >= 46px, >= 68px), add extra symbol rows!
  const bandSymSizePct = Math.max(
    40,
    Math.min(
      220,
      Math.round(st.symbolSize ?? round.veinBandSymbolSize ?? 100)
    )
  );
  const symSizeScale = bandSymSizePct / 100;
  const rowCount =
    bandThickPx >= 68 ? 4 : bandThickPx >= 46 ? 3 : bandThickPx >= 26 ? 2 : 1;
  const effectiveRowHeight = bandThickPx / rowCount;
  const symH = Math.max(1.8, effectiveRowHeight * 0.43 * symSizeScale);
  const symW = Math.max(2.4, effectiveRowHeight * 0.49 * symSizeScale);
  const symStrokeW = Math.max(
    0.75,
    Math.min(2.6, effectiveRowHeight * 0.085 * Math.sqrt(symSizeScale))
  );

  const rowOffsets: number[] =
    rowCount === 1
      ? [0]
      : rowCount === 2
      ? [-bandThickPx * 0.24, bandThickPx * 0.24]
      : rowCount === 3
      ? [-bandThickPx * 0.31, 0, bandThickPx * 0.31]
      : [-bandThickPx * 0.35, -bandThickPx * 0.12, bandThickPx * 0.12, bandThickPx * 0.35];

  // Spacing step along the curve: controlled by bandDensity (from 10% wide spacing to 200% tight spacing)
  const baseSpacing = Math.max(8, effectiveRowHeight * 1.05 * Math.sqrt(symSizeScale));
  const stepDist = Math.max(5.5, baseSpacing * (100 / bandDensity));

  const sampledSymbols: { x: number; y: number; nx: number; ny: number; angleDeg: number }[] = [];
  if (pts.length === 1) {
    sampledSymbols.push({ x: pts[0].x, y: pts[0].y, nx: 0, ny: 1, angleDeg: 0 });
  } else {
    // Compute cumulative arc length
    const segLengths: number[] = [];
    let totalLen = 0;
    for (let i = 1; i < pts.length; i++) {
      const sl = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      segLengths.push(sl);
      totalLen += sl;
    }
    if (totalLen < 6) {
      sampledSymbols.push({ x: pts[0].x, y: pts[0].y, nx: 0, ny: 1, angleDeg: 0 });
    } else {
      const startOffset = Math.min(stepDist * 0.5, totalLen * 0.25);
      for (let dist = startOffset; dist <= totalLen - startOffset * 0.35; dist += stepDist) {
        let acc = 0;
        for (let i = 0; i < segLengths.length; i++) {
          const sl = segLengths[i];
          if (acc + sl >= dist || i === segLengths.length - 1) {
            const t = sl > 0.001 ? Math.max(0, Math.min(1, (dist - acc) / sl)) : 0;
            const x = pts[i].x + (pts[i + 1].x - pts[i].x) * t;
            const y = pts[i].y + (pts[i + 1].y - pts[i].y) * t;
            const dx = pts[i + 1].x - pts[i].x;
            const dy = pts[i + 1].y - pts[i].y;
            const dLen = Math.hypot(dx, dy) || 1;
            const nx = -dy / dLen;
            const ny = dx / dLen;
            const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
            sampledSymbols.push({ x, y, nx, ny, angleDeg });
            break;
          }
          acc += sl;
        }
      }
      if (sampledSymbols.length === 0) {
        const midIdx = Math.floor(pts.length / 2);
        const mp = pts[midIdx];
        const p0 = pts[Math.max(0, midIdx - 1)];
        const p1 = pts[Math.min(pts.length - 1, midIdx + 1)];
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const dLen = Math.hypot(dx, dy) || 1;
        sampledSymbols.push({
          x: mp.x,
          y: mp.y,
          nx: -dy / dLen,
          ny: dx / dLen,
          angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
        });
      }
    }
  }

  // Midpoint orientation tick & label (computed accurately from trace geometry if not stored)
  const fallbackOri =
    st.foliationDipDirection === undefined || st.foliationDipAmount === undefined
      ? computeTraceOrientationFromTunnelDrive(
          pts,
          st.panel,
          round.tunnelDriveDirection
        )
      : null;
  const dipDir = st.foliationDipDirection ?? fallbackOri?.dipDirection ?? 135;
  const dipAmt = st.foliationDipAmount ?? fallbackOri?.dipAmount ?? 60;
  const {
    mid,
    ux: tickUx,
    uy: tickUy,
    labelAngleDeg: bandAngleDeg,
  } = computeTraceScreenDipTickVector(
    pts,
    st.panel,
    dipDir,
    round.tunnelDriveDirection
  );
  const tickLen = halfW + (isReportSheet ? 15 : 22);
  const tickX = mid.x + tickUx * tickLen;
  const tickY = mid.y + tickUy * tickLen;

  const outlineColor = isSelected ? '#d97706' : '#0f172a';
  const railStrokeW = bandThickPx < 6 ? 1.0 : isSelected ? 2.4 : 1.5;
  const bandPolygonD =
    isColor && leftRailPts.length > 1 && rightRailPts.length > 1
      ? `${leftRailPts
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(' ')} ${[...rightRailPts]
          .reverse()
          .map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(' ')} Z`
      : '';

  return (
    <g
      onClick={onClick}
      className={onClick ? 'cursor-pointer' : undefined}
    >
      {/* 0. Mild geological colour tint fill in Colour Mode */}
      {isColor && bandPolygonD && (
        <path
          d={bandPolygonD}
          fill={rockMeta.colorTint || '#fef9c3'}
          fillOpacity={0.68}
          stroke="none"
        />
      )}
      {/* 1. Clean Left & Right Parallel Geological Boundary Outline Rails */}
      {leftRailD && (
        <path
          d={leftRailD}
          fill="none"
          stroke={outlineColor}
          strokeWidth={railStrokeW}
          strokeDasharray={patId === 'shear_zone' ? '7,3' : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {rightRailD && (
        <path
          d={rightRailD}
          fill="none"
          stroke={outlineColor}
          strokeWidth={railStrokeW}
          strokeDasharray={patId === 'shear_zone' ? '7,3' : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {startCapD && (
        <path
          d={startCapD}
          fill="none"
          stroke={outlineColor}
          strokeWidth={railStrokeW * 0.85}
          strokeLinecap="round"
        />
      )}
      {endCapD && (
        <path
          d={endCapD}
          fill="none"
          stroke={outlineColor}
          strokeWidth={railStrokeW * 0.85}
          strokeLinecap="round"
        />
      )}

      {/* 2. Thickness-Scaled & Multi-Row Geological Structure Symbols Inside Outline */}
      {sampledSymbols.map((pt, idx) =>
        rowOffsets.map((rowOff, rIdx) => {
          // Stagger alternate rows slightly along tangent for natural geological symbol packing
          const tangentRad = (pt.angleDeg * Math.PI) / 180;
          const staggerAlong = rowCount > 1 && rIdx % 2 === 1 ? stepDist * 0.25 : 0;
          const sx = pt.x + pt.nx * rowOff + Math.cos(tangentRad) * staggerAlong;
          const sy = pt.y + pt.ny * rowOff + Math.sin(tangentRad) * staggerAlong;
          return (
            <g
              key={`${idx}-${rIdx}`}
              transform={`translate(${sx.toFixed(1)}, ${sy.toFixed(1)}) rotate(${pt.angleDeg.toFixed(1)})`}
            >
              {renderVeinFoliationStructureSymbolAtOrigin(
                patId,
                st.rockType,
                symW,
                symH,
                symStrokeW,
                outlineColor,
                false
              )}
            </g>
          );
        })
      )}

      {/* 5. Dip Direction Tick & Inline Label */}
      <line
        x1={mid.x}
        y1={mid.y}
        x2={tickX}
        y2={tickY}
        stroke={outlineColor}
        strokeWidth={isReportSheet ? 2.4 : 2.9}
      />
      <circle
        cx={tickX}
        cy={tickY}
        r={isReportSheet ? 2.2 : 2.8}
        fill={outlineColor}
      />
      <text
        x={mid.x}
        y={mid.y - halfW - (isReportSheet ? 5 : 7)}
        textAnchor="middle"
        transform={`rotate(${bandAngleDeg.toFixed(1)}, ${mid.x.toFixed(1)}, ${(mid.y - halfW - (isReportSheet ? 5 : 7)).toFixed(1)})`}
        fontSize={isReportSheet ? '12.5' : '15.5'}
        fontWeight="900"
        fontFamily="Arial, sans-serif"
        fill={isSelected ? '#b45309' : '#0f172a'}
        stroke="#ffffff"
        strokeWidth={isReportSheet ? '3' : '3.6'}
        paintOrder="stroke"
      >
        {rockMeta.code} {String(dipDir).padStart(3, '0')}°/{dipAmt}°
      </text>
    </g>
  );
};

interface FieldLiveCompassInclinometerProps {
  tunnelDriveDirection?: number;
  tunnelDriveAzimuth?: number;
  activePanel: FieldPanelId;
  dipDirection: number;
  dipAmount: number;
  strike: number;
  crownDipSign: '+90' | '-90';
  selectedSetId: FieldJointGroupingId;
  activeToolMode?: string;
  modeLabel?: string;
  selectedItemLabel?: string | null;
  showGroupingSelector?: boolean;
  showSetSelector?: boolean;
  onChangeDipDirection: (nextDipDir: number) => void;
  onChangeDipAmount: (nextDipAmount: number) => void;
  onChangeCrownDipSign: (nextSign: '+90' | '-90') => void;
  onChangeSetId: (nextSet: FieldJointGroupingId) => void;
  onRecalculateFromTrace?: () => void;
}

/**
 * Stagnant Tunnel-Drive Compass & Inclinometer Dial
 * - Outer compass frame is fixed ("stagnant") with Tunnel Drive Direction at the top (12 o'clock).
 * - Inner needle is rotatable by dragging directly on the dial or tapping +/- buttons.
 * - Live-reflects drawn Joint Trace dip direction & dip amount AND allows editing them,
 *   and serves as the primary measurement instrument when recording a Dip Plane Surface or Foliation Plane.
 */
export const FieldLiveCompassInclinometer: React.FC<
  FieldLiveCompassInclinometerProps
> = ({
  tunnelDriveDirection,
  tunnelDriveAzimuth,
  activePanel,
  dipDirection,
  dipAmount,
  strike,
  crownDipSign,
  selectedSetId,
  activeToolMode,
  modeLabel,
  selectedItemLabel,
  showGroupingSelector = false,
  showSetSelector = false,
  onChangeDipDirection,
  onChangeDipAmount,
  onChangeCrownDipSign,
  onChangeSetId,
  onRecalculateFromTrace,
}) => {
  const compassSvgRef = useRef<SVGSVGElement | null>(null);
  const inclinometerSvgRef = useRef<SVGSVGElement | null>(null);
  const [draggingCompass, setDraggingCompass] = useState(false);
  const [draggingInclinometer, setDraggingInclinometer] = useState(false);

  const effectiveDrive = Number.isFinite(tunnelDriveDirection)
    ? Number(tunnelDriveDirection)
    : Number.isFinite(tunnelDriveAzimuth)
    ? Number(tunnelDriveAzimuth)
    : 45;
  const normDrive = ((effectiveDrive % 360) + 360) % 360;
  // Tunnel Drive Quadrants: Top (12 o'clock) is ALWAYS Tunnel Drive Direction, then +90° clockwise per quadrant
  const panelTopAz = normDrive;
  const q1Drive = normDrive;
  const q2Drive = (normDrive + 90) % 360;
  const q3Drive = (normDrive + 180) % 360;
  const q4Drive = (normDrive + 270) % 360;

  const safeDipDir = Number.isFinite(dipDirection) ? ((dipDirection % 360) + 360) % 360 : 135;
  const safeDipAmt = Number.isFinite(dipAmount) ? Math.max(0, Math.min(90, dipAmount)) : 60;
  const needleRelativeDeg = (((safeDipDir - panelTopAz) % 360) + 360) % 360;

  const updateCompassFromPointer = (clientX: number, clientY: number) => {
    const svg = compassSvgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const relDeg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    const nextGlobalDipDir = Math.round((panelTopAz + relDeg) % 360);
    onChangeDipDirection(nextGlobalDipDir);
  };

  const updateInclinometerFromPointer = (clientX: number, clientY: number) => {
    const svg = inclinometerSvgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.25;
    const cy = rect.top + rect.height * 0.18;
    const dx = Math.max(1, clientX - cx);
    const dy = Math.max(0, clientY - cy);
    const degFromHoriz = Math.round(
      Math.max(0, Math.min(90, (Math.atan2(dy, dx) * 180) / Math.PI))
    );
    onChangeDipAmount(degFromHoriz);
  };

  const needleRad = ((needleRelativeDeg - 90) * Math.PI) / 180;
  const perpRad = needleRad + Math.PI / 2;
  const tipX = 75 + 50 * Math.cos(needleRad);
  const tipY = 75 + 50 * Math.sin(needleRad);
  const tailX = 75 - 38 * Math.cos(needleRad);
  const tailY = 75 - 38 * Math.sin(needleRad);
  const sideLx = 75 + 7 * Math.cos(perpRad);
  const sideLy = 75 + 7 * Math.sin(perpRad);
  const sideRx = 75 - 7 * Math.cos(perpRad);
  const sideRy = 75 - 7 * Math.sin(perpRad);

  const incRad = (safeDipAmt * Math.PI) / 180;
  const incPivotX = 28;
  const incPivotY = 22;
  const incRadius = 68;
  const incTipX = incPivotX + incRadius * Math.cos(incRad);
  const incTipY = incPivotY + incRadius * Math.sin(incRad);

  const isCrown = activePanel === 'crown';
  const crownStrike = ((safeDipDir - 90) % 360 + 360) % 360;
  const crownStrikePair = getCrownStrikePair(crownStrike);
  const relDirLabel = getTunnelRelativeDirectionLabel(safeDipDir);

  // Strike vector angle in SVG dial coordinates for Crown
  const strikeRelativeDeg = (((crownStrike - panelTopAz) % 360) + 360) % 360;
  const strikeRad1 = ((strikeRelativeDeg - 90) * Math.PI) / 180;
  const strikeRad2 = strikeRad1 + Math.PI;
  const sTip1X = 75 + 48 * Math.cos(strikeRad1);
  const sTip1Y = 75 + 48 * Math.sin(strikeRad1);
  const sTip2X = 75 + 48 * Math.cos(strikeRad2);
  const sTip2Y = 75 + 48 * Math.sin(strikeRad2);

  return (
    <div className="flex flex-col gap-2 bg-slate-900 text-slate-100 rounded-xl p-2.5 border border-slate-700 select-none">
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
        <div className="flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-amber-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-100">
            {isCrown ? 'Crown Strike & Clinometer' : 'Tunnel-Relative Compass & Clinometer'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-amber-300 truncate max-w-[130px]">
            {selectedItemLabel
              ? `Editing ${selectedItemLabel}`
              : modeLabel ||
                (activeToolMode === 'dip_surface'
                  ? 'Dip Surface Mode'
                  : 'Live Trace Ori')}
          </span>
          {onRecalculateFromTrace && (
            <button
              type="button"
              onClick={onRecalculateFromTrace}
              title="Re-calculate exact Dip Direction and Dip Amount from trace geometry"
              className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-extrabold text-[9px] hover:bg-amber-400 shrink-0 cursor-pointer"
            >
              Auto Trace
            </button>
          )}
        </div>
      </div>

      {/* Only show Joint Grouping buttons when in Joint Grouping mode */}
      {(showGroupingSelector || showSetSelector) && (
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => onChangeSetId('unassigned')}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
              selectedSetId === 'unassigned'
                ? 'bg-white text-slate-950 shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            J (Black)
          </button>
          {FIELD_JOINT_SET_IDS.map((setId) => {
            const col = FIELD_JOINT_GROUP_COLORS[setId];
            return (
              <button
                key={setId}
                type="button"
                onClick={() => onChangeSetId(setId)}
                style={{
                  borderColor: col.stroke,
                  backgroundColor:
                    selectedSetId === setId ? col.stroke : undefined,
                }}
                className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                  selectedSetId === setId
                    ? 'text-white shadow-xs'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {setId}
              </button>
            );
          })}
        </div>
      )}

      {/* Side-by-Side Compass/Strike & Clinometer Dials */}
      <div className="grid grid-cols-2 gap-2 items-center">
        {/* 1. TUNNEL-RELATIVE COMPASS (FACE/WALLS) OR DUAL-STRIKE AXIS DIAL (CROWN) */}
        <div className="flex flex-col items-center bg-slate-950/80 rounded-lg p-1.5 border border-slate-800">
          <div className="text-[10px] font-mono text-slate-400 mb-0.5 truncate max-w-[150px]">
            {isCrown ? (
              <>
                Strike: <strong className="text-amber-400">{crownStrikePair.label}</strong>
              </>
            ) : (
              <>
                Dip: <strong className="text-amber-400">{String(safeDipDir).padStart(3, '0')}° ({relDirLabel})</strong>
              </>
            )}
          </div>
          <svg
            ref={compassSvgRef}
            viewBox="0 0 150 150"
            className={`w-20 h-20 sm:w-24 sm:h-24 xl:w-28 xl:h-28 touch-none ${
              isCrown ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
            }`}
            onPointerDown={(e) => {
              if (isCrown) return; // Crown must NOT provide direct dip-direction editing
              e.currentTarget.setPointerCapture(e.pointerId);
              setDraggingCompass(true);
              updateCompassFromPointer(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (isCrown || !draggingCompass) return;
              updateCompassFromPointer(e.clientX, e.clientY);
            }}
            onPointerUp={() => {
              if (!isCrown) setDraggingCompass(false);
            }}
          >
            <circle
              cx="75"
              cy="75"
              r="66"
              fill="#0f172a"
              stroke="#475569"
              strokeWidth="2.5"
            />
            <circle
              cx="75"
              cy="75"
              r="54"
              fill="none"
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="2,3"
            />
            <line x1="75" y1="21" x2="75" y2="129" stroke="#1e293b" strokeWidth="1" />
            <line x1="21" y1="75" x2="129" y2="75" stroke="#1e293b" strokeWidth="1" />

            {/* Tunnel Reference Direction Labels (Top is always Tunnel Drive Direction, +90° each quadrant clockwise) */}
            <polygon points="75,6 70,15 80,15" fill="#22d3ee" />
            <text
              x="75"
              y="24"
              textAnchor="middle"
              fill="#22d3ee"
              fontSize="8"
              fontWeight="900"
              fontFamily="monospace"
            >
              {String(q1Drive).padStart(3, '0')}° FWD
            </text>
            <text
              x="129"
              y="78"
              textAnchor="middle"
              fill="#38bdf8"
              fontSize="7.5"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {String(q2Drive).padStart(3, '0')}° R
            </text>
            <text
              x="21"
              y="78"
              textAnchor="middle"
              fill="#cbd5e1"
              fontSize="7.5"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {String(q4Drive).padStart(3, '0')}° L
            </text>
            <text
              x="75"
              y="136"
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="7.5"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {String(q3Drive).padStart(3, '0')}° BACK
            </text>

            {isCrown ? (
              /* Crown Mode: Collinear Bidirectional Dual Strike Needles (Differing by exactly 180°) */
              <g>
                {/* Collinear strike axis bar */}
                <line
                  x1={sTip1X}
                  y1={sTip1Y}
                  x2={sTip2X}
                  y2={sTip2Y}
                  stroke="#f59e0b"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
                {/* Arrowhead 1 */}
                <circle cx={sTip1X} cy={sTip1Y} r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.2" />
                {/* Arrowhead 2 (opposite direction) */}
                <circle cx={sTip2X} cy={sTip2Y} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.2" />
                <circle cx="75" cy="75" r="5.5" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.8" />
              </g>
            ) : (
              /* Face/Wall Mode: Rotatable Dip-Direction Pointer */
              <g>
                <polygon
                  points={`${tailX},${tailY} ${sideLx},${sideLy} ${sideRx},${sideRy}`}
                  fill="#94a3b8"
                  stroke="#0f172a"
                  strokeWidth="1"
                />
                <polygon
                  points={`${tipX},${tipY} ${sideLx},${sideLy} ${sideRx},${sideRy}`}
                  fill="#f59e0b"
                  stroke="#fef3c7"
                  strokeWidth="1.2"
                />
                <circle
                  cx={tipX}
                  cy={tipY}
                  r="4.5"
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                />
                <circle
                  cx="75"
                  cy="75"
                  r="5.5"
                  fill="#f8fafc"
                  stroke="#0f172a"
                  strokeWidth="1.8"
                />
              </g>
            )}
          </svg>

          {isCrown ? (
            <div className="flex flex-col items-center w-full mt-1 px-1 text-center">
              <span className="text-[10px] font-mono font-bold text-amber-400">
                {crownStrikePair.label}
              </span>
              <span className="text-[8px] text-slate-400 italic">
                Crown Strike Axis (No Dip Edit)
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between w-full mt-1 px-1">
                <button
                  type="button"
                  onClick={() => onChangeDipDirection((safeDipDir - 2 + 360) % 360)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-mono cursor-pointer"
                  title="Decrease Dip Direction"
                >
                  ◄
                </button>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {String(safeDipDir).padStart(3, '0')}°
                </span>
                <button
                  type="button"
                  onClick={() => onChangeDipDirection((safeDipDir + 2) % 360)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-mono cursor-pointer"
                  title="Increase Dip Direction"
                >
                  ►
                </button>
              </div>
              <span className="text-[9px] text-slate-400">{relDirLabel} (000°–360°)</span>
            </>
          )}
        </div>

        {/* 2. FIELD INCLINOMETER (Dip Amount 0-90° across All Panels) */}
        <div className="flex flex-col items-center bg-slate-950/80 rounded-lg p-1.5 border border-slate-800">
          <div className="text-[10px] font-mono text-slate-400 mb-0.5">
            Inclinometer:{' '}
            <strong className="text-emerald-400">{dipAmount}° Dip</strong>
          </div>
          <svg
            ref={inclinometerSvgRef}
            viewBox="0 0 120 115"
            className="w-20 h-20 sm:w-24 sm:h-24 xl:w-28 xl:h-28 touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDraggingInclinometer(true);
              updateInclinometerFromPointer(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (!draggingInclinometer) return;
              updateInclinometerFromPointer(e.clientX, e.clientY);
            }}
            onPointerUp={() => setDraggingInclinometer(false)}
          >
            <path
              d={`M ${incPivotX} ${incPivotY} L ${incPivotX + incRadius} ${incPivotY} A ${incRadius} ${incRadius} 0 0 1 ${incPivotX} ${
                incPivotY + incRadius
              } Z`}
              fill="#0f172a"
              stroke="#475569"
              strokeWidth="2"
            />
            {[0, 15, 30, 45, 60, 75, 90].map((deg) => {
              const r = (deg * Math.PI) / 180;
              const x1 = incPivotX + (incRadius - 7) * Math.cos(r);
              const y1 = incPivotY + (incRadius - 7) * Math.sin(r);
              const x2 = incPivotX + incRadius * Math.cos(r);
              const y2 = incPivotY + incRadius * Math.sin(r);
              const tx = incPivotX + (incRadius + 11) * Math.cos(r);
              const ty = incPivotY + (incRadius + 11) * Math.sin(r);
              return (
                <g key={deg}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth="1.2" />
                  {deg % 30 === 0 && (
                    <text
                      x={tx}
                      y={ty + 3}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="8.5"
                      fontFamily="monospace"
                    >
                      {deg}°
                    </text>
                  )}
                </g>
              );
            })}

            <line
              x1={incPivotX}
              y1={incPivotY}
              x2={incTipX}
              y2={incTipY}
              stroke="#10b981"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle
              cx={incTipX}
              cy={incTipY}
              r="5.5"
              fill="#10b981"
              stroke="#0f172a"
              strokeWidth="1.5"
            />
            <circle
              cx={incPivotX}
              cy={incPivotY}
              r="4.5"
              fill="#e2e8f0"
              stroke="#0f172a"
              strokeWidth="1.5"
            />
          </svg>

          <div className="flex items-center justify-between w-full mt-1 px-1">
            <button
              type="button"
              onClick={() => onChangeDipAmount(Math.max(0, dipAmount - 2))}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-mono cursor-pointer"
              title="Decrease Dip Amount"
            >
              ◄
            </button>
            <span className="text-xs font-mono font-bold text-emerald-400">
              {dipAmount}°
            </span>
            <button
              type="button"
              onClick={() => onChangeDipAmount(Math.min(90, dipAmount + 2))}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-mono cursor-pointer"
              title="Increase Dip Amount"
            >
              ►
            </button>
          </div>
          <span className="text-[9px] text-slate-400">Dip Angle (0–90°)</span>
        </div>
      </div>

      {/* Direct Numeric Fine Edit Row */}
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        {isCrown ? (
          <div className="flex items-center justify-between bg-slate-800/80 px-2 py-1 rounded text-[10px] font-mono">
            <span className="text-slate-400">Strike:</span>
            <span className="font-bold text-amber-300">{crownStrikePair.label}</span>
          </div>
        ) : (
          <label className="flex items-center justify-between bg-slate-800/80 px-2 py-1 rounded text-[10px] font-mono">
            <span className="text-slate-400">Dip Dir°:</span>
            <input
              type="number"
              min={0}
              max={360}
              value={dipDirection}
              onChange={(e) =>
                onChangeDipDirection(
                  ((parseInt(e.target.value, 10) || 0) % 360 + 360) % 360
                )
              }
              className="w-12 text-right font-bold text-amber-300 bg-transparent focus:outline-none"
            />
          </label>
        )}
        <label className="flex items-center justify-between bg-slate-800/80 px-2 py-1 rounded text-[10px] font-mono">
          <span className="text-slate-400">Dip Amt°:</span>
          <input
            type="number"
            min={0}
            max={90}
            value={dipAmount}
            onChange={(e) =>
              onChangeDipAmount(
                Math.max(0, Math.min(90, parseInt(e.target.value, 10) || 0))
              )
            }
            className="w-12 text-right font-bold text-emerald-300 bg-transparent focus:outline-none"
          />
        </label>
      </div>

      {/* Real-time Surface Apparent Dip vs True Dip conversion indicator */}
      {(() => {
        const matrix = calculateSurfaceApparentTraceAngles(safeDipDir, safeDipAmt, normDrive);
        const panelInfo =
          activePanel === 'face'
            ? matrix.face
            : activePanel === 'left_wall'
            ? matrix.leftWall
            : activePanel === 'right_wall'
            ? matrix.rightWall
            : matrix.crown;

        return (
          <div className="mt-1 pt-1.5 border-t border-slate-800/80 text-[10px] font-mono flex items-center justify-between">
            <span className="text-slate-400">
              {activePanel === 'face'
                ? 'Face Apparent Trace:'
                : activePanel === 'crown'
                ? 'Crown Roof Trace:'
                : 'Sidewall Trace:'}
            </span>
            <div className="flex items-center gap-1.5">
              <strong className="text-amber-300 font-bold">
                {activePanel === 'crown'
                  ? `STRIKE ${Math.round(matrix.strikeRhrDeg)}°`
                  : `${panelInfo.apparentDipDeg}°`}
              </strong>
              <span
                className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold ${
                  panelInfo.isTrueDip
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : panelInfo.isHorizontal
                    ? 'bg-slate-800 text-slate-300'
                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}
                title={panelInfo.geologicalNote}
              >
                {panelInfo.isTrueDip
                  ? 'True Dip'
                  : panelInfo.isHorizontal
                  ? 'Horizontal (0°)'
                  : 'Apparent Dip'}
              </span>
            </div>
          </div>
        );
      })()}
    </div>
  );
};


/**
 * Renders an ISRM / USGS Structural Feature (Fault, Thrust Fault, Shear Zone, Fold Axis, Contact, Overbreak)
 * with perpendicular Dip Direction tick and inline Dip Direction / Dip Amount readout.
 */
export const FieldStructuralFeatureSvgElement: React.FC<{
  feature: FieldStructuralFeature;
  colorMode?: 'bw' | 'color';
  tunnelDriveDirection?: number;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent<SVGGElement>) => void;
}> = ({
  feature,
  colorMode = 'bw',
  tunnelDriveDirection = 45,
  isSelected = false,
  onClick,
}) => {
  if (feature.points.length < 2) return null;
  const isLinear = feature.lineMode === 'linear';
  const d = isLinear
    ? feature.points
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ')
    : buildSmoothSvgPath(feature.points);

  const {
    mid,
    ux: tickUx,
    uy: tickUy,
    labelAngleDeg: deg,
  } = computeTraceScreenDipTickVector(
    feature.points,
    feature.panel,
    feature.dipDirection,
    tunnelDriveDirection
  );

  const isColor = colorMode === 'color';
  const isFaultLike =
    feature.featureType === 'fault' || feature.featureType === 'thrust_fault';
  const isFold = feature.featureType === 'fold_axis';

  const strokeCol = isSelected
    ? '#d97706'
    : isColor && isFaultLike
    ? '#b91c1c'
    : isColor && feature.featureType === 'shear_zone'
    ? '#9333ea'
    : isColor && isFold
    ? '#0284c7'
    : '#0f172a';

  const baseStrokeW = Math.max(
    1.2,
    Math.min(
      18,
      feature.strokeWidthPx ?? (isFaultLike ? 4.6 : 3.6)
    )
  );
  const symSizeScale = Math.max(0.4, Math.min(2.5, (feature.symbolSize ?? 100) / 100));
  const symDensityPct = Math.max(20, Math.min(220, feature.symbolDensity ?? 100));

  // Sample geological feature symbols along the path scaled by symbolDensity & symbolSize
  const baseTickStep = Math.max(16, 42 * (100 / symDensityPct));
  const tickPts: { x: number; y: number; nx: number; ny: number; tx: number; ty: number }[] = [];
  let accum = 0;
  for (let i = 1; i < feature.points.length; i++) {
    const a = feature.points[i - 1];
    const b = feature.points[i];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen < 1) continue;
    const tx = (b.x - a.x) / segLen;
    const ty = (b.y - a.y) / segLen;
    const nx = -ty;
    const ny = tx;
    let dAlong = baseTickStep * 0.45 - accum;
    while (dAlong <= segLen) {
      if (dAlong >= 0) {
        tickPts.push({
          x: a.x + tx * dAlong,
          y: a.y + ty * dAlong,
          nx,
          ny,
          tx,
          ty,
        });
      }
      dAlong += baseTickStep;
    }
    accum = (accum + segLen) % baseTickStep;
  }

  const tickLen = (feature.featureType === 'shear_zone' ? 20 : 16) * Math.sqrt(symSizeScale);
  const tickX = mid.x + tickUx * tickLen;
  const tickY = mid.y + tickUy * tickLen;

  // Fault sub-type & HW/FW calculation
  const faultTypeShort =
    feature.faultSubType === 'normal_fault'
      ? 'NF'
      : feature.faultSubType === 'reverse_fault'
      ? 'RF'
      : feature.faultSubType === 'thrust_fault'
      ? 'TF'
      : feature.faultSubType === 'strike_slip_fault'
      ? 'SSF'
      : feature.faultSubType === 'oblique_fault'
      ? 'OSF'
      : feature.faultSubType === 'shear_gouge'
      ? 'FGZ'
      : feature.featureType === 'thrust_fault'
      ? 'TF'
      : 'FLT';
  const faultRole = feature.faultElementRole || 'fault_complete';
  const hwSign = feature.flipHwFw ? -1 : 1;
  const hwUx = tickUx * hwSign;
  const hwUy = tickUy * hwSign;
  const fwUx = -hwUx;
  const fwUy = -hwUy;
  const hwOffset = 30 * Math.sqrt(symSizeScale);
  const hwPt = { x: mid.x + hwUx * hwOffset, y: mid.y + hwUy * hwOffset };
  const fwPt = { x: mid.x + fwUx * hwOffset, y: mid.y + fwUy * hwOffset };
  const isReverseOrThrust =
    feature.faultSubType === 'reverse_fault' ||
    feature.faultSubType === 'thrust_fault' ||
    feature.featureType === 'thrust_fault';

  // Fold sub-type & Axis / Limb / Crest calculation
  const foldTypeShort =
    feature.foldSubType === 'syncline'
      ? 'SYN'
      : feature.foldSubType === 'overturned_fold'
      ? 'OVF'
      : feature.foldSubType === 'chevron_fold'
      ? 'CHV'
      : feature.foldSubType === 'recumbent_fold'
      ? 'REC'
      : feature.foldSubType === 'isoclinal_fold'
      ? 'ISO'
      : 'ANT';
  const foldRole = feature.foldElementRole || 'fold_complete';
  const isSyncline = feature.foldSubType === 'syncline';
  const limbOffset = 28 * Math.sqrt(symSizeScale);
  const limb1Pt = { x: mid.x + tickUx * limbOffset, y: mid.y + tickUy * limbOffset };
  const limb2Pt = { x: mid.x - tickUx * limbOffset, y: mid.y - tickUy * limbOffset };

  const computedFeatureTitle = isFaultLike
    ? faultRole === 'hanging_wall'
      ? `HW (${faultTypeShort})`
      : faultRole === 'footwall'
      ? `FW (${faultTypeShort})`
      : faultRole === 'fault_plane'
      ? `FP (${faultTypeShort})`
      : `FP-${faultTypeShort}`
    : isFold
    ? foldRole === 'fold_limb'
      ? `Limb (${foldTypeShort})`
      : foldRole === 'fold_crest'
      ? `Crest (${foldTypeShort})`
      : foldRole === 'fold_axis'
      ? `FA (${foldTypeShort})`
      : `Fold-${foldTypeShort}`
    : feature.label;

  return (
    <g onClick={onClick} className={onClick ? 'cursor-pointer' : undefined}>
      {(feature.featureType === 'shear_zone' ||
        (isFaultLike && feature.faultSubType === 'shear_gouge')) && (
        <path
          d={d}
          fill="none"
          stroke={isColor ? '#f3e8ff' : '#cbd5e1'}
          strokeWidth={Math.max(10, 18 * symSizeScale)}
          strokeLinecap="round"
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={strokeCol}
        strokeWidth={isSelected ? baseStrokeW + 1.8 : baseStrokeW}
        strokeDasharray={
          feature.featureType === 'litho_contact'
            ? '10,6'
            : isFold && foldRole === 'fold_limb'
            ? '8,4'
            : isFold && foldRole === 'fold_crest'
            ? '4,4'
            : isFold
            ? '14,5,3,5'
            : feature.featureType === 'overbreak_cavity'
            ? '6,4'
            : isFaultLike && (faultRole === 'hanging_wall' || faultRole === 'footwall')
            ? '8,4'
            : undefined
        }
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Sawtooth / Structural ticks along Fault Plane scaled by symbolSize and symbolDensity */}
      {(isFaultLike || feature.featureType === 'overbreak_cavity') &&
        faultRole !== 'hanging_wall' &&
        faultRole !== 'footwall' &&
        tickPts.map((tp, idx) => {
          const h = (feature.featureType === 'fault' ? 8.5 : 10.5) * symSizeScale * hwSign;
          const w = (feature.featureType === 'fault' ? 5 : 6.5) * symSizeScale;
          return (
            <polygon
              key={idx}
              points={`${tp.x + tp.nx * h},${tp.y + tp.ny * h} ${tp.x - tp.tx * w},${tp.y - tp.ty * w} ${tp.x + tp.tx * w},${tp.y + tp.ty * w}`}
              fill={strokeCol}
            />
          );
        })}

      {/* Hanging Wall (HW) & Footwall (FW) Structural Block Denotation across Fault Plane */}
      {isFaultLike &&
        (faultRole === 'fault_complete' ||
          faultRole === 'hanging_wall' ||
          faultRole === 'footwall') &&
        feature.showHwFw !== false && (
          <g>
            {(faultRole === 'fault_complete' || faultRole === 'hanging_wall') && (
              <g
                transform={`translate(${
                  faultRole === 'hanging_wall' ? mid.x : hwPt.x
                }, ${faultRole === 'hanging_wall' ? mid.y - 18 : hwPt.y})`}
              >
                <rect
                  x="-24"
                  y="-10"
                  width="48"
                  height="19"
                  rx="4"
                  fill={isColor ? '#fef2f2' : '#ffffff'}
                  stroke={strokeCol}
                  strokeWidth="1.8"
                />
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="900"
                  fontFamily="IBM Plex Mono, monospace"
                  fill={strokeCol}
                >
                  HW {isReverseOrThrust ? '▲' : '▼'}
                </text>
              </g>
            )}
            {(faultRole === 'fault_complete' || faultRole === 'footwall') && (
              <g
                transform={`translate(${
                  faultRole === 'footwall' ? mid.x : fwPt.x
                }, ${faultRole === 'footwall' ? mid.y - 18 : fwPt.y})`}
              >
                <rect
                  x="-24"
                  y="-10"
                  width="48"
                  height="19"
                  rx="4"
                  fill={isColor ? '#f0fdf4' : '#ffffff'}
                  stroke="#0f172a"
                  strokeWidth="1.8"
                />
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="900"
                  fontFamily="IBM Plex Mono, monospace"
                  fill="#0f172a"
                >
                  FW {isReverseOrThrust ? '▼' : '▲'}
                </text>
              </g>
            )}
          </g>
        )}

      {feature.featureType === 'shear_zone' &&
        tickPts.map((tp, idx) => {
          const sx = 6 * symSizeScale;
          const sy = 5 * symSizeScale;
          return (
            <line
              key={idx}
              x1={tp.x - tp.nx * sy - tp.tx * sx}
              y1={tp.y - tp.ny * sy - tp.ty * sx}
              x2={tp.x + tp.nx * sy + tp.tx * sx}
              y2={tp.y + tp.ny * sy + tp.ty * sx}
              stroke={strokeCol}
              strokeWidth={Math.max(1.5, baseStrokeW * 0.55)}
            />
          );
        })}

      {/* Fold Axis, Fold Limb & Fold Crest Symbols */}
      {isFold &&
        tickPts.map((tp, idx) => {
          const aLen = 10 * symSizeScale;
          const aHead = 4 * symSizeScale;
          if (foldRole === 'fold_crest') {
            return (
              <path
                key={idx}
                d={`M ${tp.x - tp.tx * 7} ${tp.y - tp.ty * 7} Q ${tp.x + tp.nx * 9 * symSizeScale} ${tp.y + tp.ny * 9 * symSizeScale}, ${tp.x + tp.tx * 7} ${tp.y + tp.ty * 7}`}
                fill="none"
                stroke={strokeCol}
                strokeWidth="2"
              />
            );
          }
          if (foldRole === 'fold_limb') {
            return (
              <line
                key={idx}
                x1={tp.x}
                y1={tp.y}
                x2={tp.x + tp.nx * 8 * symSizeScale}
                y2={tp.y + tp.ny * 8 * symSizeScale}
                stroke={strokeCol}
                strokeWidth="2"
              />
            );
          }
          return (
            <g key={idx}>
              <line
                x1={tp.x - tp.nx * aLen}
                y1={tp.y - tp.ny * aLen}
                x2={tp.x + tp.nx * aLen}
                y2={tp.y + tp.ny * aLen}
                stroke={strokeCol}
                strokeWidth={Math.max(1.4, baseStrokeW * 0.5)}
              />
              {isSyncline ? (
                <>
                  <polygon
                    points={`${tp.x + tp.nx * 2},${tp.y + tp.ny * 2} ${tp.x + tp.nx * (2 + aHead) - tp.tx * aHead},${tp.y + tp.ny * (2 + aHead) - tp.ty * aHead} ${tp.x + tp.nx * (2 + aHead) + tp.tx * aHead},${tp.y + tp.ny * (2 + aHead) + tp.ty * aHead}`}
                    fill={strokeCol}
                  />
                  <polygon
                    points={`${tp.x - tp.nx * 2},${tp.y - tp.ny * 2} ${tp.x - tp.nx * (2 + aHead) - tp.tx * aHead},${tp.y - tp.ny * (2 + aHead) - tp.ty * aHead} ${tp.x - tp.nx * (2 + aHead) + tp.tx * aHead},${tp.y - tp.ny * (2 + aHead) + tp.ty * aHead}`}
                    fill={strokeCol}
                  />
                </>
              ) : (
                <>
                  <polygon
                    points={`${tp.x + tp.nx * (aLen + aHead)},${tp.y + tp.ny * (aLen + aHead)} ${tp.x + tp.nx * (aLen - 1) - tp.tx * aHead},${tp.y + tp.ny * (aLen - 1) - tp.ty * aHead} ${tp.x + tp.nx * (aLen - 1) + tp.tx * aHead},${tp.y + tp.ny * (aLen - 1) + tp.ty * aHead}`}
                    fill={strokeCol}
                  />
                  <polygon
                    points={`${tp.x - tp.nx * (aLen + aHead)},${tp.y - tp.ny * (aLen + aHead)} ${tp.x - tp.nx * (aLen - 1) - tp.tx * aHead},${tp.y - tp.ny * (aLen - 1) - tp.ty * aHead} ${tp.x - tp.nx * (aLen - 1) + tp.tx * aHead},${tp.y - tp.ny * (aLen - 1) + tp.ty * aHead}`}
                    fill={strokeCol}
                  />
                </>
              )}
            </g>
          );
        })}

      {/* Fold Crest (CR) & Opposing Limbs (L1 / L2) Badges when Fold Complete is active */}
      {isFold && foldRole === 'fold_complete' && (
        <g>
          {feature.showFoldCrest !== false && (
            <g transform={`translate(${mid.x}, ${mid.y + 18 * symSizeScale})`}>
              <rect
                x="-28"
                y="-9"
                width="56"
                height="17"
                rx="4"
                fill={isColor ? '#e0f2fe' : '#ffffff'}
                stroke={strokeCol}
                strokeWidth="1.6"
              />
              <text
                x="0"
                y="3"
                textAnchor="middle"
                fontSize="10.5"
                fontWeight="900"
                fontFamily="IBM Plex Mono, monospace"
                fill={strokeCol}
              >
                ⌒ CREST
              </text>
            </g>
          )}
          {feature.showFoldLimbs !== false && (
            <>
              <g transform={`translate(${limb1Pt.x}, ${limb1Pt.y})`}>
                <rect
                  x="-23"
                  y="-9"
                  width="46"
                  height="17"
                  rx="4"
                  fill={isColor ? '#f0f9ff' : '#ffffff'}
                  stroke={strokeCol}
                  strokeWidth="1.5"
                />
                <text
                  x="0"
                  y="3"
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="900"
                  fontFamily="IBM Plex Mono, monospace"
                  fill={strokeCol}
                >
                  LIMB 1
                </text>
              </g>
              <g transform={`translate(${limb2Pt.x}, ${limb2Pt.y})`}>
                <rect
                  x="-23"
                  y="-9"
                  width="46"
                  height="17"
                  rx="4"
                  fill={isColor ? '#f0f9ff' : '#ffffff'}
                  stroke={strokeCol}
                  strokeWidth="1.5"
                />
                <text
                  x="0"
                  y="3"
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="900"
                  fontFamily="IBM Plex Mono, monospace"
                  fill={strokeCol}
                >
                  LIMB 2
                </text>
              </g>
            </>
          )}
        </g>
      )}

      {feature.featureType === 'litho_contact' &&
        tickPts.map((tp, idx) => {
          const cLen = 5.5 * symSizeScale;
          return (
            <line
              key={idx}
              x1={tp.x}
              y1={tp.y}
              x2={tp.x + tp.nx * cLen}
              y2={tp.y + tp.ny * cLen}
              stroke={strokeCol}
              strokeWidth={Math.max(1.3, baseStrokeW * 0.5)}
            />
          );
        })}

      {/* Perpendicular Dip Direction Tick & Tip Dot at Midpoint */}
      <line
        x1={mid.x}
        y1={mid.y}
        x2={tickX}
        y2={tickY}
        stroke={strokeCol}
        strokeWidth="2.8"
      />
      <circle cx={tickX} cy={tickY} r={2.6 * Math.sqrt(symSizeScale)} fill={strokeCol} />

      {/* Clean inline structural label along feature showing Dip Direction & Dip Amount */}
      <g transform={`translate(${mid.x}, ${mid.y - 12 * symSizeScale}) rotate(${deg.toFixed(1)})`}>
        <text
          x="0"
          y="0"
          textAnchor="middle"
          fontSize="14.5"
          fontWeight="900"
          fontFamily="Arial, sans-serif"
          fill={strokeCol}
          stroke="#ffffff"
          strokeWidth="3.6"
          paintOrder="stroke"
        >
          {computedFeatureTitle} {String(feature.dipDirection).padStart(3, '0')}°/
          {feature.dipAmount}°
        </text>
      </g>
    </g>
  );
};

/**
 * Dedicated ISRM / Engineering Geology Hydrogeological Symbol Glyph for each of the 6 Groundwater Conditions:
 * - 'Dry': Crossed-out dry circle (Ø) with radiating dry ticks (no moisture)
 * - 'Damp': Moist dark stain patch with double wavy capillary vapor lines & fine stipple dots (no free drops)
 * - 'Wet': Continuous wet surface film meniscus bar with surface sheen arc & 3 resting film beads
 * - 'Dripping': Overhanging rock joint ledge with 3 staggered falling teardrops + downward drip arrows & splash ring
 * - 'Flowing': Spring discharge orifice (○~) with 3 continuous sinusoidal flowing stream waves & flow arrowheads
 * - 'High Pressure': Pressurized fracture nozzle diamond/burst with 3 high-velocity radiating water jet arrows & pressure arcs
 */
export const FieldWaterConditionGlyph: React.FC<{
  condition: FieldWaterCondition;
  colorMode?: 'bw' | 'color';
}> = ({ condition, colorMode = 'color' }) => {
  const isColor = colorMode === 'color';

  if (condition === 'Dry') {
    const strokeCol = isColor ? '#b45309' : '#0f172a';
    const fillCol = isColor ? '#fef3c7' : '#ffffff';
    return (
      <g>
        <circle
          cx="0"
          cy="0"
          r="11"
          fill={fillCol}
          stroke={strokeCol}
          strokeWidth="2.2"
          strokeDasharray="4,2.5"
        />
        {/* Diagonal dry strike-through (Ø) */}
        <line
          x1="-8.5"
          y1="8.5"
          x2="8.5"
          y2="-8.5"
          stroke={strokeCol}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {/* Radiating dry surface ticks */}
        <line x1="0" y1="-15" x2="0" y2="-12" stroke={strokeCol} strokeWidth="1.8" />
        <line x1="0" y1="12" x2="0" y2="15" stroke={strokeCol} strokeWidth="1.8" />
        <line x1="-15" y1="0" x2="-12" y2="0" stroke={strokeCol} strokeWidth="1.8" />
        <line x1="12" y1="0" x2="15" y2="0" stroke={strokeCol} strokeWidth="1.8" />
      </g>
    );
  }

  if (condition === 'Damp') {
    const strokeCol = isColor ? '#0d9488' : '#0f172a';
    const fillCol = isColor ? 'rgba(204, 251, 241, 0.85)' : '#ffffff';
    return (
      <g>
        {/* Damp stain boundary ellipse */}
        <ellipse
          cx="0"
          cy="0"
          rx="15"
          ry="10"
          fill={fillCol}
          stroke={strokeCol}
          strokeWidth="2"
          strokeDasharray="3,2"
        />
        {/* Double wavy moisture / capillary stain lines (≈) */}
        <path
          d="M -10 -3 Q -5 -6, 0 -3 T 10 -3"
          fill="none"
          stroke={strokeCol}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M -10 3 Q -5 0, 0 3 T 10 3"
          fill="none"
          stroke={strokeCol}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Fine damp pore stipple dots */}
        <circle cx="-6" cy="-6.5" r="1.3" fill={strokeCol} />
        <circle cx="5" cy="-6.5" r="1.3" fill={strokeCol} />
        <circle cx="-4" cy="6.8" r="1.3" fill={strokeCol} />
        <circle cx="6" cy="6.8" r="1.3" fill={strokeCol} />
      </g>
    );
  }

  if (condition === 'Wet') {
    const strokeCol = isColor ? '#0284c7' : '#0f172a';
    const fillCol = isColor ? '#bae6fd' : '#ffffff';
    return (
      <g>
        {/* Rock discontinuity plane baseline */}
        <line
          x1="-15"
          y1="6"
          x2="15"
          y2="6"
          stroke={strokeCol}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        {/* Wet film meniscus layer & sheen */}
        <path
          d="M -13 6 C -10 -3, 10 -3, 13 6 Z"
          fill={fillCol}
          stroke={strokeCol}
          strokeWidth="2"
        />
        {/* 3 resting surface film beads along the wet plane */}
        <path
          d="M -9 6 A 3.2 3.2 0 0 1 -2.6 6 Z"
          fill={strokeCol}
        />
        <path
          d="M -3.2 6 A 3.6 3.6 0 0 1 3.2 6 Z"
          fill={strokeCol}
        />
        <path
          d="M 2.6 6 A 3.2 3.2 0 0 1 9 6 Z"
          fill={strokeCol}
        />
        {/* Parallel wet film underline */}
        <line
          x1="-12"
          y1="10"
          x2="12"
          y2="10"
          stroke={strokeCol}
          strokeWidth="1.8"
          strokeDasharray="4,2"
        />
      </g>
    );
  }

  if (condition === 'Dripping') {
    const strokeCol = isColor ? '#2563eb' : '#0f172a';
    const fillCol = isColor ? '#93c5fd' : '#ffffff';
    return (
      <g>
        {/* Top overhanging fracture ledge */}
        <line
          x1="-14"
          y1="-12"
          x2="14"
          y2="-12"
          stroke={strokeCol}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        {/* 3 Staggered Falling Water Drops */}
        <path
          d="M -8 -9 C -6 -5, -4.5 -2, -4.5 0.5 A 3.5 3.5 0 1 1 -11.5 0.5 C -11.5 -2, -10 -5, -8 -9 Z"
          fill={fillCol}
          stroke={strokeCol}
          strokeWidth="1.8"
        />
        <path
          d="M 0 -5 C 2 -1, 3.8 2, 3.8 4.8 A 3.8 3.8 0 1 1 -3.8 4.8 C -3.8 2, -2 -1, 0 -5 Z"
          fill={fillCol}
          stroke={strokeCol}
          strokeWidth="1.8"
        />
        <path
          d="M 8 -9 C 10 -5, 11.5 -2, 11.5 0.5 A 3.5 3.5 0 1 1 4.5 0.5 C 4.5 -2, 6 -5, 8 -9 Z"
          fill={fillCol}
          stroke={strokeCol}
          strokeWidth="1.8"
        />
        {/* Downward drip impact arrows & splash ring at bottom */}
        <line x1="0" y1="9" x2="0" y2="14" stroke={strokeCol} strokeWidth="1.8" />
        <ellipse
          cx="0"
          cy="14.5"
          rx="9"
          ry="2.5"
          fill="none"
          stroke={strokeCol}
          strokeWidth="1.6"
        />
      </g>
    );
  }

  if (condition === 'Flowing') {
    const strokeCol = isColor ? '#1d4ed8' : '#0f172a';
    const fillCol = isColor ? '#dbeafe' : '#ffffff';
    return (
      <g>
        {/* Hydrogeological spring / inflow source circle on left */}
        <circle
          cx="-11"
          cy="0"
          r="4.5"
          fill={fillCol}
          stroke={strokeCol}
          strokeWidth="2.2"
        />
        {/* 3 Continuous Flowing Sinusoidal Stream Waves with Arrowheads */}
        <path
          d="M -6 -6 Q -1 -11, 4 -6 T 14 -6"
          fill="none"
          stroke={strokeCol}
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        <polygon points="17,-6 12,-9 12,-3" fill={strokeCol} />

        <path
          d="M -6 0 Q -1 -5, 4 0 T 14 0"
          fill="none"
          stroke={strokeCol}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <polygon points="18,0 13,-3 13,3" fill={strokeCol} />

        <path
          d="M -6 6 Q -1 1, 4 6 T 14 6"
          fill="none"
          stroke={strokeCol}
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        <polygon points="17,6 12,3 12,9" fill={strokeCol} />
      </g>
    );
  }

  // 'High Pressure': Pressurized Water Inflow / Gusher Jet Symbol
  const nozzleCol = isColor ? '#dc2626' : '#0f172a';
  const jetCol = isColor ? '#0284c7' : '#0f172a';
  const fillCol = isColor ? '#fee2e2' : '#ffffff';
  return (
    <g>
      {/* Pressurized fracture diamond burst origin */}
      <polygon
        points="-14,0 -8,-7 -2,0 -8,7"
        fill={fillCol}
        stroke={nozzleCol}
        strokeWidth="2.2"
      />
      {/* 3 Radiating High-Velocity Pressurized Water Jets */}
      <line x1="-2" y1="-2" x2="15" y2="-11" stroke={jetCol} strokeWidth="2.5" />
      <polygon points="18,-13 11,-12 14,-7" fill={jetCol} />

      <line x1="-2" y1="0" x2="17" y2="0" stroke={jetCol} strokeWidth="2.8" />
      <polygon points="20,0 13,-3.5 13,3.5" fill={jetCol} />

      <line x1="-2" y1="2" x2="15" y2="11" stroke={jetCol} strokeWidth="2.5" />
      <polygon points="18,13 14,7 11,12" fill={jetCol} />

      {/* High-pressure shock wave arc */}
      <path
        d="M 5 -10 A 13 13 0 0 1 5 10"
        fill="none"
        stroke={nozzleCol}
        strokeWidth="1.9"
        strokeDasharray="2.5,2"
      />
    </g>
  );
};

export const FieldWaterSymbolPreviewSvg: React.FC<{
  condition: FieldWaterCondition;
  colorMode?: 'bw' | 'color';
}> = ({ condition, colorMode = 'color' }) => (
  <svg
    viewBox="-22 -18 44 36"
    className="w-11 h-8 rounded bg-white border border-slate-400 shrink-0"
  >
    <FieldWaterConditionGlyph condition={condition} colorMode={colorMode} />
  </svg>
);

/**
 * Renders ISRM Standard Hydrogeological Water / Seepage Symbol on Canvas & Sheet
 * Uses a dedicated symbol for each condition (Dry, Damp, Wet, Dripping, Flowing, High Pressure).
 */
export const FieldWaterSymbolSvgElement: React.FC<{
  mark: FieldWaterMark;
  colorMode?: 'bw' | 'color';
  scale?: number;
}> = ({ mark, colorMode = 'color', scale = 1 }) => {
  if (mark.points.length === 0) return null;
  const isColor = colorMode === 'color';
  const strokeCol =
    !isColor
      ? '#0f172a'
      : mark.condition === 'Dry'
      ? '#b45309'
      : mark.condition === 'Damp'
      ? '#0d9488'
      : mark.condition === 'Wet'
      ? '#0284c7'
      : mark.condition === 'Dripping'
      ? '#2563eb'
      : mark.condition === 'Flowing'
      ? '#1d4ed8'
      : '#dc2626';

  const midPt = mark.points[Math.floor(mark.points.length / 2)] || mark.points[0];
  const hasTrace =
    mark.points.length >= 2 &&
    Math.hypot(
      mark.points[mark.points.length - 1].x - mark.points[0].x,
      mark.points[mark.points.length - 1].y - mark.points[0].y
    ) > 12;

  return (
    <g>
      {/* If user dragged across a seepage zone / joint, render condition-specific seepage path */}
      {hasTrace && (
        <path
          d={buildSmoothSvgPath(mark.points)}
          fill="none"
          stroke={strokeCol}
          strokeWidth={mark.condition === 'Flowing' || mark.condition === 'High Pressure' ? 3.5 : 2.5}
          strokeDasharray={
            mark.condition === 'Dry'
              ? '6,4'
              : mark.condition === 'Damp'
              ? '2,4'
              : mark.condition === 'Wet'
              ? '10,3'
              : mark.condition === 'Dripping'
              ? '4,5'
              : undefined
          }
          strokeLinecap="round"
        />
      )}

      <g transform={`translate(${midPt.x}, ${midPt.y}) scale(${scale})`}>
        <FieldWaterConditionGlyph condition={mark.condition} colorMode={colorMode} />
        <text
          x="21"
          y="4"
          fontSize="12"
          fontWeight="900"
          fontFamily="IBM Plex Mono, monospace"
          fill={strokeCol}
          stroke="#ffffff"
          strokeWidth="3.5"
          paintOrder="stroke"
        >
          {mark.condition.toUpperCase()}
        </text>
      </g>
    </g>
  );
};

/**
 * Renders a Dip Plane Surface with a closed geological polygon outline and Dip Direction / Dip Amount inside
 */
export const FieldDipSurfaceSvgElement: React.FC<{
  surface: FieldDipPlaneSurface;
  isSelected?: boolean;
  colorMode?: 'bw' | 'color';
  patternPrefix?: string;
  onClick?: () => void;
}> = ({
  surface,
  isSelected = false,
  colorMode = 'bw',
  patternPrefix = 'fpat',
  onClick,
}) => {
  if (surface.points.length === 0) return null;
  const { outlinePolygon, centroid } =
    surface.outlinePolygon && surface.outlinePolygon.length >= 3
      ? {
          outlinePolygon: surface.outlinePolygon,
          centroid: {
            x:
              surface.outlinePolygon.reduce((s, p) => s + p.x, 0) /
              surface.outlinePolygon.length,
            y:
              surface.outlinePolygon.reduce((s, p) => s + p.y, 0) /
              surface.outlinePolygon.length,
          },
        }
      : buildDipSurfaceOutlineAndCentroid(surface.points, surface.brushRadius);

  const outlinePath =
    outlinePolygon.length >= 3
      ? outlinePolygon
          .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(' ') + ' Z'
      : '';

  const groupColor =
    colorMode === 'bw' && surface.setId !== 'unassigned'
      ? '#0f172a'
      : FIELD_JOINT_GROUP_COLORS[surface.setId]?.stroke || '#0f172a';

  const setPrefix = surface.setId === 'unassigned' ? '' : `${surface.setId} `;
  const dipRad = ((surface.dipDirection - 90) * Math.PI) / 180;
  const arrowX = centroid.x + 14 * Math.cos(dipRad);
  const arrowY = centroid.y - 8 + 14 * Math.sin(dipRad);

  return (
    <g onClick={onClick} className={onClick ? 'cursor-pointer' : undefined}>
      {outlinePath ? (
        <>
          <path
            d={outlinePath}
            fill={colorMode === 'bw' ? 'rgba(255,255,255,0.75)' : `${groupColor}18`}
            stroke="none"
          />
          <path
            d={outlinePath}
            fill={`url(#${patternPrefix}-dip-plane)`}
            stroke={isSelected ? '#d97706' : groupColor}
            strokeWidth={isSelected ? 3.5 : 2.2}
            strokeDasharray="6,3"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <circle
          cx={centroid.x}
          cy={centroid.y}
          r={surface.brushRadius}
          fill={`url(#${patternPrefix}-dip-plane)`}
          stroke={isSelected ? '#d97706' : groupColor}
          strokeWidth="2.2"
          strokeDasharray="6,3"
        />
      )}
      {/* Dip facet orientation symbol & clean interior text (NO bulky box) */}
      <circle cx={centroid.x} cy={centroid.y - 8} r="3" fill={groupColor} />
      <line
        x1={centroid.x}
        y1={centroid.y - 8}
        x2={arrowX}
        y2={arrowY}
        stroke={groupColor}
        strokeWidth="2"
      />
      <text
        x={centroid.x}
        y={centroid.y + 8}
        textAnchor="middle"
        fontSize="12"
        fontWeight="bold"
        fontFamily="monospace"
        fill={groupColor}
        stroke="#ffffff"
        strokeWidth="3.5"
        paintOrder="stroke"
      >
        {setPrefix}
        {String(surface.dipDirection).padStart(3, '0')}°/{surface.dipAmount}°
      </text>
    </g>
  );
};

export function computeUnfoldedStripBoxes(
  location: FieldTunnelLocationItem,
  round: FieldExcavationRound,
  topStripOnly = false
) {
  const faceGeom = computePanelCanvasGeometry('face', location, round);
  const crownGeom = computePanelCanvasGeometry('crown', location, round);
  const leftWallGeom = computePanelCanvasGeometry('left_wall', location, round);
  const rightWallGeom = computePanelCanvasGeometry('right_wall', location, round);

  const splHeightM = faceGeom.splHeightM;
  const leftWallLengthM = faceGeom.leftWallLengthM || splHeightM;
  const rightWallLengthM = faceGeom.rightWallLengthM || splHeightM;
  const splRatio = faceGeom.splRatio;
  const crownLengthM = faceGeom.crownLengthM;
  const pullM = faceGeom.pullM;

  // Authoritative Continuous CAD Strip (Matches the 5 Engineering Reference Sheets):
  // - One continuous horizontal rectangle with ZERO gap between [ Left Wall | Crown | Right Wall ]
  // - Horizontal X-axis = Developed Perimeter Length: L_left + L_crown + L_right
  // - Vertical Y-axis = Pull Length (pullM) uniform across all 3 panels
  // - True 1:1 Isotropic Scale (1m on X-axis === 1m on Y-axis)
  const totalAvailW = topStripOnly ? 870 : 870;
  const maxAvailH = topStripOnly ? 260 : 145;
  const pullSpanM = Math.max(0.5, pullM);
  const leftSpanM = faceGeom.hasLeftWall ? Math.max(0.5, leftWallLengthM) : 0;
  const crownSpanM = faceGeom.hasCrown ? Math.max(0.5, crownLengthM) : 0;
  const rightSpanM = faceGeom.hasRightWall ? Math.max(0.5, rightWallLengthM) : 0;
  const totalStripMetersW = Math.max(1, leftSpanM + crownSpanM + rightSpanM);
  const maxStripMetersH = pullSpanM;

  const stripPxPerMeter = Math.min(
    totalAvailW / totalStripMetersW,
    maxAvailH / Math.max(0.5, maxStripMetersH)
  );

  const stripLeftWallW = Number((leftSpanM * stripPxPerMeter).toFixed(1));
  const stripCrownW = Number((crownSpanM * stripPxPerMeter).toFixed(1));
  const stripRightWallW = Number((rightSpanM * stripPxPerMeter).toFixed(1));
  const stripWallW = stripLeftWallW;
  const stripH = Number((pullSpanM * stripPxPerMeter).toFixed(1));
  const stripWallH = stripH;
  const stripCrownH = stripH;
  const stripLeftWallH = stripH;
  const stripRightWallH = stripH;

  const totalRenderedW = stripLeftWallW + stripCrownW + stripRightWallW;
  const leftWallX = Number(((920 - totalRenderedW) / 2).toFixed(1));
  const crownX = Number((leftWallX + stripLeftWallW).toFixed(1));
  const rightWallX = Number((crownX + stripCrownW).toFixed(1));

  // Give primary visual importance to the Tunnel Face Picture on Page 1 (large & adapted to tunnel shape & W:H ratio)
  // Generous margin around the tunnel outline:
  // - Top margin (strip to face outline) so crown overbreak line markings have clear headroom below top strip
  // - Left & right side margins (at least 200px on both sides) for left and right wall overbreak line markings and height rulers
  const maxFaceWidth = 510;
  const maxFaceHeight = 270;
  const facePxPerMeter = Math.min(
    maxFaceWidth / Math.max(1, faceGeom.tunnelW),
    maxFaceHeight / Math.max(1, faceGeom.tunnelH)
  );
  const idealFaceW = Number((faceGeom.tunnelW * facePxPerMeter).toFixed(1));
  const idealFaceH = Number((faceGeom.tunnelH * facePxPerMeter).toFixed(1));
  const stripY = topStripOnly ? 38 : 24;
  // Generous gap between top continuous unfolded strip and face tunnel outline (165px)
  // providing 24px clearance below top strip for section title and 141px headroom above crown arch for overbreak lines & markings
  const faceTopY = topStripOnly ? 24 : Math.round(stripY + stripH + 165);
  const stripViewBoxH = topStripOnly ? Math.max(210, Math.round(stripY + stripH + 42)) : 790;

  return {
    faceGeom,
    crownGeom,
    leftWallGeom,
    rightWallGeom,
    splHeightM,
    leftWallLengthM,
    rightWallLengthM,
    splRatio,
    crownLengthM,
    pullM,
    stripPxPerMeter,
    stripWallW,
    stripLeftWallW,
    stripRightWallW,
    stripCrownW,
    totalRenderedW,
    stripWallH,
    stripLeftWallH,
    stripRightWallH,
    stripCrownH,
    leftWallX,
    crownX,
    rightWallX,
    faceTopY,
    idealFaceW,
    idealFaceH,
    stripY,
    stripH,
    stripViewBoxH,
  };
}

/**
 * Renders the combined Unfolded Geological Sketch (Left Wall | Crown | Right Wall + Tunnel Face)
 * in either Colourful ('color') or Monochrome Black & White ('bw') mode for Page 1 of the 2-Page Sheet,
 * OR renders ONLY the Top Portion (Left Wall | Crown | Right Wall) when topStripOnly={true}.
 */
export const FieldUnfoldedMonochromeSketchSvg: React.FC<{
  location: FieldTunnelLocationItem;
  round: FieldExcavationRound;
  rememberedRocks?: FieldRememberedRockItem[];
  colorMode?: 'color' | 'bw';
  topStripOnly?: boolean;
  customViewBox?: string;
  interactiveOverlay?: React.ReactNode;
  onSvgPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onSvgPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onSvgPointerUp?: (e: React.PointerEvent<SVGSVGElement>) => void;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}> = ({
  location,
  round,
  rememberedRocks = [],
  colorMode = 'color',
  topStripOnly = false,
  customViewBox,
  interactiveOverlay,
  onSvgPointerDown,
  onSvgPointerMove,
  onSvgPointerUp,
  svgRef,
}) => {
  const renderPanelContent = (
    panel: FieldPanelId,
    offsetX: number,
    offsetY: number,
    scaleX: number,
    scaleY: number,
    clipId: string,
    useContinuousCadMapping = false,
    targetBoxX = 0,
    targetBoxY = 0,
    targetBoxW = 100,
    targetBoxH = 100,
    panelGeom?: { boxX: number; boxY: number; boxW: number; boxH: number }
  ) => {
    const mapPt = (pt: FieldPoint2D): FieldPoint2D => {
      if (!useContinuousCadMapping || !panelGeom) return pt;
      const u = Math.max(
        0.002,
        Math.min(0.998, (pt.x - panelGeom.boxX) / Math.max(1, panelGeom.boxW))
      );
      const v = Math.max(
        0.002,
        Math.min(0.998, (pt.y - panelGeom.boxY) / Math.max(1, panelGeom.boxH))
      );
      if (panel === 'left_wall') {
        // Horizontal X = Invert floor (v=1 -> sx=0) to Left Springline (v=0 -> sx=1)
        // Vertical Y = Face (u=1 -> sy=0 at top) to Start of Pull (u=0 -> sy=1 at bottom)
        const sx = 1 - v;
        const sy = 1 - u;
        return {
          x: Number((targetBoxX + sx * targetBoxW).toFixed(1)),
          y: Number((targetBoxY + sy * targetBoxH).toFixed(1)),
        };
      }
      if (panel === 'crown') {
        // Horizontal X = Left Springline (u=0 -> sx=0) to Right Springline (u=1 -> sx=1)
        // Vertical Y = Face (v=0 -> sy=0 at top) to Start of Pull (v=1 -> sy=1 at bottom)
        const sx = u;
        const sy = v;
        return {
          x: Number((targetBoxX + sx * targetBoxW).toFixed(1)),
          y: Number((targetBoxY + sy * targetBoxH).toFixed(1)),
        };
      }
      if (panel === 'right_wall') {
        // Horizontal X = Right Springline (v=0 -> sx=0) to Right Invert floor (v=1 -> sx=1)
        // Vertical Y = Face (u=0 -> sy=0 at top) to Start of Pull (u=1 -> sy=1 at bottom)
        const sx = v;
        const sy = u;
        return {
          x: Number((targetBoxX + sx * targetBoxW).toFixed(1)),
          y: Number((targetBoxY + sy * targetBoxH).toFixed(1)),
        };
      }
      return pt;
    };

    const scaleRadius = useContinuousCadMapping && panelGeom
      ? Math.min(targetBoxW / Math.max(1, panelGeom.boxH), targetBoxH / Math.max(1, panelGeom.boxW))
      : 1;

    const strokes = round.lithologyStrokes
      .filter((s) => s.panel === panel)
      .map((s) => {
        const rawStrokePoly =
          s.polygon && s.polygon.length >= 3 ? s.polygon : s.points;
        const isStrokeClosed =
          Boolean(s.isClosed) ||
          Boolean(s.polygon && s.polygon.length >= 3) ||
          (rawStrokePoly.length >= 3 &&
            Math.hypot(
              rawStrokePoly[0].x - rawStrokePoly[rawStrokePoly.length - 1].x,
              rawStrokePoly[0].y - rawStrokePoly[rawStrokePoly.length - 1].y
            ) <= Math.max(48, (s.brushRadius || 24) * 1.8));
        return useContinuousCadMapping
          ? {
              ...s,
              isClosed: isStrokeClosed,
              points: s.points.map(mapPt),
              polygon: s.polygon ? s.polygon.map(mapPt) : undefined,
              brushRadius: Math.max(2, Number((s.brushRadius * scaleRadius).toFixed(1))),
              bandThicknessPx: s.bandThicknessPx
                ? Math.max(4, Number((s.bandThicknessPx * scaleRadius).toFixed(1)))
                : undefined,
            }
          : {
              ...s,
              isClosed: isStrokeClosed,
            };
      });
    const planes = round.dipPlaneSurfaces
      .filter((p) => p.panel === panel)
      .map((p) => {
        const baseOutline =
          p.outlinePolygon && p.outlinePolygon.length >= 3
            ? p.outlinePolygon
            : buildDipSurfaceOutlineAndCentroid(p.points, p.brushRadius).outlinePolygon;
        return useContinuousCadMapping
          ? {
              ...p,
              points: p.points.map(mapPt),
              outlinePolygon: baseOutline.map(mapPt),
              brushRadius: Math.max(4, Number((p.brushRadius * scaleRadius).toFixed(1))),
            }
          : {
              ...p,
              outlinePolygon: baseOutline,
            };
      });
    const features = (round.structuralFeatures || [])
      .filter((f) => f.panel === panel)
      .map((f) => (useContinuousCadMapping ? { ...f, points: f.points.map(mapPt) } : f));
    const directTraces = round.jointTraces
      .filter((t) => t.panel === panel)
      .map((t) => {
        if (!useContinuousCadMapping) return t;
        if (t.metricPoints && t.metricPoints.length >= 2) {
          const pullLengthM = round.pullLengthMeters || 3.5;
          const wallHeightM = location.wallHeightM || location.heightM * 0.58;
          const widthM = location.widthM;
          const mappedPoints = t.metricPoints.map((mp) => {
            let sx = 0;
            let sy = 0;
            if (panel === 'left_wall') {
              sx = Math.max(0, Math.min(1, mp.y / wallHeightM));
              sy = Math.max(0, Math.min(1, (pullLengthM - mp.x) / pullLengthM));
            } else if (panel === 'crown') {
              sx = Math.max(0, Math.min(1, mp.x / widthM));
              sy = Math.max(0, Math.min(1, (pullLengthM - mp.y) / pullLengthM));
            } else if (panel === 'right_wall') {
              sx = Math.max(0, Math.min(1, (wallHeightM - mp.y) / wallHeightM));
              sy = Math.max(0, Math.min(1, (pullLengthM - mp.x) / pullLengthM));
            }
            return {
              x: Number((targetBoxX + sx * targetBoxW).toFixed(1)),
              y: Number((targetBoxY + sy * targetBoxH).toFixed(1)),
            };
          });
          return { ...t, points: mappedPoints };
        }
        return { ...t, points: t.points.map(mapPt) };
      });

    const projectedFaceTraces: FieldJointTrace[] = [];
    if (
      useContinuousCadMapping &&
      (panel === 'left_wall' || panel === 'crown' || panel === 'right_wall') &&
      panelGeom
    ) {
      const faceTraces = round.jointTraces.filter(
        (t) => t.panel === 'face' && t.points && t.points.length >= 2
      );
      const spatialGeom: TunnelSpatialGeometry = {
        widthM: location.widthM,
        heightM: location.heightM,
        wallHeightM: location.wallHeightM || location.heightM * 0.58,
        pullLengthM: round.pullLengthMeters || 3.5,
        driveAzimuthDeg: round.tunnelDriveDirection || 0,
      };
      for (const ft of faceTraces) {
        if (typeof ft.dipDirection !== 'number' || typeof ft.dipAmount !== 'number') continue;
        const anchor = deriveAnchorPointFromPoints(ft.points, 'face', spatialGeom);
        const plane = constructJointPlane(
          ft.dipDirection,
          ft.dipAmount,
          anchor,
          spatialGeom.driveAzimuthDeg
        );
        const inter = calculatePlaneSurfaceIntersections(plane, spatialGeom, 'face');

        let seg:
          | { p1: { x: number; y: number }; p2: { x: number; y: number }; lengthM: number }
          | undefined;
        let p1Mapped: FieldPoint2D | undefined;
        let p2Mapped: FieldPoint2D | undefined;

        if (panel === 'left_wall' && inter.leftWall && inter.leftWall.lengthM > 0.05) {
          seg = inter.leftWall;
          // seg.p1.x, seg.p2.x is pull distance [0..pullLengthM]
          // seg.p1.y, seg.p2.y is height from floor [0..wallHeightM]
          const sx1 = Math.max(0, Math.min(1, seg.p1.y / spatialGeom.wallHeightM));
          const sy1 = Math.max(0, Math.min(1, 1 - seg.p1.x / spatialGeom.pullLengthM));
          const sx2 = Math.max(0, Math.min(1, seg.p2.y / spatialGeom.wallHeightM));
          const sy2 = Math.max(0, Math.min(1, 1 - seg.p2.x / spatialGeom.pullLengthM));
          p1Mapped = {
            x: Number((targetBoxX + sx1 * targetBoxW).toFixed(1)),
            y: Number((targetBoxY + sy1 * targetBoxH).toFixed(1)),
          };
          p2Mapped = {
            x: Number((targetBoxX + sx2 * targetBoxW).toFixed(1)),
            y: Number((targetBoxY + sy2 * targetBoxH).toFixed(1)),
          };
        } else if (panel === 'crown' && inter.crown && inter.crown.lengthM > 0.05) {
          seg = inter.crown;
          // seg.p1.x, seg.p2.x is pull distance [0..pullLengthM]
          // seg.p1.y, seg.p2.y is lateral position from Left Springline [0..widthM]
          const sx1 = Math.max(0, Math.min(1, seg.p1.y / spatialGeom.widthM));
          const sy1 = Math.max(0, Math.min(1, 1 - seg.p1.x / spatialGeom.pullLengthM));
          const sx2 = Math.max(0, Math.min(1, seg.p2.y / spatialGeom.widthM));
          const sy2 = Math.max(0, Math.min(1, 1 - seg.p2.x / spatialGeom.pullLengthM));
          p1Mapped = {
            x: Number((targetBoxX + sx1 * targetBoxW).toFixed(1)),
            y: Number((targetBoxY + sy1 * targetBoxH).toFixed(1)),
          };
          p2Mapped = {
            x: Number((targetBoxX + sx2 * targetBoxW).toFixed(1)),
            y: Number((targetBoxY + sy2 * targetBoxH).toFixed(1)),
          };
        } else if (panel === 'right_wall' && inter.rightWall && inter.rightWall.lengthM > 0.05) {
          seg = inter.rightWall;
          // seg.p1.x, seg.p2.x is pull distance [0..pullLengthM]
          // seg.p1.y, seg.p2.y is height from floor [0..wallHeightM], 0 at floor -> sx=1; wallHeightM at springline -> sx=0
          const sx1 = Math.max(0, Math.min(1, 1 - seg.p1.y / spatialGeom.wallHeightM));
          const sy1 = Math.max(0, Math.min(1, 1 - seg.p1.x / spatialGeom.pullLengthM));
          const sx2 = Math.max(0, Math.min(1, 1 - seg.p2.y / spatialGeom.wallHeightM));
          const sy2 = Math.max(0, Math.min(1, 1 - seg.p2.x / spatialGeom.pullLengthM));
          p1Mapped = {
            x: Number((targetBoxX + sx1 * targetBoxW).toFixed(1)),
            y: Number((targetBoxY + sy1 * targetBoxH).toFixed(1)),
          };
          p2Mapped = {
            x: Number((targetBoxX + sx2 * targetBoxW).toFixed(1)),
            y: Number((targetBoxY + sy2 * targetBoxH).toFixed(1)),
          };
        }

        if (seg && p1Mapped && p2Mapped) {
          projectedFaceTraces.push({
            ...ft,
            id: `proj-${panel}-${ft.id}`,
            panel,
            points: [p1Mapped, p2Mapped],
          });
        }
      }
    }
    const traces = [...directTraces, ...projectedFaceTraces];
    const waters = round.waterMarks
      .filter((w) => w.panel === panel)
      .map((w) =>
        useContinuousCadMapping
          ? {
              ...w,
              points: w.points.map(mapPt),
              brushRadius: Math.max(4, Number((w.brushRadius * scaleRadius).toFixed(1))),
            }
          : w
      );
    const inlineLabels = computeTraceInlineLabelPlacements(traces);

    return (
      <g
        transform={
          useContinuousCadMapping
            ? undefined
            : `translate(${offsetX}, ${offsetY}) scale(${scaleX}, ${scaleY})`
        }
        clipPath={`url(#${clipId})`}
      >
        {/* 1. Lithology fills (masked by any subsequent lithology_erase strokes), veins & foliation bands */}
        {strokes.map((st, idx) => {
          if (st.points.length === 0 || st.mode === 'lithology_erase') return null;
          const isBand = st.mode === 'vein_band' || st.mode === 'foliation_plane';
          if (isBand) {
            return (
              <FieldVeinFoliationBandSvgElement
                key={st.id}
                stroke={st}
                round={round}
                rememberedRocks={rememberedRocks}
                colorMode={colorMode}
                isReportSheet={true}
              />
            );
          }

          const subsequentErases = strokes
            .slice(idx + 1)
            .filter((s) => s.mode === 'lithology_erase' && s.points.length > 0);
          const maskId =
            subsequentErases.length > 0 ? `sheet-lith-mask-${panel}-${st.id}` : undefined;

          const info = resolveRockDisplayInfo(st.rockType, rememberedRocks);
          const patId = st.patternId || info.patternId;
          const strokePoly =
            st.polygon && st.polygon.length >= 3 ? st.polygon : st.points;
          const d = buildSmoothSvgPath(strokePoly);
          const baseStrokeW =
            st.brushRadius <= 8 ? Math.max(2, st.brushRadius) : st.brushRadius * 2;
          const effectiveStrokeW = Math.max(2, Math.round(baseStrokeW));
          const isClosed = Boolean(st.isClosed);
          const closedD = isClosed ? (d.endsWith('Z') || d.endsWith('z') ? d : `${d} Z`) : d;
          const indivLithDens = Math.round(
            st.symbolDensity ??
              round.lithologyDensityByRock?.[st.rockType] ??
              round.lithologyDensityByRock?.[patId] ??
              round.lithologySymbolDensity ??
              85
          );
          const indivLithAngle = Math.round(
            st.patternAngleDeg ??
              round.lithologyAngleByRock?.[st.rockType] ??
              round.lithologyAngleByRock?.[patId] ??
              round.lithologyPatternAngle ??
              0
          );
          const altRocks =
            st.alternatingRockIds && st.alternatingRockIds.length >= 2
              ? st.alternatingRockIds
              : st.alternateRockTypes && st.alternateRockTypes.length >= 2
              ? st.alternateRockTypes
              : null;
          const patternUrlId = altRocks
            ? `sheetpat-alt-${st.id}`
            : indivLithAngle !== 0
            ? `sheetpat-${patId}-d${indivLithDens}-a${indivLithAngle}`
            : `sheetpat-${patId}-d${indivLithDens}`;
          const customRockCol =
            st.customColor ||
            round.rockCustomColors?.[st.rockType] ||
            round.lithologyColorByRock?.[st.rockType] ||
            info.fillColor ||
            info.color ||
            '#fef08a';
          const outlineRockCol =
            st.customColor ||
            round.rockCustomColors?.[st.rockType] ||
            round.lithologyColorByRock?.[st.rockType] ||
            info.color ||
            '#78350f';
          return (
            <g key={st.id} data-lithology-id={st.id}>
              {maskId && (
                <defs>
                  <mask
                    id={maskId}
                    maskUnits="userSpaceOnUse"
                    x="0"
                    y="0"
                    width="1000"
                    height="1000"
                  >
                    <rect x="0" y="0" width="1000" height="1000" fill="white" />
                    {subsequentErases.map((er) => (
                      <path
                        key={er.id}
                        d={buildSmoothSvgPath(er.points)}
                        fill="none"
                        stroke="black"
                        strokeWidth={
                          er.brushRadius <= 8
                            ? Math.max(2, er.brushRadius)
                            : er.brushRadius * 2
                        }
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                  </mask>
                </defs>
              )}
              {isClosed ? (
                <>
                  {/* Rock color tint fill */}
                  <path
                    d={closedD}
                    fill={colorMode === 'bw' ? '#ffffff' : customRockCol}
                    fillOpacity={colorMode === 'bw' ? 1 : 0.88}
                    stroke="none"
                    mask={maskId ? `url(#${maskId})` : undefined}
                  />
                  {/* Rock geological pattern fill */}
                  <path
                    d={closedD}
                    fill={`url(#${patternUrlId})`}
                    fillOpacity={0.92}
                    stroke="none"
                    mask={maskId ? `url(#${maskId})` : undefined}
                  />
                  {/* Boundary outline stroke */}
                  <path
                    d={closedD}
                    fill="none"
                    stroke={colorMode === 'bw' ? '#0f172a' : outlineRockCol}
                    strokeWidth={Math.max(1.8, Math.min(5, effectiveStrokeW * 0.15))}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    mask={maskId ? `url(#${maskId})` : undefined}
                  />
                </>
              ) : (
                <>
                  {/* Open brush / stroke rock background tint */}
                  <path
                    d={d}
                    fill="none"
                    stroke={colorMode === 'bw' ? '#ffffff' : customRockCol}
                    strokeWidth={effectiveStrokeW}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    mask={maskId ? `url(#${maskId})` : undefined}
                  />
                  {/* Rock pattern stroke */}
                  <path
                    d={d}
                    fill="none"
                    stroke={`url(#${patternUrlId})`}
                    strokeWidth={effectiveStrokeW}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    mask={maskId ? `url(#${maskId})` : undefined}
                  />
                </>
              )}
            </g>
          );
        })}

        {/* 2. Dip Plane Surfaces with outline & interior dip angle/amount */}
        {planes.map((pl) => (
          <FieldDipSurfaceSvgElement
            key={pl.id}
            surface={pl}
            colorMode={colorMode}
            patternPrefix="sheetpat"
          />
        ))}

        {/* 3. Structural Features (Faults, Shears, Folds, Contacts) */}
        {features.map((feat) => (
          <FieldStructuralFeatureSvgElement
            key={feat.id}
            feature={feat}
            colorMode={colorMode}
            tunnelDriveDirection={round.tunnelDriveDirection}
          />
        ))}

        {/* 4. Joint Traces with perpendicular dip tick and clean inline text along the trace */}
        {traces.map((tr) => {
          if (tr.points.length < 2) return null;
          const d =
            tr.lineMode === 'linear'
              ? tr.points
                  .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                  .join(' ')
              : buildSmoothSvgPath(tr.points);
          const strokeColor =
            colorMode === 'bw'
              ? '#0f172a'
              : FIELD_JOINT_GROUP_COLORS[tr.setId]?.stroke || '#0f172a';
          const trW = Math.max(1.2, Math.min(16, tr.strokeWidthPx ?? 3.8));
          const lbl = inlineLabels[tr.id];
          const {
            mid,
            ux: tickUx,
            uy: tickUy,
          } = computeTraceScreenDipTickVector(
            tr.points,
            tr.panel,
            tr.dipDirection,
            round.tunnelDriveDirection
          );
          const tickX = mid.x + tickUx * 15;
          const tickY = mid.y + tickUy * 15;
          return (
            <g key={tr.id}>
              <path
                d={d}
                fill="none"
                stroke={strokeColor}
                strokeWidth={trW}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line
                x1={mid.x}
                y1={mid.y}
                x2={tickX}
                y2={tickY}
                stroke={strokeColor}
                strokeWidth="2.6"
              />
              {lbl && (
                <g
                  transform={`translate(${lbl.x}, ${lbl.y}) rotate(${lbl.angleDeg})`}
                >
                  <text
                    x="0"
                    y="0"
                    textAnchor="middle"
                    fontSize="13.5"
                    fontWeight="bold"
                    fontFamily="monospace"
                    fill={strokeColor}
                    stroke="#ffffff"
                    strokeWidth="3.5"
                    paintOrder="stroke"
                  >
                    {lbl.text}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* 5. Water Marks */}
        {waters.map((wm) => (
          <FieldWaterSymbolSvgElement
            key={wm.id}
            mark={wm}
            colorMode={colorMode}
          />
        ))}
      </g>
    );
  };

  const {
    faceGeom,
    crownGeom,
    leftWallGeom,
    rightWallGeom,
    splHeightM,
    splRatio,
    leftWallLengthM,
    rightWallLengthM,
    crownLengthM,
    pullM,
    stripPxPerMeter,
    stripLeftWallW,
    stripRightWallW,
    stripCrownW,
    totalRenderedW: rawTotalRenderedW,
    stripLeftWallH,
    stripRightWallH,
    stripCrownH,
    leftWallX,
    crownX,
    rightWallX,
    faceTopY,
    idealFaceW,
    idealFaceH,
    stripY: rawStripY,
    stripH,
    stripViewBoxH,
  } = computeUnfoldedStripBoxes(location, round, topStripOnly);

  const totalRenderedW = rawTotalRenderedW ?? (stripLeftWallW + stripCrownW + stripRightWallW);

  const faceDetails = computeFaceTunnelOutlineDetails(
    location,
    faceGeom.boxX,
    faceGeom.boxY,
    faceGeom.boxW,
    faceGeom.boxH
  );
  const facePath = faceDetails.closedFillPathD;
  const faceStrokePath = faceDetails.wallStrokePathD;
  // Center the large Tunnel Face Picture prominently across the 920px sheet width:
  const faceTargetW = idealFaceW;
  const faceTargetH = idealFaceH;
  const faceScaleX = faceTargetW / Math.max(1, faceGeom.boxW);
  const faceScaleY = faceTargetH / Math.max(1, faceGeom.boxH);
  const faceTargetX = Number(((920 - faceTargetW) / 2).toFixed(1));
  const faceTargetY = faceTopY;
  const faceOffsetX = faceTargetX - faceGeom.boxX * faceScaleX;
  const faceOffsetY = faceTargetY - faceGeom.boxY * faceScaleY;

  // Build unique lithologies used in this round for the Legend (only shown when available on canvas)
  const visibleRoundLithStrokes = pruneFullyErasedLithologyStrokes(round.lithologyStrokes);
  const usedLithIds = Array.from(
    new Set(
      visibleRoundLithStrokes
        .filter((s) => s.mode !== 'lithology_erase')
        .map((s) => s.rockType)
    )
  );
  const legendLithItems = usedLithIds.map((id) => ({
    id,
    ...resolveRockDisplayInfo(id, rememberedRocks),
  }));
  const availableJointSets = FIELD_JOINT_SET_IDS.filter(
    (setId) =>
      round.jointTraces.some((t) => t.setId === setId) ||
      round.dipPlaneSurfaces.some((d) => d.setId === setId)
  );
  const hasUngroupedTraces = round.jointTraces.some((t) => t.setId === 'unassigned');

  const reportExtraLithDensities = round.lithologyStrokes
    .filter(
      (s) =>
        s.mode !== 'vein_band' &&
        s.mode !== 'foliation_plane' &&
        s.mode !== 'lithology_erase'
    )
    .map((s) => {
      const info = resolveRockDisplayInfo(s.rockType, rememberedRocks);
      const patId = s.patternId || info.patternId || 'quartzite';
      const density = Math.round(
        s.symbolDensity ??
          round.lithologyDensityByRock?.[s.rockType] ??
          round.lithologyDensityByRock?.[patId] ??
          round.lithologySymbolDensity ??
          85
      );
      const angleDeg = Math.round(
        s.patternAngleDeg ??
          round.lithologyAngleByRock?.[s.rockType] ??
          round.lithologyAngleByRock?.[patId] ??
          round.lithologyPatternAngle ??
          0
      );
      const customColor =
        s.customColor ||
        round.rockCustomColors?.[s.rockType] ||
        round.lithologyColorByRock?.[s.rockType] ||
        round.lithologyColorByRock?.[patId];
      return { patId, density, customColor, angleDeg };
    });

  const lithLegendDisplay = legendLithItems.slice(0, 6);
  const jointLegendDisplay = [
    ...availableJointSets.map((setId) => {
      const s = round.discontinuitySets[setId];
      return {
        key: setId,
        stroke:
          colorMode === 'bw'
            ? '#0f172a'
            : FIELD_JOINT_GROUP_COLORS[setId].stroke,
        text: `${setId}: ${String(s.dipDirectionFrom).padStart(3, '0')}°–${String(
          s.dipDirectionTo
        ).padStart(3, '0')}° / ${s.dipAmountFrom}°–${s.dipAmountTo}°`,
      };
    }),
    ...(hasUngroupedTraces
      ? [
          {
            key: 'unassigned',
            stroke: '#0f172a',
            text: 'J: Mapped Joint Trace',
          },
        ]
      : []),
  ].slice(0, 6);

  const lithRowCount = Math.max(1, Math.ceil(lithLegendDisplay.length / 2));
  const jointRowCount = Math.max(1, Math.ceil(jointLegendDisplay.length / 2));
  const legendRows = Math.max(lithRowCount, jointRowCount);
  const legendBoxX = 16;
  const legendBoxW = 888;
  const stripY = rawStripY;
  const legendBoxY = Math.round(faceTargetY + faceTargetH + 26);
  const legendBoxH = 34 + legendRows * 20;
  const fullReportSvgH = Math.max(540, Math.round(legendBoxY + legendBoxH + 16));

  return (
    <svg
      id="field-unfolded-report-svg"
      ref={svgRef}
      viewBox={
        customViewBox ||
        (topStripOnly ? `0 0 920 ${stripViewBoxH}` : `0 0 920 ${fullReportSvgH}`)
      }
      onPointerDown={onSvgPointerDown}
      onPointerMove={onSvgPointerMove}
      onPointerUp={onSvgPointerUp}
      onPointerCancel={onSvgPointerUp}
      className={`w-full h-auto select-none touch-none ${
        topStripOnly ? 'bg-transparent' : 'bg-white'
      }`}
    >
      <FieldMonochromeGeologicalPatterns
        prefix="sheetpat"
        colorMode={colorMode}
        symbolDensity={round.lithologySymbolDensity ?? 85}
        symbolDensityByPattern={round.lithologyDensityByRock}
        symbolAngleByPattern={round.lithologyAngleByRock}
        lithologyPatternAngle={round.lithologyPatternAngle ?? 0}
        customColorsByRock={{
          ...(round.lithologyColorByRock || {}),
          ...(round.rockCustomColors || {}),
        }}
        extraLithologyDensities={reportExtraLithDensities}
        alternatingStrokes={round.lithologyStrokes.filter(
          (s) =>
            (s.alternatingRockIds && s.alternatingRockIds.length >= 2) ||
            (s.alternateRockTypes && s.alternateRockTypes.length >= 2)
        )}
        alternateStrokes={round.lithologyStrokes.filter(
          (s) =>
            (s.alternatingRockIds && s.alternatingRockIds.length >= 2) ||
            (s.alternateRockTypes && s.alternateRockTypes.length >= 2)
        )}
        rememberedRocks={rememberedRocks}
        bandSymbolDensity={round.veinBandSymbolDensity ?? 85}
      />
      <defs>
        <clipPath id="clip-sheet-face">
          <path d={facePath} />
        </clipPath>
        <clipPath id="clip-sheet-left-wall">
          <rect
            x={leftWallX}
            y={stripY}
            width={stripLeftWallW}
            height={stripLeftWallH}
          />
        </clipPath>
        <clipPath id="clip-sheet-crown">
          <rect
            x={crownX}
            y={stripY}
            width={stripCrownW}
            height={stripCrownH}
          />
        </clipPath>
        <clipPath id="clip-sheet-right-wall">
          <rect
            x={rightWallX}
            y={stripY}
            width={stripRightWallW}
            height={stripRightWallH}
          />
        </clipPath>
      </defs>

      {/* Top Row: Compact Continuous CAD Unfolded Strip [ Left Wall | Crown | Right Wall ] */}
      <g>
        <>
          {/* CONTINUOUS CAD STRIP: One unified continuous perimeter outline, zero unwanted internal boxes */}
          <rect
            x={leftWallX}
            y={stripY}
            width={totalRenderedW}
            height={stripH}
            fill="#ffffff"
            stroke="#0f172a"
            strokeWidth="1.6"
          />

          {faceGeom.hasLeftWall && (
            <>
              <text
                x={leftWallX + stripLeftWallW / 2}
                y={stripY - 14}
                textAnchor="middle"
                fontSize="12.5"
                fontWeight="bold"
                fontFamily="monospace"
                fill="#0f172a"
              >
                LEFT WALL ({leftWallLengthM.toFixed(2)}m)
              </text>
              {renderPanelContent(
                'left_wall',
                0,
                0,
                1,
                1,
                'clip-sheet-left-wall',
                true,
                leftWallX,
                stripY,
                stripLeftWallW,
                stripH,
                leftWallGeom
              )}
            </>
          )}

          {faceGeom.hasCrown && (
            <>
              <text
                x={crownX + stripCrownW / 2}
                y={stripY - 14}
                textAnchor="middle"
                fontSize="12.5"
                fontWeight="bold"
                fontFamily="monospace"
                fill="#0f172a"
              >
                CROWN ({crownLengthM.toFixed(2)}m)
              </text>
              {renderPanelContent(
                'crown',
                0,
                0,
                1,
                1,
                'clip-sheet-crown',
                true,
                crownX,
                stripY,
                stripCrownW,
                stripH,
                crownGeom
              )}
              {/* Vertical Centerline C at Mid-Crown */}
              <line
                x1={crownX + stripCrownW / 2}
                y1={stripY - 7}
                x2={crownX + stripCrownW / 2}
                y2={stripY + stripH + 7}
                stroke="#0f172a"
                strokeWidth="1.3"
                strokeDasharray="6,3,2,3"
              />
              <text
                x={crownX + stripCrownW / 2}
                y={stripY + stripH + 18}
                textAnchor="middle"
                fontSize="11.5"
                fontWeight="bold"
                fontFamily="monospace"
                fill="#0f172a"
              >
                C
              </text>
            </>
          )}

          {faceGeom.hasRightWall && (
            <>
              <text
                x={rightWallX + stripRightWallW / 2}
                y={stripY - 14}
                textAnchor="middle"
                fontSize="12.5"
                fontWeight="bold"
                fontFamily="monospace"
                fill="#0f172a"
              >
                RIGHT WALL ({rightWallLengthM.toFixed(2)}m)
              </text>
              {renderPanelContent(
                'right_wall',
                0,
                0,
                1,
                1,
                'clip-sheet-right-wall',
                true,
                rightWallX,
                stripY,
                stripRightWallW,
                stripH,
                rightWallGeom
              )}
            </>
          )}

          {/* Vertical Fold / SPL Seam Lines (zero gap between Left Wall, Crown, Right Wall) */}
          {faceGeom.hasLeftWall && faceGeom.hasCrown && (
            <>
              <line
                x1={crownX}
                y1={stripY - 6}
                x2={crownX}
                y2={stripY + stripH + 6}
                stroke="#0f172a"
                strokeWidth="1.8"
                strokeDasharray="4,3"
              />
              <text
                x={crownX}
                y={stripY + stripH + 18}
                textAnchor="middle"
                fontSize="11"
                fontWeight="bold"
                fontFamily="monospace"
                fill="#0f172a"
              >
                SPL
              </text>
            </>
          )}
          {faceGeom.hasCrown && faceGeom.hasRightWall && (
            <>
              <line
                x1={rightWallX}
                y1={stripY - 6}
                x2={rightWallX}
                y2={stripY + stripH + 6}
                stroke="#0f172a"
                strokeWidth="1.8"
                strokeDasharray="4,3"
              />
              <text
                x={rightWallX}
                y={stripY + stripH + 18}
                textAnchor="middle"
                fontSize="11"
                fontWeight="bold"
                fontFamily="monospace"
                fill="#0f172a"
              >
                SPL
              </text>
            </>
          )}

          {/* 1m Perimeter Ticks along the Top Horizontal Edge of the Continuous Strip (Arranged per user sketch: Left Wall 1..4 | Crown 1..7 | Right Wall 4..1) */}
          {faceGeom.hasLeftWall &&
            Array.from(
              { length: Math.floor(leftWallLengthM + 1e-4) },
              (_, idx) => idx + 1
            ).map((m) => {
              const xPos = leftWallX + m * stripPxPerMeter;
              if (xPos > crownX + 1) return null;
              const isSeam = Math.abs(xPos - crownX) < 2;
              return (
                <g key={`cad-lw-tk-${m}`}>
                  <line
                    x1={xPos}
                    y1={stripY - 5}
                    x2={xPos}
                    y2={stripY}
                    stroke="#0f172a"
                    strokeWidth="1.2"
                  />
                  <text
                    x={isSeam ? xPos - 3 : xPos}
                    y={stripY - 5}
                    textAnchor={isSeam ? 'end' : 'middle'}
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="bold"
                    fill="#0f172a"
                  >
                    {m}
                  </text>
                </g>
              );
            })}

          {faceGeom.hasCrown &&
            Array.from(
              { length: Math.floor(crownLengthM + 1e-4) },
              (_, idx) => idx + 1
            ).map((m) => {
              const xPos = crownX + m * stripPxPerMeter;
              if (xPos > rightWallX + 1) return null;
              const isSeam = Math.abs(xPos - rightWallX) < 2;
              return (
                <g key={`cad-cr-tk-${m}`}>
                  <line
                    x1={xPos}
                    y1={stripY - 5}
                    x2={xPos}
                    y2={stripY}
                    stroke="#0f172a"
                    strokeWidth="1.2"
                  />
                  <text
                    x={isSeam ? xPos - 3 : xPos}
                    y={stripY - 5}
                    textAnchor={isSeam ? 'end' : 'middle'}
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="bold"
                    fill="#0f172a"
                  >
                    {m}
                  </text>
                </g>
              );
            })}

          {faceGeom.hasRightWall && (() => {
            const rwMax = Math.floor(rightWallLengthM + 1e-4);
            return (
              <>
                {Array.from({ length: rwMax }, (_, k) => {
                  const mVal = rwMax - k;
                  const xPos = rightWallX + k * stripPxPerMeter;
                  if (xPos > rightWallX + stripRightWallW + 1) return null;
                  const isSeam = k === 0;
                  return (
                    <g key={`cad-rw-tk-${mVal}`}>
                      <line
                        x1={xPos}
                        y1={stripY - 5}
                        x2={xPos}
                        y2={stripY}
                        stroke="#0f172a"
                        strokeWidth="1.2"
                      />
                      <text
                        x={isSeam ? xPos + 3 : xPos}
                        y={stripY - 5}
                        textAnchor={isSeam ? 'start' : 'middle'}
                        fontSize="11"
                        fontFamily="monospace"
                        fontWeight="bold"
                        fill="#0f172a"
                      >
                        {mVal}
                      </text>
                    </g>
                  );
                })}
                {/* Outer Invert Tick Mark */}
                <line
                  x1={rightWallX + stripRightWallW}
                  y1={stripY - 5}
                  x2={rightWallX + stripRightWallW}
                  y2={stripY}
                  stroke="#0f172a"
                  strokeWidth="1.2"
                />
              </>
            );
          })()}

          {/* 1m Pull Ticks along BOTH Left & Right Vertical Edges of the Continuous Strip (Bottom is 0 -> Top is 3 / pull depth) */}
          {Array.from(
            { length: Math.floor(pullM + 1e-4) + 1 },
            (_, m) => m
          ).map((m) => {
            const yPos = stripY + stripH - m * stripPxPerMeter;
            if (yPos < stripY - 1 || yPos > stripY + stripH + 1) return null;
            const startX = faceGeom.hasLeftWall
              ? leftWallX
              : faceGeom.hasCrown
              ? crownX
              : rightWallX;
            const endX = faceGeom.hasRightWall
              ? rightWallX + stripRightWallW
              : faceGeom.hasCrown
              ? crownX + stripCrownW
              : leftWallX + stripLeftWallW;
            return (
              <g key={`cad-pull-tk-${m}`}>
                {/* Left vertical edge tick & number (Bottom 0 -> Top 3) */}
                <line
                  x1={startX - 5}
                  y1={yPos}
                  x2={startX}
                  y2={yPos}
                  stroke="#0f172a"
                  strokeWidth="1.2"
                />
                <text
                  x={startX - 7}
                  y={yPos + 4}
                  textAnchor="end"
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill="#0f172a"
                >
                  {m}
                </text>

                {/* Right vertical edge tick & number (Bottom 0 -> Top 3) */}
                <line
                  x1={endX}
                  y1={yPos}
                  x2={endX + 5}
                  y2={yPos}
                  stroke="#0f172a"
                  strokeWidth="1.2"
                />
                <text
                  x={endX + 7}
                  y={yPos + 4}
                  textAnchor="start"
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill="#0f172a"
                >
                  {m}
                </text>
              </g>
            );
          })}
        </>
      </g>

      {/* Interactive Alignment Overlay (rendered when topStripOnly is active in Stage 5) */}
      {interactiveOverlay}

      {/* PRIMARY SECTION: TUNNEL FACE OUTLINE (IN THE MIDDLE BELOW STRIP) */}
      {!topStripOnly && (
        <g>
          {/* Clean Section Title positioned 28px below top strip, providing generous headroom above crown arch for overbreak lines & labels */}
          <text
            x="460"
            y={stripY + stripH + 28}
            textAnchor="middle"
            fontSize="12.5"
            fontWeight="bold"
            fontFamily="monospace"
            fill="#0f172a"
          >
            TUNNEL EXCAVATION FACE — {location.shape.replace(/_/g, ' ').toUpperCase()} ({location.widthM}m SPAN × {location.heightM}m HEIGHT | SPL {splHeightM}m)
          </text>

          {/* Left & Right Height Rulers + Width Scale Bar around the large Face Picture with generous side clearance */}
          <line
            x1={faceTargetX - 24}
            y1={faceTargetY}
            x2={faceTargetX - 24}
            y2={faceTargetY + faceTargetH}
            stroke="#0f172a"
            strokeWidth="1.3"
          />
          <line
            x1={faceTargetX - 29}
            y1={faceTargetY}
            x2={faceTargetX - 19}
            y2={faceTargetY}
            stroke="#0f172a"
            strokeWidth="1.3"
          />
          <line
            x1={faceTargetX - 29}
            y1={faceTargetY + faceTargetH}
            x2={faceTargetX - 19}
            y2={faceTargetY + faceTargetH}
            stroke="#0f172a"
            strokeWidth="1.3"
          />
          <text
            x={faceTargetX - 34}
            y={faceTargetY + faceTargetH / 2}
            textAnchor="middle"
            fontSize="11.5"
            fontWeight="bold"
            fontFamily="monospace"
            fill="#0f172a"
            transform={`rotate(-90, ${faceTargetX - 34}, ${faceTargetY + faceTargetH / 2})`}
          >
            Face Height H = {location.heightM.toFixed(2)} m
          </text>

          <line
            x1={faceTargetX}
            y1={faceTargetY + faceTargetH + 12}
            x2={faceTargetX + faceTargetW}
            y2={faceTargetY + faceTargetH + 12}
            stroke="#0f172a"
            strokeWidth="1.3"
          />
          <text
            x={faceTargetX + faceTargetW / 2}
            y={faceTargetY + faceTargetH + 25}
            textAnchor="middle"
            fontSize="11.5"
            fontWeight="bold"
            fontFamily="monospace"
            fill="#0f172a"
          >
            Face Span W = {location.widthM.toFixed(2)} m (CL at 0.0m)
          </text>

          {/* SPL Markers on Left and Right of the Large Face Picture */}
          <text
            x={faceTargetX - 10}
            y={faceTargetY + faceTargetH * (1 - splRatio) - 4}
            textAnchor="end"
            fontSize="11"
            fontWeight="bold"
            fontFamily="monospace"
            fill="#0f172a"
          >
            L-SPL ({splHeightM}m)
          </text>
          <text
            x={faceTargetX + faceTargetW + 10}
            y={faceTargetY + faceTargetH * (1 - splRatio) - 4}
            textAnchor="start"
            fontSize="11"
            fontWeight="bold"
            fontFamily="monospace"
            fill="#0f172a"
          >
            R-SPL ({splHeightM}m)
          </text>

          {/* Survey Overbreak (OB) Pre-calculation & Geometry Fitting */}
          {(() => {
            const hasOverbreakSurvey =
              round.surveyOverbreak?.status === 'completed' &&
              (round.surveyOverbreak.surveyPoints?.length || 0) >= 2;

            let mappedSurveyPoints: { x: number; y: number; xM: number; yM: number }[] = [];
            let closedOverbreakPolygonPoints: { x: number; y: number }[] = [];
            let isLoopClosed = false;
            let strokeColor = '#059669';
            let fillColor = 'rgba(16, 185, 129, 0.20)';

            if (hasOverbreakSurvey && round.surveyOverbreak?.surveyPoints) {
              const W_m = Number(location.widthM) || faceGeom.tunnelW || 8;
              const H_m = Number(location.heightM) || faceGeom.tunnelH || 7;
              const advMaxBoxW = 430;
              const advMaxBoxH = 350;
              const advScale = Math.min(advMaxBoxW / W_m, advMaxBoxH / H_m);
              const advBoxW = Math.round(W_m * advScale);
              const advBoxH = Math.round(H_m * advScale);
              const advBoxX = Math.round(300 - advBoxW / 2);
              const advBoxY = Math.round(230 - advBoxH / 2);

              mappedSurveyPoints = round.surveyOverbreak.surveyPoints.map((pt: any) => {
                let xM: number;
                let yM: number;
                if (typeof pt.xM === 'number' && typeof pt.yM === 'number' && !isNaN(pt.xM) && !isNaN(pt.yM)) {
                  xM = pt.xM;
                  yM = pt.yM;
                } else if (
                  typeof pt.x === 'number' &&
                  typeof pt.y === 'number' &&
                  pt.x >= faceGeom.boxX - 250 &&
                  pt.x <= faceGeom.boxX + faceGeom.boxW + 250 &&
                  pt.y >= faceGeom.boxY - 250 &&
                  pt.y <= faceGeom.boxY + faceGeom.boxH + 250
                ) {
                  xM = ((pt.x - (faceGeom.boxX + faceGeom.boxW / 2)) / Math.max(1, faceGeom.boxW)) * W_m;
                  yM = ((faceGeom.boxY + faceGeom.boxH - pt.y) / Math.max(1, faceGeom.boxH)) * H_m;
                } else {
                  xM = ((pt.x - (advBoxX + advBoxW / 2)) / Math.max(1, advBoxW)) * W_m;
                  yM = ((advBoxY + advBoxH - pt.y) / Math.max(1, advBoxH)) * H_m;
                }
                const targetX = faceGeom.boxX + faceGeom.boxW / 2 + (xM / Math.max(0.1, W_m)) * faceGeom.boxW;
                const targetY = faceGeom.boxY + faceGeom.boxH - (yM / Math.max(0.1, H_m)) * faceGeom.boxH;
                return {
                  x: Number(targetX.toFixed(1)),
                  y: Number(targetY.toFixed(1)),
                  xM: Number(xM.toFixed(2)),
                  yM: Number(yM.toFixed(2)),
                };
              });

              if (mappedSurveyPoints.length >= 3) {
                const p0 = mappedSurveyPoints[0];
                const pEnd = mappedSurveyPoints[mappedSurveyPoints.length - 1];
                const distEnds = Math.hypot(p0.x - pEnd.x, p0.y - pEnd.y);
                isLoopClosed = distEnds < Math.max(16, faceGeom.boxW * 0.08);

                if (isLoopClosed) {
                  closedOverbreakPolygonPoints = mappedSurveyPoints;
                } else {
                  const floorY = faceGeom.boxY + faceGeom.boxH;
                  closedOverbreakPolygonPoints = [
                    ...mappedSurveyPoints,
                    { x: pEnd.x, y: floorY },
                    { x: p0.x, y: floorY },
                  ];
                }
              }

              const isReal = Boolean(round.surveyOverbreak.isRealOverbreak);
              strokeColor = colorMode === 'bw' ? '#0f172a' : isReal ? '#dc2626' : '#059669';
              fillColor = colorMode === 'bw'
                ? 'rgba(15, 23, 42, 0.12)'
                : isReal
                ? 'rgba(239, 68, 68, 0.22)'
                : 'rgba(16, 185, 129, 0.18)';
            }

            return (
              <>
                {/* 1. Shaded Overbreak Excavation Polygon - RENDERED IN THE BACKGROUND BEHIND WHITE FACE */}
                {closedOverbreakPolygonPoints.length >= 3 && (
                  <g
                    transform={`translate(${faceOffsetX}, ${faceOffsetY}) scale(${faceScaleX}, ${faceScaleY})`}
                  >
                    <polygon
                      points={closedOverbreakPolygonPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth="1.8"
                      strokeDasharray="6,3"
                    />
                  </g>
                )}

                {/* 2. White Design Tunnel Face Mask & Reference CL / SPL Lines */}
                <g
                  transform={`translate(${faceOffsetX}, ${faceOffsetY}) scale(${faceScaleX}, ${faceScaleY})`}
                >
                  <path d={facePath} fill="#ffffff" stroke="none" />
                  <line
                    x1={faceGeom.boxX + faceGeom.boxW / 2}
                    y1={faceGeom.boxY}
                    x2={faceGeom.boxX + faceGeom.boxW / 2}
                    y2={faceGeom.boxY + faceGeom.boxH}
                    stroke="#0f172a"
                    strokeWidth="2.2"
                    strokeDasharray="12,5,3,5"
                  />
                  <line
                    x1={faceGeom.boxX}
                    y1={faceGeom.boxY + faceGeom.boxH * (1 - splRatio)}
                    x2={faceGeom.boxX + faceGeom.boxW}
                    y2={faceGeom.boxY + faceGeom.boxH * (1 - splRatio)}
                    stroke="#0f172a"
                    strokeWidth="2.2"
                    strokeDasharray="10,5"
                  />
                </g>

                {/* 3. Panel Geological Contents (Lithology, Joints, Planes) */}
                {renderPanelContent(
                  'face',
                  faceOffsetX,
                  faceOffsetY,
                  faceScaleX,
                  faceScaleY,
                  'clip-sheet-face'
                )}

                {/* 4. Design Tunnel Profile Stroke, Payline & Survey Overbreak Outline */}
                <g
                  transform={`translate(${faceOffsetX}, ${faceOffsetY}) scale(${faceScaleX}, ${faceScaleY})`}
                >
                  <path d={faceStrokePath} fill="none" stroke="#0f172a" strokeWidth="3.6" />

                  {/* Payline Outline on Report Face Sketch */}
                  {(() => {
                    if (
                      round.surveyOverbreak?.status !== 'completed' ||
                      round.surveyOverbreak.paylineEnabled === false
                    ) {
                      return null;
                    }
                    const facePolyPts = [
                      ...(faceDetails.leftWallPoly || []),
                      ...(faceDetails.crownPoly || []),
                      ...(faceDetails.rightWallPoly || []).slice().reverse(),
                      ...(faceDetails.invertPoly || []).slice().reverse(),
                    ];
                    if (facePolyPts.length < 3) return null;
                    const payOffM = (round.surveyOverbreak.paylineOffsetMm ?? 150) / 1000;
                    const scX = faceGeom.boxW / Math.max(0.1, location.widthM);
                    const scY = faceGeom.boxH / Math.max(0.1, location.heightM);
                    const c = {
                      x: faceGeom.boxX + faceGeom.boxW / 2,
                      y: faceGeom.boxY + faceGeom.boxH * 0.55,
                    };
                    const payPts = computePaylinePolygon(facePolyPts, payOffM, scX, scY, c);
                    if (payPts.length < 3) return null;
                    return (
                      <g>
                        <polygon
                          points={payPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
                          fill="none"
                          stroke={colorMode === 'bw' ? '#475569' : '#059669'}
                          strokeWidth="2.0"
                          strokeDasharray="6,3"
                        />
                        {payPts[Math.floor(payPts.length * 0.28)] && (
                          <text
                            x={payPts[Math.floor(payPts.length * 0.28)].x}
                            y={payPts[Math.floor(payPts.length * 0.28)].y - 6}
                            fontSize="11"
                            fontWeight="bold"
                            fontFamily="monospace"
                            fill={colorMode === 'bw' ? '#475569' : '#059669'}
                          >
                            PAYLINE (+{round.surveyOverbreak.paylineOffsetMm ?? 150}mm)
                          </text>
                        )}
                      </g>
                    );
                  })()}

                  {/* Survey Profile Outline (Traces excavated rock perimeter accurately) */}
                  {mappedSurveyPoints.length >= 2 &&
                    (isLoopClosed ? (
                      <polygon
                        points={mappedSurveyPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="3.2"
                        strokeDasharray="9,4"
                      />
                    ) : (
                      <polyline
                        points={mappedSurveyPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="3.2"
                        strokeDasharray="9,4"
                      />
                    ))}

                  {/* Survey Point Markers & Labels */}
                  {mappedSurveyPoints.map((pt, pIdx) => {
                    const origPt = round.surveyOverbreak?.surveyPoints?.[pIdx];
                    const devMm = origPt?.deviationMm;
                    const devText =
                      devMm !== undefined && devMm !== 0
                        ? ` (${devMm > 0 ? '+' : ''}${devMm}mm)`
                        : '';
                    return (
                      <g key={`rpt-ob-pt-${pIdx}`}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="4.5"
                          fill={strokeColor}
                          stroke="#ffffff"
                          strokeWidth="1.8"
                        />
                        {(mappedSurveyPoints.length <= 8 ||
                          pIdx % 2 === 0 ||
                          pIdx === 0 ||
                          pIdx === mappedSurveyPoints.length - 1) && (
                          <text
                            x={pt.x + (pt.x < faceGeom.boxX + faceGeom.boxW / 2 ? -7 : 7)}
                            y={pt.y - 6}
                            textAnchor={pt.x < faceGeom.boxX + faceGeom.boxW / 2 ? 'end' : 'start'}
                            fontSize="9.5"
                            fontWeight="bold"
                            fontFamily="monospace"
                            fill={strokeColor}
                            stroke="#ffffff"
                            strokeWidth="2.5"
                            paintOrder="stroke"
                          >
                            P{pIdx + 1}
                            {devText}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Clear Overbreak Callout Box when overbreak exists */}
                  {round.surveyOverbreak && round.surveyOverbreak.overbreakAreaM2 > 0 && (
                    <g transform={`translate(${faceGeom.boxX + faceGeom.boxW / 2}, ${faceGeom.boxY + faceGeom.boxH * 0.45})`}>
                      <rect
                        x="-105"
                        y="-13"
                        width="210"
                        height="26"
                        rx="4"
                        fill="#ffffff"
                        fillOpacity="0.94"
                        stroke={strokeColor}
                        strokeWidth="1.6"
                      />
                      <text
                        x="0"
                        y="4"
                        textAnchor="middle"
                        fontSize="9.8"
                        fontWeight="bold"
                        fontFamily="monospace"
                        fill={strokeColor}
                      >
                        SURVEY OB: {round.surveyOverbreak.overbreakAreaM2.toFixed(2)} m² ({round.surveyOverbreak.overbreakPercent.toFixed(1)}%)
                      </text>
                    </g>
                  )}

                  {/* 1m Reference Tick Lines along the Face Tunnel Outline for all shapes */}
                  {faceDetails.ticks
                    .filter((tk) => tk.zone !== 'invert')
                    .map((tk, idx) => (
                      <line
                        key={`fc-arch-tk-${idx}`}
                        x1={tk.x - tk.nx * 7}
                        y1={tk.y - tk.ny * 7}
                        x2={tk.x + tk.nx * 8}
                        y2={tk.y + tk.ny * 8}
                        stroke="#0f172a"
                        strokeWidth="2.6"
                      />
                    ))}
                </g>
              </>
            );
          })()}

          {/* Legend Box Positioned Directly BELOW BOTH the Strip and Tunnel Face */}
          <rect
            x={legendBoxX}
            y={legendBoxY}
            width={legendBoxW}
            height={legendBoxH}
            fill="#ffffff"
            stroke="#0f172a"
            strokeWidth="1.1"
          />
          <line
            x1={legendBoxX}
            y1={legendBoxY + 18}
            x2={legendBoxX + legendBoxW}
            y2={legendBoxY + 18}
            stroke="#0f172a"
            strokeWidth="1"
          />
          <line
            x1={legendBoxX + legendBoxW / 2}
            y1={legendBoxY}
            x2={legendBoxX + legendBoxW / 2}
            y2={legendBoxY + legendBoxH}
            stroke="#0f172a"
            strokeWidth="1"
          />
          <text
            x={legendBoxX + legendBoxW * 0.25}
            y={legendBoxY + 13}
            textAnchor="middle"
            fontSize="8.5"
            fontWeight="bold"
            fontFamily="monospace"
            fill="#0f172a"
          >
            LITHOLOGY &amp; VEIN / FOLIATION BANDS LEGEND
          </text>
          <text
            x={legendBoxX + legendBoxW * 0.75}
            y={legendBoxY + 13}
            textAnchor="middle"
            fontSize="8.5"
            fontWeight="bold"
            fontFamily="monospace"
            fill="#0f172a"
          >
            DISCONTINUITY / JOINT SETS LEGEND
          </text>

          {/* Left Half of Legend Box: Lithologies & Bands */}
          {lithLegendDisplay.length > 0 ? (
            lithLegendDisplay.map((item, idx) => {
              const colIdx = idx % 2;
              const rowIdx = Math.floor(idx / 2);
              const itemX = legendBoxX + 14 + colIdx * 205;
              const itemY = legendBoxY + 23 + rowIdx * 20;
              return (
                <g key={item.id} transform={`translate(${itemX}, ${itemY})`}>
                  <rect
                    x="0"
                    y="0"
                    width="28"
                    height="14"
                    fill={`url(#sheetpat-${item.patternId})`}
                    stroke="#0f172a"
                    strokeWidth="1"
                  />
                  <text
                    x="34"
                    y="10.5"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                    fill="#0f172a"
                  >
                    {item.name.slice(0, 22)}
                  </text>
                </g>
              );
            })
          ) : (
            <text
              x={legendBoxX + legendBoxW * 0.25}
              y={legendBoxY + 36}
              textAnchor="middle"
              fontSize="8.5"
              fontFamily="monospace"
              fill="#0f172a"
            >
              No lithology units mapped on canvas
            </text>
          )}

          {/* Right Half of Legend Box: Discontinuity / Joint Sets */}
          {jointLegendDisplay.length > 0 ? (
            jointLegendDisplay.map((jItem, idx) => {
              const colIdx = idx % 2;
              const rowIdx = Math.floor(idx / 2);
              const itemX = legendBoxX + legendBoxW / 2 + 14 + colIdx * 205;
              const itemY = legendBoxY + 23 + rowIdx * 20;
              return (
                <g key={jItem.key} transform={`translate(${itemX}, ${itemY})`}>
                  <rect
                    x="0"
                    y="0"
                    width="26"
                    height="14"
                    fill="#ffffff"
                    stroke="#0f172a"
                    strokeWidth="1"
                  />
                  <line
                    x1="3"
                    y1="7"
                    x2="23"
                    y2="7"
                    stroke={jItem.stroke}
                    strokeWidth="2.8"
                  />
                  <text
                    x="32"
                    y="10.5"
                    fontSize="8"
                    fontFamily="monospace"
                    fontWeight="bold"
                    fill={jItem.stroke}
                  >
                    {jItem.text}
                  </text>
                </g>
              );
            })
          ) : (
            <text
              x={legendBoxX + legendBoxW * 0.75}
              y={legendBoxY + 36}
              textAnchor="middle"
              fontSize="8.5"
              fontFamily="monospace"
              fill="#0f172a"
            >
              No joint sets mapped on canvas
            </text>
          )}
        </g>
      )}
    </svg>
  );
};

export const FieldUnfoldedSheetSvgPreview = FieldUnfoldedMonochromeSketchSvg;

export const FieldStructuralFeatureSvgRenderer: React.FC<{
  feature: FieldStructuralFeature;
  scale?: number;
  colorMode?: 'bw' | 'color';
  tunnelDriveDirection?: number;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent<SVGGElement>) => void;
}> = ({
  feature,
  colorMode = 'bw',
  tunnelDriveDirection = 45,
  isSelected = false,
  onClick,
}) => (
  <FieldStructuralFeatureSvgElement
    feature={feature}
    colorMode={colorMode}
    tunnelDriveDirection={tunnelDriveDirection}
    isSelected={isSelected}
    onClick={onClick}
  />
);

export const FieldWaterSymbolSvgRenderer: React.FC<{
  water: FieldWaterMark;
  scale?: number;
  colorMode?: 'bw' | 'color';
}> = ({ water, scale = 1, colorMode = 'color' }) => (
  <FieldWaterSymbolSvgElement mark={water} scale={scale} colorMode={colorMode} />
);

/**
 * Renders the 1m Reference Grid Lines, Springline (SPL), Center Line (CL),
 * and Physical Width × Height Dimension Bars for the active Field Mapping Canvas panel:
 * - Face: Width = Tunnel Span (widthM), Height = Tunnel Height (heightM), with SPL at wallHeightM & vertical CL
 * - Left Wall & Right Wall: Width = Pull (pullLengthMeters), Height = Wall Height (wallHeightM), with SPL & CL
 * - Crown: Width = Crown Length (computeCrownLengthMeters), Height = Pull (pullLengthMeters), with Left/Right SPL & CL
 */
export const FieldCanvasGeometryReferenceOverlay: React.FC<{
  activePanel: FieldPanelId;
  location: FieldTunnelLocationItem;
  round: FieldExcavationRound;
  boxX?: number;
  boxY?: number;
  boxW?: number;
  boxH?: number;
  layer: 'underlay_grid' | 'overlay_labels';
  compact?: boolean;
  isActivePanel?: boolean;
  stageMode?: FieldTransformStageMode;
  mappingDomain?: 'TUNNEL' | 'BENCH' | 'TRENCH' | 'SLOPE' | 'ROCK_SURFACE';
}> = ({
  activePanel,
  location,
  round,
  boxX: propBoxX,
  boxY: propBoxY,
  boxW: propBoxW,
  boxH: propBoxH,
  layer,
  compact = false,
  isActivePanel = false,
  stageMode = 'field_canvas',
  mappingDomain = 'TUNNEL',
}) => {
  const isSurface = mappingDomain !== 'TUNNEL';
  const effectiveLocation: FieldTunnelLocationItem = isSurface
    ? { ...location, shape: 'rectangular', wallHeightM: location.heightM }
    : location;
  const geom = computePanelCanvasGeometry(activePanel, effectiveLocation, round);
  const {
    tunnelW,
    tunnelH,
    splHeightM,
    pullM,
    crownLengthM,
  } = geom;

  const orientMeta = computePanelOrientationReferenceMeta(
    activePanel,
    round,
    splHeightM,
    crownLengthM,
    pullM,
    stageMode
  );

  const panelWidthM = activePanel === 'face' ? geom.panelWidthM : orientMeta.widthM;
  const panelHeightM = activePanel === 'face' ? geom.panelHeightM : orientMeta.heightM;

  const boxX = propBoxX ?? geom.boxX;
  const boxY = propBoxY ?? geom.boxY;
  const boxW = propBoxW ?? geom.boxW;
  const boxH = propBoxH ?? geom.boxH;

  const left = boxX;
  const right = boxX + boxW;
  const top = boxY;
  const bottom = boxY + boxH;
  const cx = boxX + boxW / 2;
  const cy = boxY + boxH / 2;

  // True 1.00-meter scale step in canvas pixels (stepX === stepY = 1:1 square geometry preserved)
  const stepX = boxW / Math.max(0.5, panelWidthM);
  const stepY = boxH / Math.max(0.5, panelHeightM);
  const faceSplY = bottom - (splHeightM / Math.max(0.5, tunnelH)) * boxH;

  if (layer === 'underlay_grid') {
    return (
      <g className="pointer-events-none">
        {/* Center Line (CL) and SPL inside panel */}
        {activePanel === 'face' && (
          <>
            <line
              x1={cx}
              y1={top}
              x2={cx}
              y2={bottom}
              stroke="rgba(2, 132, 199, 0.55)"
              strokeWidth="1.8"
              strokeDasharray="10,4,2,4"
            />
            {!isSurface && effectiveLocation.shape !== 'circular' && (
              <line
                x1={left}
                y1={faceSplY}
                x2={right}
                y2={faceSplY}
                stroke="rgba(217, 119, 6, 0.65)"
                strokeWidth="2.2"
                strokeDasharray="8,4"
              />
            )}
          </>
        )}
        {activePanel === 'crown' && (
          !orientMeta.isRotated90 ? (
            <line
              x1={cx}
              y1={top}
              x2={cx}
              y2={bottom}
              stroke="rgba(2, 132, 199, 0.65)"
              strokeWidth="1.8"
              strokeDasharray="10,4,2,4"
            />
          ) : (
            <line
              x1={left}
              y1={cy}
              x2={right}
              y2={cy}
              stroke="rgba(2, 132, 199, 0.65)"
              strokeWidth="1.8"
              strokeDasharray="10,4,2,4"
            />
          )
        )}
      </g>
    );
  }

  // ====================================================================
  // OUTER LINE 1.00m SPACING SCALE TICKS, SECTION LENGTHS, SPL/CREST/TOE & CENTER (CL)
  // Rendered cleanly along the outer perimeter of the active surface
  // ====================================================================
  const tickColor = '#0369A1';
  const textColor = '#0F172A';
  const accentSplColor = '#B45309';
  const accentCenterColor = '#047857';
  const driveAzColor = '#0284C7';
  const haloColor = 'rgba(255,255,255,0.92)';
  const normDrive = ((Number(round.tunnelDriveDirection || 0) % 360) + 360) % 360;
  const oppDrive = (normDrive + 180) % 360;
  const rightAz = (normDrive + 90) % 360;
  const leftAz = (normDrive + 270) % 360;

  if (activePanel === 'face') {
    const faceDetails = computeFaceTunnelOutlineDetails(effectiveLocation, boxX, boxY, boxW, boxH);
    const leftWallMidY = (faceDetails.splLeftPt.y + bottom) / 2;
    const rightWallMidY = (faceDetails.splRightPt.y + bottom) / 2;
    const leftWallLenM = effectiveLocation.leftWallLengthM ?? splHeightM;
    const rightWallLenM = effectiveLocation.rightWallLengthM ?? splHeightM;
    const totalPerimM =
      (faceDetails.hasLeftWall ? leftWallLenM : 0) +
      (faceDetails.hasCrown ? crownLengthM : 0) +
      (faceDetails.hasRightWall ? rightWallLenM : 0);

    return (
      <g className="pointer-events-none select-none" fontFamily="IBM Plex Mono, monospace">
        {/* Shape-Adaptive 1m Reference Ticks following the actual outline (Strictly Exterior) */}
        {faceDetails.ticks.map((tk, idx) => {
          const faceFontScale = Math.max(1.0, Math.min(1.2, Math.min(boxW, boxH) / 480));
          const isInvert = tk.zone === 'invert';
          const isZeroInvert = isInvert && tk.m === 0;
          const tickLen = isZeroInvert ? 14 : 10;
          // Ticks point purely outwards along unit normal (nx, ny)
          const x1 = tk.x;
          const y1 = tk.y;
          const x2 = tk.x + tk.nx * tickLen;
          const y2 = tk.y + tk.ny * tickLen;
          // Generous exterior offset distance so numbers never touch or intrude inside the outline
          const lblDist = Math.max(26, tk.labelOffsetDist + 12);
          const lx = tk.x + tk.nx * lblDist;
          const ly = tk.y + tk.ny * lblDist + (isInvert ? 6 : 4);
          const anchor =
            Math.abs(tk.nx) > 0.4
              ? tk.nx < 0
                ? 'end'
                : 'start'
              : 'middle';
          const labelStr = isInvert
            ? isZeroInvert
              ? isSurface
                ? '0m (TOE C/L)'
                : '0m (CENTER)'
              : `${tk.m > 0 ? `+${tk.m}` : tk.m}m`
            : `${tk.m}m`;

          return (
            <g key={`face-tk-${tk.zone}-${tk.m}-${idx}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isZeroInvert ? accentCenterColor : tickColor}
                strokeWidth={isZeroInvert ? '2.4' : '1.8'}
              />
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                fontSize={(11.0 * faceFontScale).toFixed(1)}
                fontWeight="700"
                fill={isZeroInvert ? accentCenterColor : textColor}
                stroke={haloColor}
                strokeWidth="2.8"
                paintOrder="stroke"
              >
                {labelStr}
              </text>
            </g>
          );
        })}

        {/* LEFT SPL / CREST Marker & Label - Strictly OUTSIDE the perimeter */}
        {faceDetails.hasLeftWall && effectiveLocation.shape !== 'circular' && (
          <g>
            <line
              x1={faceDetails.splLeftPt.x - 24}
              y1={faceDetails.splLeftPt.y}
              x2={faceDetails.splLeftPt.x}
              y2={faceDetails.splLeftPt.y}
              stroke={accentSplColor}
              strokeWidth="2.5"
            />
            {/* Control Point Circle placed strictly exterior to outline */}
            <circle
              cx={faceDetails.splLeftPt.x - 6}
              cy={faceDetails.splLeftPt.y}
              r="4.5"
              fill={accentSplColor}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <text
              x={faceDetails.splLeftPt.x - 28}
              y={faceDetails.splLeftPt.y + 3.5}
              textAnchor="end"
              fontSize={(11.5 * Math.max(1.0, Math.min(1.2, Math.min(boxW, boxH) / 480))).toFixed(1)}
              fontWeight="800"
              fill={accentSplColor}
              stroke={haloColor}
              strokeWidth="3"
              paintOrder="stroke"
            >
              {isSurface
                ? `CREST (L) ${leftWallLenM.toFixed(2)}m`
                : `SPL (L) ${leftWallLenM.toFixed(2)}m`}
            </text>
          </g>
        )}

        {/* RIGHT SPL / CREST Marker & Label - Strictly OUTSIDE the perimeter */}
        {faceDetails.hasRightWall && effectiveLocation.shape !== 'circular' && (
          <g>
            <line
              x1={faceDetails.splRightPt.x}
              y1={faceDetails.splRightPt.y}
              x2={faceDetails.splRightPt.x + 24}
              y2={faceDetails.splRightPt.y}
              stroke={accentSplColor}
              strokeWidth="2.5"
            />
            {/* Control Point Circle placed strictly exterior to outline */}
            <circle
              cx={faceDetails.splRightPt.x + 6}
              cy={faceDetails.splRightPt.y}
              r="4.5"
              fill={accentSplColor}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <text
              x={faceDetails.splRightPt.x + 28}
              y={faceDetails.splRightPt.y + 3.5}
              textAnchor="start"
              fontSize={(11.5 * Math.max(1.0, Math.min(1.2, Math.min(boxW, boxH) / 480))).toFixed(1)}
              fontWeight="800"
              fill={accentSplColor}
              stroke={haloColor}
              strokeWidth="3"
              paintOrder="stroke"
            >
              {isSurface
                ? `CREST (R) ${rightWallLenM.toFixed(2)}m`
                : `SPL (R) ${rightWallLenM.toFixed(2)}m`}
            </text>
          </g>
        )}

        {/* CROWN / CREST CENTER (CL) Outer Marker - Strictly OUTSIDE top apex */}
        {faceDetails.hasCrown && (
          <g>
            <line
              x1={faceDetails.clTopPt.x}
              y1={faceDetails.clTopPt.y - 24}
              x2={faceDetails.clTopPt.x}
              y2={faceDetails.clTopPt.y}
              stroke={accentCenterColor}
              strokeWidth="2.5"
            />
            {/* Control Point Circle placed strictly exterior above outline */}
            <circle
              cx={faceDetails.clTopPt.x}
              cy={faceDetails.clTopPt.y - 7}
              r="4.5"
              fill={accentCenterColor}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <text
              x={cx}
              y={top - 30}
              textAnchor="middle"
              fontSize={(11.5 * Math.max(1.0, Math.min(1.2, Math.min(boxW, boxH) / 480))).toFixed(1)}
              fontWeight="800"
              fill={accentCenterColor}
              stroke={haloColor}
              strokeWidth="3"
              paintOrder="stroke"
            >
              {isSurface
                ? `▲ FACE DIP DIR ${String(normDrive).padStart(3, '0')}° (CREST C/L) · CREST SPAN = ${crownLengthM.toFixed(2)}m`
                : `▲ DRIVE ${String(normDrive).padStart(3, '0')}° (C/L) · CROWN ARC = ${crownLengthM.toFixed(2)}m · ▼ ${String(oppDrive).padStart(3, '0')}°`}
            </text>
          </g>
        )}

        {/* Left Wall / Batter Height Label - Omitted completely if Left Wall portion is Open */}
        {faceDetails.hasLeftWall && (
          <text
            x={left - 42}
            y={leftWallMidY}
            textAnchor="middle"
            fontSize={(11.0 * Math.max(1.0, Math.min(1.2, Math.min(boxW, boxH) / 480))).toFixed(1)}
            fontWeight="800"
            fill={tickColor}
            stroke={haloColor}
            strokeWidth="3"
            paintOrder="stroke"
            transform={`rotate(-90, ${left - 32}, ${leftWallMidY})`}
          >
            {isSurface
              ? `${mappingDomain} HEIGHT (L) = ${leftWallLenM.toFixed(2)}m`
              : `LEFT WALL LENGTH = ${leftWallLenM.toFixed(2)}m`}
          </text>
        )}

        {/* Right Wall / Batter Height Label - Omitted completely if Right Wall portion is Open */}
        {faceDetails.hasRightWall && (
          <text
            x={right + 42}
            y={rightWallMidY}
            textAnchor="middle"
            fontSize={(11.0 * Math.max(1.0, Math.min(1.2, Math.min(boxW, boxH) / 480))).toFixed(1)}
            fontWeight="800"
            fill={tickColor}
            stroke={haloColor}
            strokeWidth="3"
            paintOrder="stroke"
            transform={`rotate(90, ${right + 42}, ${rightWallMidY})`}
          >
            {isSurface
              ? `${mappingDomain} HEIGHT (R) = ${rightWallLenM.toFixed(2)}m`
              : `RIGHT WALL LENGTH = ${rightWallLenM.toFixed(2)}m`}
          </text>
        )}

        {/* Bottom Total Span & Toe Label - Strictly OUTSIDE bottom invert */}
        <text
          x={cx}
          y={bottom + 48}
          textAnchor="middle"
          fontSize={(11.5 * Math.max(1.0, Math.min(1.2, Math.min(boxW, boxH) / 480))).toFixed(1)}
          fontWeight="800"
          fill={tickColor}
          stroke={haloColor}
          strokeWidth="3"
          paintOrder="stroke"
        >
          {isSurface
            ? `TOE / BASE SPAN = ${tunnelW.toFixed(2)}m · FACE HEIGHT = ${tunnelH.toFixed(2)}m (1m SPACING)`
            : `SPAN LENGTH = ${tunnelW.toFixed(2)}m · TOTAL MAPPED PERIMETER = ${totalPerimM.toFixed(2)}m (1m SPACING)`}
        </text>
      </g>
    );
  }

  const driveStr = String(normDrive).padStart(3, '0');
  const oppStr = String(oppDrive).padStart(3, '0');
  const domainPanelMeta = getSurfacePanelLabelMap(mappingDomain);
  const panelDisplayName = isSurface
    ? activePanel === 'crown'
      ? domainPanelMeta.crown.shortLabel.toUpperCase()
      : activePanel === 'left_wall'
      ? domainPanelMeta.leftWall.shortLabel.toUpperCase()
      : domainPanelMeta.rightWall.shortLabel.toUpperCase()
    : activePanel === 'left_wall'
    ? 'LEFT WALL'
    : activePanel === 'crown'
    ? 'CROWN'
    : 'RIGHT WALL';

  const pullWord = isSurface
    ? mappingDomain === 'BENCH'
      ? 'BENCH LENGTH'
      : mappingDomain === 'TRENCH'
      ? 'TRENCH INTERVAL'
      : mappingDomain === 'SLOPE'
      ? 'SECTOR WIDTH'
      : 'EXPOSURE SPAN'
    : 'PULL';
  const pullWordTitle = isSurface
    ? mappingDomain === 'BENCH'
      ? 'Bench Length'
      : mappingDomain === 'TRENCH'
      ? 'Trench Interval'
      : mappingDomain === 'SLOPE'
      ? 'Sector Width'
      : 'Exposure Span'
    : 'Pull';
  const driveWord = isSurface
    ? mappingDomain === 'TRENCH'
      ? 'AXIS AZIMUTH'
      : 'DIP DIR'
    : 'DRIVE';
  const driveWordTitle = isSurface
    ? mappingDomain === 'TRENCH'
      ? 'Axis Azimuth'
      : 'Dip Dir'
    : 'Drive';
  const splLeftWord = isSurface
    ? mappingDomain === 'BENCH'
      ? 'TOE TRACE'
      : mappingDomain === 'TRENCH'
      ? 'LEFT TOP'
      : mappingDomain === 'SLOPE'
      ? 'TOE DITCH'
      : 'LEFT FLANK'
    : 'LEFT SPL';
  const splRightWord = isSurface
    ? mappingDomain === 'BENCH'
      ? 'SIDE FLANK'
      : mappingDomain === 'TRENCH'
      ? 'RIGHT TOP'
      : mappingDomain === 'SLOPE'
      ? 'FLANK CUT'
      : 'RIGHT FLANK'
    : 'RIGHT SPL';
  const splLeftShort = isSurface
    ? mappingDomain === 'BENCH'
      ? 'TOE'
      : mappingDomain === 'TRENCH'
      ? 'L-TOP'
      : mappingDomain === 'SLOPE'
      ? 'TOE'
      : 'L-FLANK'
    : 'L-SPL';
  const splRightShort = isSurface
    ? mappingDomain === 'BENCH'
      ? 'FLANK'
      : mappingDomain === 'TRENCH'
      ? 'R-TOP'
      : mappingDomain === 'SLOPE'
      ? 'FLANK'
      : 'R-FLANK'
    : 'R-SPL';
  const invertWord = isSurface
    ? mappingDomain === 'BENCH'
      ? 'SUB-GRADE TOE'
      : mappingDomain === 'TRENCH'
      ? 'INVERT FLOOR'
      : mappingDomain === 'SLOPE'
      ? 'TOE CATCH'
      : 'EXPOSURE BASE'
    : 'INVERT';
  const crownWordTitle = isSurface
    ? mappingDomain === 'TRENCH'
      ? 'Floor Width Wt'
      : mappingDomain === 'BENCH'
      ? 'Berm Width Wb'
      : mappingDomain === 'SLOPE'
      ? 'Crest Zone'
      : 'Crest Ledge'
    : 'Crown';
  const heightDimName = isSurface
    ? mappingDomain === 'TRENCH'
      ? 'Depth Dt'
      : mappingDomain === 'BENCH'
      ? 'Bench Height Hb'
      : mappingDomain === 'SLOPE'
      ? 'Slope Height Hs'
      : 'Exposure Height Hr'
    : 'Height';

  const xMaxInt = Math.max(1, Math.floor(panelWidthM + 1e-4));
  const xStepStride = compact && xMaxInt > 8 ? 2 : 1;
  const horizTicks: { m: number; cx: number }[] = [];
  for (let m = 0; m <= xMaxInt; m += xStepStride) {
    const xCoord = orientMeta.xZeroAtStart ? left + m * stepX : right - m * stepX;
    horizTicks.push({ m, cx: xCoord });
  }
  if (horizTicks[horizTicks.length - 1]?.m !== xMaxInt) {
    const xCoord = orientMeta.xZeroAtStart ? left + xMaxInt * stepX : right - xMaxInt * stepX;
    horizTicks.push({ m: xMaxInt, cx: xCoord });
  }

  const yMaxInt = Math.max(1, Math.floor(panelHeightM + 1e-4));
  const yStepStride = compact && yMaxInt > 8 ? 2 : 1;
  const vertTicks: { m: number; cy: number }[] = [];
  for (let m = 0; m <= yMaxInt; m += yStepStride) {
    const yCoord = orientMeta.yZeroAtStart ? top + m * stepY : bottom - m * stepY;
    vertTicks.push({ m, cy: yCoord });
  }
  if (vertTicks[vertTicks.length - 1]?.m !== yMaxInt) {
    const yCoord = orientMeta.yZeroAtStart ? top + yMaxInt * stepY : bottom - yMaxInt * stepY;
    vertTicks.push({ m: yMaxInt, cy: yCoord });
  }

  const driveArrowBadge =
    orientMeta.driveDirectionSide === 'right'
      ? `${driveWordTitle} ${driveStr}° ▶`
      : orientMeta.driveDirectionSide === 'left'
      ? `◀ ${driveWordTitle} ${driveStr}°`
      : orientMeta.driveDirectionSide === 'top'
      ? `▲ ${driveWordTitle} ${driveStr}°`
      : `▼ ${driveWordTitle} ${driveStr}°`;

  const compactScale = Math.max(0.85, Math.min(1.15, Math.min(boxW, boxH) / 260));
  if (compact) {
    const xAxisLabel =
      orientMeta.xAxisKind === 'pull'
        ? orientMeta.xZeroAtStart
          ? `X: ${pullWordTitle} (0–${pullM}m) ▶`
          : `◀ X: ${pullWordTitle} (${pullM}–0m)`
        : activePanel === 'crown'
        ? orientMeta.xZeroAtStart
          ? `X: ${crownWordTitle} (0–${crownLengthM}m)`
          : `X: ${crownWordTitle} (${crownLengthM}–0m)`
        : orientMeta.xZeroAtStart
        ? `X: ${heightDimName} (0–${splHeightM}m)`
        : `X: ${heightDimName} (${splHeightM}–0m)`;

    const yAxisLabel =
      orientMeta.yAxisKind === 'length'
        ? activePanel === 'crown'
          ? orientMeta.yZeroAtStart
            ? `Y: ${crownWordTitle} (0→${crownLengthM}m)`
            : `Y: ${crownWordTitle} (${crownLengthM}→0m)`
          : orientMeta.yZeroAtStart
          ? `Y: ${heightDimName} (0→${splHeightM}m)`
          : `Y: ${heightDimName} (${splHeightM}→0m)`
        : orientMeta.yZeroAtStart
        ? `Y: ${pullWordTitle} (0→${pullM}m) ▼`
        : `▲ Y: ${pullWordTitle} (${pullM}←0m)`;

    const yTicksOnRight = activePanel === 'right_wall';

    return (
      <g className="pointer-events-none select-none" fontFamily="IBM Plex Mono, monospace">
        {/* Panel Title & Transform Status */}
        <text
          x={cx}
          y={top - 22}
          textAnchor="middle"
          fontSize={Math.max(12.5, 14 * compactScale).toFixed(1)}
          fontWeight="900"
          fill={isActivePanel ? '#0284C7' : '#0F172A'}
          stroke={haloColor}
          strokeWidth="3"
          paintOrder="stroke"
        >
          {panelDisplayName}
        </text>

        <text
          x={
            orientMeta.driveDirectionSide === 'left'
              ? left
              : orientMeta.driveDirectionSide === 'right'
              ? right
              : cx
          }
          y={top - 7}
          textAnchor={
            orientMeta.driveDirectionSide === 'left'
              ? 'start'
              : orientMeta.driveDirectionSide === 'right'
              ? 'end'
              : 'middle'
          }
          fontSize={Math.max(11, 12.5 * compactScale).toFixed(1)}
          fontWeight="900"
          fill={driveAzColor}
          stroke={haloColor}
          strokeWidth="2.6"
          paintOrder="stroke"
        >
          {driveArrowBadge}
        </text>

        {horizTicks.map((tk) => (
          <g key={`c-h-${tk.m}`}>
            <line
              x1={tk.cx}
              y1={bottom}
              x2={tk.cx}
              y2={bottom + 5}
              stroke="#0F172A"
              strokeWidth="1.6"
            />
            <text
              x={tk.cx}
              y={bottom + 16}
              textAnchor="middle"
              fontSize={Math.max(10.5, 12 * compactScale).toFixed(1)}
              fontWeight="900"
              fill="#0F172A"
              stroke={haloColor}
              strokeWidth="2.5"
              paintOrder="stroke"
            >
              {tk.m}
            </text>
          </g>
        ))}
        <text
          x={cx}
          y={bottom + 30}
          textAnchor="middle"
          fontSize={Math.max(11, 12.5 * compactScale).toFixed(1)}
          fontWeight="800"
          fill="#334155"
          stroke={haloColor}
          strokeWidth="2.5"
          paintOrder="stroke"
        >
          {xAxisLabel}
        </text>

        {vertTicks.map((tk) => (
          <g key={`c-v-${tk.m}`}>
            <line
              x1={yTicksOnRight ? right : left - 5}
              y1={tk.cy}
              x2={yTicksOnRight ? right + 5 : left}
              y2={tk.cy}
              stroke={activePanel === 'crown' ? accentSplColor : tickColor}
              strokeWidth="1.6"
            />
            <text
              x={yTicksOnRight ? right + 8 : left - 7}
              y={tk.cy + 3.5}
              textAnchor={yTicksOnRight ? 'start' : 'end'}
              fontSize={Math.max(10.5, 12 * compactScale).toFixed(1)}
              fontWeight="800"
              fill={activePanel === 'crown' ? accentSplColor : '#0F172A'}
              stroke={haloColor}
              strokeWidth="2.5"
              paintOrder="stroke"
            >
              {tk.m}
            </text>
          </g>
        ))}
        <text
          x={yTicksOnRight ? right + 22 : left - 20}
          y={cy}
          textAnchor="middle"
          fontSize={Math.max(11, 12.5 * compactScale).toFixed(1)}
          fontWeight="800"
          fill={activePanel === 'crown' ? accentSplColor : tickColor}
          stroke={haloColor}
          strokeWidth="2.5"
          paintOrder="stroke"
          transform={`rotate(${yTicksOnRight ? 90 : -90}, ${
            yTicksOnRight ? right + 22 : left - 20
          }, ${cy})`}
        >
          {yAxisLabel}
        </text>
      </g>
    );
  }

  // Full Single-Panel Mode Labels & Ticks
  const singleFontScale = Math.max(0.85, Math.min(1.15, Math.min(boxW, boxH) / 480));
  const fTick = (12.0 * singleFontScale).toFixed(1);
  const fEdge = (12.5 * singleFontScale).toFixed(1);
  const fTitle = (13.5 * singleFontScale).toFixed(1);

  const horizTitle =
    orientMeta.xAxisKind === 'pull'
      ? orientMeta.xZeroAtStart
        ? `◀ ${oppStr}° — ${pullWord} = ${pullM.toFixed(2)}m (0→${pullM}m) — ${driveWord} ${driveStr}° ▶`
        : `◀ ${driveWord} ${driveStr}° — ${pullWord} = ${pullM.toFixed(2)}m (${pullM}←0m) — ${oppStr}° ▶`
      : activePanel === 'crown'
      ? orientMeta.xZeroAtStart
        ? `${panelDisplayName} WIDTH = ${crownLengthM.toFixed(2)}m (◀ ${splLeftShort} ${String(leftAz).padStart(3, '0')}° · C/L · ${splRightShort} ${String(rightAz).padStart(3, '0')}° ▶)`
        : `${panelDisplayName} WIDTH = ${crownLengthM.toFixed(2)}m (◀ ${splRightShort} ${String(rightAz).padStart(3, '0')}° · C/L · ${splLeftShort} ${String(leftAz).padStart(3, '0')}° ▶)`
      : activePanel === 'left_wall'
      ? orientMeta.xZeroAtStart
        ? `${panelDisplayName} HEIGHT = ${splHeightM.toFixed(2)}m (◀ ${invertWord} 0m / ${splLeftShort} ${splHeightM.toFixed(2)}m ▶)`
        : `${panelDisplayName} HEIGHT = ${splHeightM.toFixed(2)}m (◀ ${splLeftShort} ${splHeightM.toFixed(2)}m / ${invertWord} 0m ▶)`
      : orientMeta.xZeroAtStart
      ? `${panelDisplayName} HEIGHT = ${splHeightM.toFixed(2)}m (◀ ${splRightShort} 0m / ${invertWord} ${splHeightM.toFixed(2)}m ▶)`
      : `${panelDisplayName} HEIGHT = ${splHeightM.toFixed(2)}m (◀ ${invertWord} ${splHeightM.toFixed(2)}m / ${splRightShort} 0m ▶)`;

  const vertTitle =
    orientMeta.yAxisKind === 'pull'
      ? `▲ ${driveWord} ${driveStr}° — ${pullWord} = ${pullM.toFixed(2)}m (${pullM.toFixed(2)}m ← 0m) — ${oppStr}° ▼`
      : activePanel === 'crown'
      ? `${panelDisplayName} WIDTH = ${crownLengthM.toFixed(2)}m (▲ ${splRightShort} ${String(rightAz).padStart(3, '0')}° · C/L · ${splLeftShort} ${String(leftAz).padStart(3, '0')}° ▼)`
      : activePanel === 'left_wall'
      ? `${panelDisplayName} HEIGHT = ${splHeightM.toFixed(2)}m (▲ ${splLeftShort} ${splHeightM.toFixed(2)}m / ▼ ${invertWord} 0m)`
      : `${panelDisplayName} HEIGHT = ${splHeightM.toFixed(2)}m (▲ ${splRightShort} ${splHeightM.toFixed(2)}m / ▼ ${invertWord} 0m)`;

  const topEdgeLabel =
    orientMeta.yAxisKind === 'pull'
      ? `▲ ${driveWord} ${driveStr}° (${pullWord} ${pullM.toFixed(2)}m)`
      : activePanel === 'crown'
      ? `▲ ${splRightWord} (${crownLengthM.toFixed(2)}m)`
      : activePanel === 'left_wall'
      ? `▲ ${splLeftWord} (${splHeightM.toFixed(2)}m)`
      : `▲ ${splRightWord} (${splHeightM.toFixed(2)}m)`;

  const bottomEdgeLabel =
    orientMeta.yAxisKind === 'pull'
      ? `▼ ${pullWord} 0.00m (${oppStr}°)`
      : activePanel === 'crown'
      ? `▼ ${splLeftWord} (0.00m)`
      : `▼ ${invertWord} (0.00m)`;

  return (
    <g className="pointer-events-none select-none" fontFamily="IBM Plex Mono, monospace">
      {/* Top & Bottom 1m Spacing Ticks on Outer Line */}
      {horizTicks.map((tk) => (
        <g key={`h-1m-${tk.m}`}>
          <line
            x1={tk.cx}
            y1={top}
            x2={tk.cx}
            y2={top - 8}
            stroke={tickColor}
            strokeWidth="1.8"
          />
          <line
            x1={tk.cx}
            y1={bottom}
            x2={tk.cx}
            y2={bottom + 8}
            stroke={tickColor}
            strokeWidth="1.8"
          />
          <text
            x={tk.cx}
            y={bottom + 20}
            textAnchor="middle"
            fontSize={fTick}
            fontWeight="700"
            fill={textColor}
            stroke={haloColor}
            strokeWidth="2.8"
            paintOrder="stroke"
          >
            {tk.m}m
          </text>
        </g>
      ))}

      {/* Left & Right 1m Spacing Ticks on Outer Line */}
      {vertTicks.map((tk) => (
        <g key={`v-1m-${tk.m}`}>
          <line
            x1={left}
            y1={tk.cy}
            x2={left - 8}
            y2={tk.cy}
            stroke={tickColor}
            strokeWidth="1.8"
          />
          <line
            x1={right}
            y1={tk.cy}
            x2={right + 8}
            y2={tk.cy}
            stroke={tickColor}
            strokeWidth="1.8"
          />
          <text
            x={left - 12}
            y={tk.cy + 3.5}
            textAnchor="end"
            fontSize={fTick}
            fontWeight="700"
            fill={textColor}
            stroke={haloColor}
            strokeWidth="2.8"
            paintOrder="stroke"
          >
            {tk.m}m
          </text>
        </g>
      ))}

      {/* Crown Center Line (C/L) Callout */}
      {activePanel === 'crown' && (
        !orientMeta.isRotated90 ? (
          <text
            x={cx}
            y={top - 11}
            textAnchor="middle"
            fontSize={fTick}
            fontWeight="900"
            fill={accentCenterColor}
            stroke={haloColor}
            strokeWidth="3"
            paintOrder="stroke"
          >
            ▼ C/L ({(crownLengthM / 2).toFixed(2)}m)
          </text>
        ) : (
          <text
            x={right + 12}
            y={cy + 3.5}
            textAnchor="start"
            fontSize={fTick}
            fontWeight="900"
            fill={accentCenterColor}
            stroke={haloColor}
            strokeWidth="3"
            paintOrder="stroke"
          >
            ◀ C/L ({(crownLengthM / 2).toFixed(2)}m)
          </text>
        )
      )}

      {/* Top-Left & Bottom-Left Edge Boundary Callouts + Drive Direction Badge */}
      <text
        x={left + 4}
        y={top - 11}
        textAnchor="start"
        fontSize={fEdge}
        fontWeight="800"
        fill={accentSplColor}
        stroke={haloColor}
        strokeWidth="3"
        paintOrder="stroke"
      >
        {topEdgeLabel}
      </text>
      <text
        x={right - 4}
        y={top - 11}
        textAnchor="end"
        fontSize={fEdge}
        fontWeight="800"
        fill={driveAzColor}
        stroke={haloColor}
        strokeWidth="3"
        paintOrder="stroke"
      >
        {driveArrowBadge}
      </text>
      <text
        x={left + 4}
        y={bottom + 33}
        textAnchor="start"
        fontSize={fEdge}
        fontWeight="800"
        fill={accentSplColor}
        stroke={haloColor}
        strokeWidth="3"
        paintOrder="stroke"
      >
        {bottomEdgeLabel}
      </text>

      {/* Top Outer Length & Center Callout */}
      <text
        x={cx}
        y={top - 25}
        textAnchor="middle"
        fontSize={fTitle}
        fontWeight="800"
        fill={accentCenterColor}
        stroke={haloColor}
        strokeWidth="3"
        paintOrder="stroke"
      >
        {horizTitle}
      </text>

      {/* Left & Right Vertical Length Callouts */}
      <text
        x={left - 34}
        y={cy}
        textAnchor="middle"
        fontSize={fEdge}
        fontWeight="800"
        fill={tickColor}
        stroke={haloColor}
        strokeWidth="3"
        paintOrder="stroke"
        transform={`rotate(-90, ${left - 34}, ${cy})`}
      >
        {vertTitle}
      </text>
      <text
        x={right + 25}
        y={cy}
        textAnchor="middle"
        fontSize={fEdge}
        fontWeight="800"
        fill={tickColor}
        stroke={haloColor}
        strokeWidth="3"
        paintOrder="stroke"
        transform={`rotate(90, ${right + 25}, ${cy})`}
      >
        {vertTitle}
      </text>

      {/* Bottom Summary */}
      <text
        x={cx}
        y={bottom + 46}
        textAnchor="middle"
        fontSize={fEdge}
        fontWeight="800"
        fill={tickColor}
        stroke={haloColor}
        strokeWidth="3"
        paintOrder="stroke"
      >
        {horizTitle}
      </text>
    </g>
  );
};

