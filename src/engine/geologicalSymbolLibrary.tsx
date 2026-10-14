import React from 'react';
import {
  GeologicalFeatureType,
  GeologicalSymbolType,
  LithologyPatternType,
  OrientationStatus,
  Point2D,
} from '../types/tunnel';

export interface StructuralSymbolMetadata {
  type: GeologicalSymbolType;
  label: string;
  shortCode: string;
  category: 'Discontinuity' | 'Tectonic / Fault' | 'Metamorphic / Bedding' | 'Intrusive / Contact' | 'Hydrogeology / Alteration';
  defaultColor: string;
  sheetColor: string;
  conventionDescription: string;
}

export const STRUCTURAL_GEOLOGICAL_SYMBOLS: StructuralSymbolMetadata[] = [
  {
    type: 'joint',
    label: 'Joint',
    shortCode: 'J',
    category: 'Discontinuity',
    defaultColor: '#38BDF8',
    sheetColor: '#0284C7',
    conventionDescription: 'Strike bar with perpendicular dip direction tick and dip angle',
  },
  {
    type: 'fracture',
    label: 'Fracture',
    shortCode: 'FR',
    category: 'Discontinuity',
    defaultColor: '#60A5FA',
    sheetColor: '#1D4ED8',
    conventionDescription: 'Segmented tension/brittle fracture trace with short cross-ticks',
  },
  {
    type: 'fault',
    label: 'Fault',
    shortCode: 'FLT',
    category: 'Tectonic / Fault',
    defaultColor: '#F43F5E',
    sheetColor: '#DC2626',
    conventionDescription: 'Heavy fault plane bar with opposing slip-sense half-arrows & dip triangle',
  },
  {
    type: 'shear_zone',
    label: 'Shear Zone',
    shortCode: 'SZ',
    category: 'Tectonic / Fault',
    defaultColor: '#FB7185',
    sheetColor: '#BE123C',
    conventionDescription: 'Anastomosing shear boundaries with internal sigmoidal shear fabric',
  },
  {
    type: 'bedding',
    label: 'Bedding',
    shortCode: 'S0',
    category: 'Metamorphic / Bedding',
    defaultColor: '#22D3EE',
    sheetColor: '#0E7490',
    conventionDescription: 'Sedimentary strike line with solid perpendicular dip tick (S0)',
  },
  {
    type: 'foliation',
    label: 'Foliation',
    shortCode: 'S1',
    category: 'Metamorphic / Bedding',
    defaultColor: '#A78BFA',
    sheetColor: '#6D28D9',
    conventionDescription: 'Metamorphic strike bar with open triangular dip tick (S1)',
  },
  {
    type: 'schistosity',
    label: 'Schistosity',
    shortCode: 'SCH',
    category: 'Metamorphic / Bedding',
    defaultColor: '#C084FC',
    sheetColor: '#7E22CE',
    conventionDescription: 'Undulating micaceous foliation double-wave with dip tick',
  },
  {
    type: 'lineation',
    label: 'Lineation',
    shortCode: 'L1',
    category: 'Metamorphic / Bedding',
    defaultColor: '#818CF8',
    sheetColor: '#4338CA',
    conventionDescription: 'Mineral/stretching lineation arrow indicating trend and plunge',
  },
  {
    type: 'cleavage',
    label: 'Cleavage',
    shortCode: 'CLV',
    category: 'Metamorphic / Bedding',
    defaultColor: '#93C5FD',
    sheetColor: '#1E40AF',
    conventionDescription: 'Parallel slaty cleavage strike bar with double perpendicular ticks',
  },
  {
    type: 'fold_axis',
    label: 'Fold Axis',
    shortCode: 'FA',
    category: 'Metamorphic / Bedding',
    defaultColor: '#FBBF24',
    sheetColor: '#B45309',
    conventionDescription: 'Fold axial trace with plunge arrow and opposing limb ticks',
  },
  {
    type: 'anticline',
    label: 'Anticline',
    shortCode: 'ANT',
    category: 'Metamorphic / Bedding',
    defaultColor: '#F59E0B',
    sheetColor: '#B45309',
    conventionDescription: 'Axial trace with diverging arrows pointing away from fold crest',
  },
  {
    type: 'syncline',
    label: 'Syncline',
    shortCode: 'SYN',
    category: 'Metamorphic / Bedding',
    defaultColor: '#D97706',
    sheetColor: '#92400E',
    conventionDescription: 'Axial trace with converging arrows pointing toward fold trough',
  },
  {
    type: 'vein',
    label: 'Vein',
    shortCode: 'VN',
    category: 'Intrusive / Contact',
    defaultColor: '#FDE047',
    sheetColor: '#A16207',
    conventionDescription: 'Double-walled quartz/calcite mineral vein with internal diagonal ticks',
  },
  {
    type: 'dyke',
    label: 'Dyke',
    shortCode: 'DYK',
    category: 'Intrusive / Contact',
    defaultColor: '#94A3B8',
    sheetColor: '#334155',
    conventionDescription: 'Tabular intrusive dyke body with chilled-margin V-symbols',
  },
  {
    type: 'contact',
    label: 'Contact',
    shortCode: 'CNT',
    category: 'Intrusive / Contact',
    defaultColor: '#CBD5E1',
    sheetColor: '#475569',
    conventionDescription: 'Geological boundary contact line with dip tick',
  },
  {
    type: 'lithological_contact',
    label: 'Lithological Contact',
    shortCode: 'LC',
    category: 'Intrusive / Contact',
    defaultColor: '#34D399',
    sheetColor: '#047857',
    conventionDescription: 'Dash-dot lithological boundary separating distinct rock units',
  },
  {
    type: 'discontinuity',
    label: 'Discontinuity',
    shortCode: 'DSC',
    category: 'Discontinuity',
    defaultColor: '#2DD4BF',
    sheetColor: '#0F766E',
    conventionDescription: 'Rock mass structural discontinuity plane with dip vector',
  },
  {
    type: 'slickenside',
    label: 'Slickenside',
    shortCode: 'SLK',
    category: 'Tectonic / Fault',
    defaultColor: '#FB923C',
    sheetColor: '#C2410C',
    conventionDescription: 'Striated slip plane arrow with step sense bar',
  },
  {
    type: 'shear_plane',
    label: 'Shear Plane',
    shortCode: 'SP',
    category: 'Tectonic / Fault',
    defaultColor: '#F87171',
    sheetColor: '#B91C1C',
    conventionDescription: 'Discrete shear slip plane with single shear-sense half-arrow',
  },
  {
    type: 'water_seepage',
    label: 'Water Seepage',
    shortCode: 'W-SP',
    category: 'Hydrogeology / Alteration',
    defaultColor: '#38BDF8',
    sheetColor: '#0369A1',
    conventionDescription: 'Damp/dripping groundwater seepage wave and droplet symbol',
  },
  {
    type: 'water_flow',
    label: 'Water Flow',
    shortCode: 'W-FL',
    category: 'Hydrogeology / Alteration',
    defaultColor: '#0EA5E9',
    sheetColor: '#075985',
    conventionDescription: 'Active groundwater inflow waves with discharge arrow',
  },
  {
    type: 'clay_infill',
    label: 'Clay Infill',
    shortCode: 'CLY',
    category: 'Hydrogeology / Alteration',
    defaultColor: '#D97706',
    sheetColor: '#92400E',
    conventionDescription: 'Discontinuity walls containing soft plastic clay seam hatching',
  },
  {
    type: 'open_joint',
    label: 'Open Joint',
    shortCode: 'OJ',
    category: 'Discontinuity',
    defaultColor: '#F97316',
    sheetColor: '#C2410C',
    conventionDescription: 'Separated parallel joint walls with open aperture arrows',
  },
  {
    type: 'closed_joint',
    label: 'Closed Joint',
    shortCode: 'CJ',
    category: 'Discontinuity',
    defaultColor: '#10B981',
    sheetColor: '#047857',
    conventionDescription: 'Tightly closed joint line with opposing compression arrowheads',
  },
  {
    type: 'weathered_zone',
    label: 'Weathered Zone',
    shortCode: 'WZ',
    category: 'Hydrogeology / Alteration',
    defaultColor: '#EAB308',
    sheetColor: '#A16207',
    conventionDescription: 'Weathered rock zone boundary with standard W-grade alteration symbol',
  },
  {
    type: 'breccia_zone',
    label: 'Breccia Zone',
    shortCode: 'BRX',
    category: 'Tectonic / Fault',
    defaultColor: '#EA580C',
    sheetColor: '#9A3412',
    conventionDescription: 'Angular tectonic breccia clast triangles inside fault/shear zone',
  },
  {
    type: 'crushed_zone',
    label: 'Crushed Zone',
    shortCode: 'CRZ',
    category: 'Tectonic / Fault',
    defaultColor: '#EF4444',
    sheetColor: '#991B1B',
    conventionDescription: 'Cataclastic crushed rock zone cross-hatched diamond mesh',
  },
];

export function getStructuralSymbolMeta(type: GeologicalSymbolType): StructuralSymbolMetadata {
  return (
    STRUCTURAL_GEOLOGICAL_SYMBOLS.find((s) => s.type === type) ||
    STRUCTURAL_GEOLOGICAL_SYMBOLS[0]
  );
}

/**
 * Returns stroke dasharray and visual styling for any traced GeologicalFeatureType (Section 10 & 11).
 */
export function getGeologicalFeatureStrokeStyle(
  featureType: GeologicalFeatureType,
  isLowConf = false
): {
  dashArray?: string;
  isDoubleLine?: boolean;
  isBand?: boolean;
  bandOpacity?: number;
} {
  if (isLowConf) {
    return { dashArray: '4,4' };
  }
  switch (featureType) {
    case 'fault':
    case 'shear':
    case 'shear_zone':
    case 'shear_plane':
    case 'breccia_zone':
    case 'crushed_zone':
      return { dashArray: '12,3,3,3', isBand: true, bandOpacity: 0.22 };
    case 'bedding':
    case 'shale_band':
      return { dashArray: '8,4' };
    case 'foliation':
    case 'schistosity':
    case 'cleavage':
      return { dashArray: '5,3' };
    case 'lithological_contact':
    case 'contact':
      return { dashArray: '10,4,2,4' };
    case 'vein':
    case 'dyke':
    case 'dolerite':
    case 'infilling':
    case 'clay_band':
    case 'clay_infill':
    case 'open_joint':
      return { isDoubleLine: true, isBand: true, bandOpacity: 0.16 };
    case 'water_seepage':
    case 'water_flow':
      return { dashArray: '6,3,2,3' };
    case 'weathered_zone':
      return { dashArray: '4,3', isBand: true, bandOpacity: 0.14 };
    default:
      return {};
  }
}

/**
 * Section 12: Proper Structural Dip / Dip-Direction Orientation Symbol rendered at the midpoint
 * of a traced joint or discontinuity plane.
 * Communicates:
 * - Strike bar orientation
 * - Dip direction tick / triangle
 * - Dip angle & uncertainty (shows '?' or dashed tick when orientation is uncertain)
 */
export const DipDirectionSymbolGlyph: React.FC<{
  midX: number;
  midY: number;
  tangentAngleRad: number;
  dipDeg: number;
  dipDirectionDeg: number;
  featureType: GeologicalFeatureType;
  orientationStatus: OrientationStatus;
  color: string;
  scale?: number;
  forPrintSheet?: boolean;
}> = ({
  midX,
  midY,
  tangentAngleRad,
  featureType,
  orientationStatus,
  color,
  scale = 1,
  forPrintSheet = false,
}) => {
  const isUncertain =
    orientationStatus === 'REQUIRES_CONFIRMATION' ||
    orientationStatus === 'INSUFFICIENT_3D_CONSTRAINT' ||
    orientationStatus === 'APPARENT_ORIENTATION' ||
    orientationStatus === 'ESTIMATED';

  const s = (forPrintSheet ? 0.85 : 1.0) * scale;
  const strikeHalfLen = 11 * s;
  const tickLen = 11.5 * s;

  // Determine which perpendicular side of the trace corresponds to dipDirectionDeg
  const perpRad = tangentAngleRad + Math.PI / 2;
  const sx = Math.cos(tangentAngleRad) * strikeHalfLen;
  const sy = Math.sin(tangentAngleRad) * strikeHalfLen;
  const tx = Math.cos(perpRad) * tickLen;
  const ty = Math.sin(perpRad) * tickLen;

  const isFaultOrShear =
    featureType === 'fault' ||
    featureType === 'shear' ||
    featureType === 'shear_zone' ||
    featureType === 'shear_plane';
  const isFoliationOrSchist =
    featureType === 'foliation' ||
    featureType === 'schistosity' ||
    featureType === 'cleavage';

  return (
    <g className="pointer-events-none">
      {/* Strike reference bar along trace tangent */}
      <line
        x1={midX - sx}
        y1={midY - sy}
        x2={midX + sx}
        y2={midY + sy}
        stroke={color}
        strokeWidth={1.8 * s}
        strokeLinecap="round"
      />

      {/* Dip Direction Tick / Triangle */}
      {isFaultOrShear ? (
        // Filled triangle for Fault / Shear dip direction
        <polygon
          points={`${midX + Math.cos(tangentAngleRad) * 4 * s},${midY + Math.sin(tangentAngleRad) * 4 * s} ${midX - Math.cos(tangentAngleRad) * 4 * s},${midY - Math.sin(tangentAngleRad) * 4 * s} ${midX + tx},${midY + ty}`}
          fill={color}
          fillOpacity={isUncertain ? 0.45 : 0.9}
          stroke={color}
          strokeWidth={1 * s}
        />
      ) : isFoliationOrSchist ? (
        // Open metamorphic foliation triangle tick
        <polygon
          points={`${midX + Math.cos(tangentAngleRad) * 4 * s},${midY + Math.sin(tangentAngleRad) * 4 * s} ${midX - Math.cos(tangentAngleRad) * 4 * s},${midY - Math.sin(tangentAngleRad) * 4 * s} ${midX + tx},${midY + ty}`}
          fill="none"
          stroke={color}
          strokeWidth={1.5 * s}
          strokeDasharray={isUncertain ? '2,2' : undefined}
        />
      ) : (
        // Standard perpendicular dip direction tick + arrowhead
        <>
          <line
            x1={midX}
            y1={midY}
            x2={midX + tx}
            y2={midY + ty}
            stroke={color}
            strokeWidth={1.9 * s}
            strokeDasharray={isUncertain ? '3,2' : undefined}
            strokeLinecap="round"
          />
          <polygon
            points={`${midX + tx},${midY + ty} ${midX + tx * 0.65 - Math.cos(tangentAngleRad) * 2.6 * s},${midY + ty * 0.65 - Math.sin(tangentAngleRad) * 2.6 * s} ${midX + tx * 0.65 + Math.cos(tangentAngleRad) * 2.6 * s},${midY + ty * 0.65 + Math.sin(tangentAngleRad) * 2.6 * s}`}
            fill={color}
          />
        </>
      )}

      {/* Midpoint Anchor Node */}
      <circle
        cx={midX}
        cy={midY}
        r={2.3 * s}
        fill={isUncertain ? '#F59E0B' : color}
      />
    </g>
  );
};

/**
 * Sections 9, 10, 15: Professional Structural Geological Symbol Glyph
 * Renders any of the 27 standard engineering geological symbols centered at (0, 0).
 */
export const StructuralGeologicalSymbolGlyph: React.FC<{
  symbolType: GeologicalSymbolType;
  color: string;
  scale?: number;
  dipDeg?: number;
  uncertainOrientation?: boolean;
}> = ({
  symbolType,
  color,
  scale = 1,
  dipDeg = 65,
  uncertainOrientation = false,
}) => {
  const s = scale;
  const dash = uncertainOrientation ? '3,2' : undefined;

  const renderGlyph = () => {
    switch (symbolType) {
      case 'joint':
      case 'discontinuity':
        return (
          <g>
            {/* Strike Bar */}
            <line x1={-16 * s} y1={0} x2={16 * s} y2={0} stroke={color} strokeWidth={2.2 * s} />
            {/* Perpendicular Dip Direction Tick */}
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={12 * s}
              stroke={color}
              strokeWidth={2 * s}
              strokeDasharray={dash}
            />
            <polygon
              points={`0,${14 * s} ${-3 * s},${9 * s} ${3 * s},${9 * s}`}
              fill={color}
            />
          </g>
        );

      case 'open_joint':
        return (
          <g>
            <line x1={-16 * s} y1={-2.5 * s} x2={16 * s} y2={-2.5 * s} stroke={color} strokeWidth={1.8 * s} />
            <line x1={-16 * s} y1={2.5 * s} x2={16 * s} y2={2.5 * s} stroke={color} strokeWidth={1.8 * s} />
            <line x1={0} y1={2.5 * s} x2={0} y2={12 * s} stroke={color} strokeWidth={1.8 * s} strokeDasharray={dash} />
            <line x1={-6 * s} y1={-6 * s} x2={-6 * s} y2={-2.5 * s} stroke={color} strokeWidth={1.4 * s} />
            <line x1={6 * s} y1={2.5 * s} x2={6 * s} y2={6 * s} stroke={color} strokeWidth={1.4 * s} />
          </g>
        );

      case 'closed_joint':
        return (
          <g>
            <line x1={-16 * s} y1={0} x2={16 * s} y2={0} stroke={color} strokeWidth={2 * s} />
            <polygon points={`0,0 ${-3.5 * s},${-6 * s} ${3.5 * s},${-6 * s}`} fill={color} />
            <polygon points={`0,0 ${-3.5 * s},${6 * s} ${3.5 * s},${6 * s}`} fill={color} />
          </g>
        );

      case 'fracture':
        return (
          <g>
            <polyline
              points={`${-16 * s},${2 * s} ${-5 * s},${-3 * s} ${5 * s},${3 * s} ${16 * s},${-2 * s}`}
              fill="none"
              stroke={color}
              strokeWidth={2 * s}
              strokeDasharray={dash}
            />
            <line x1={0} y1={0} x2={0} y2={10 * s} stroke={color} strokeWidth={1.6 * s} />
          </g>
        );

      case 'fault':
        return (
          <g>
            {/* Heavy Fault Line */}
            <line x1={-18 * s} y1={0} x2={18 * s} y2={0} stroke={color} strokeWidth={2.8 * s} />
            {/* Dextral/Sinistral Slip Half-Arrows */}
            <polyline
              points={`${-10 * s},${-3.5 * s} ${10 * s},${-3.5 * s} ${5 * s},${-8 * s}`}
              fill="none"
              stroke={color}
              strokeWidth={1.6 * s}
            />
            <polyline
              points={`${10 * s},${3.5 * s} ${-10 * s},${3.5 * s} ${-5 * s},${8 * s}`}
              fill="none"
              stroke={color}
              strokeWidth={1.6 * s}
            />
            {/* Dip Triangle */}
            <polygon points={`${-4 * s},0 ${4 * s},0 0,${12 * s}`} fill={color} />
          </g>
        );

      case 'shear_zone':
        return (
          <g>
            <path
              d={`M ${-17 * s} ${-4 * s} Q ${-8 * s} ${-7 * s} 0 ${-4 * s} T ${17 * s} ${-4 * s}`}
              fill="none"
              stroke={color}
              strokeWidth={1.9 * s}
            />
            <path
              d={`M ${-17 * s} ${4 * s} Q ${-8 * s} ${1 * s} 0 ${4 * s} T ${17 * s} ${4 * s}`}
              fill="none"
              stroke={color}
              strokeWidth={1.9 * s}
            />
            {/* Internal S-C Shear Fabric */}
            <line x1={-9 * s} y1={3 * s} x2={-3 * s} y2={-3 * s} stroke={color} strokeWidth={1.4 * s} />
            <line x1={-2 * s} y1={3 * s} x2={4 * s} y2={-3 * s} stroke={color} strokeWidth={1.4 * s} />
            <line x1={5 * s} y1={3 * s} x2={11 * s} y2={-3 * s} stroke={color} strokeWidth={1.4 * s} />
          </g>
        );

      case 'shear_plane':
        return (
          <g>
            <line x1={-17 * s} y1={0} x2={17 * s} y2={0} stroke={color} strokeWidth={2.2 * s} strokeDasharray="8,3" />
            <polyline
              points={`${-8 * s},${-3 * s} ${9 * s},${-3 * s} ${4 * s},${-7.5 * s}`}
              fill="none"
              stroke={color}
              strokeWidth={1.7 * s}
            />
            <line x1={0} y1={0} x2={0} y2={10 * s} stroke={color} strokeWidth={1.8 * s} />
          </g>
        );

      case 'slickenside':
        return (
          <g>
            <line x1={-15 * s} y1={0} x2={15 * s} y2={0} stroke={color} strokeWidth={2.1 * s} />
            <polygon points={`${15 * s},0 ${8 * s},${-4 * s} ${8 * s},${4 * s}`} fill={color} />
            <line x1={-6 * s} y1={-4.5 * s} x2={-6 * s} y2={4.5 * s} stroke={color} strokeWidth={1.6 * s} />
            <line x1={0} y1={-4.5 * s} x2={0} y2={4.5 * s} stroke={color} strokeWidth={1.6 * s} />
          </g>
        );

      case 'bedding':
        return (
          <g>
            <line x1={-16 * s} y1={0} x2={16 * s} y2={0} stroke={color} strokeWidth={2.2 * s} />
            <line x1={0} y1={0} x2={0} y2={11 * s} stroke={color} strokeWidth={2.4 * s} strokeDasharray={dash} />
            <circle cx={0} cy={0} r={2.2 * s} fill={color} />
          </g>
        );

      case 'foliation':
        return (
          <g>
            <line x1={-16 * s} y1={0} x2={16 * s} y2={0} stroke={color} strokeWidth={2 * s} />
            <polygon
              points={`${-4.5 * s},0 ${4.5 * s},0 0,${11 * s}`}
              fill="none"
              stroke={color}
              strokeWidth={1.8 * s}
            />
          </g>
        );

      case 'schistosity':
        return (
          <g>
            <path
              d={`M ${-16 * s} ${-2 * s} Q ${-8 * s} ${-6 * s} 0 ${-2 * s} T ${16 * s} ${-2 * s}`}
              fill="none"
              stroke={color}
              strokeWidth={1.8 * s}
            />
            <path
              d={`M ${-16 * s} ${2.5 * s} Q ${-8 * s} ${-1.5 * s} 0 ${2.5 * s} T ${16 * s} ${2.5 * s}`}
              fill="none"
              stroke={color}
              strokeWidth={1.8 * s}
            />
            <line x1={0} y1={2.5 * s} x2={0} y2={11 * s} stroke={color} strokeWidth={1.8 * s} />
          </g>
        );

      case 'lineation':
        return (
          <g>
            <line x1={-15 * s} y1={0} x2={15 * s} y2={0} stroke={color} strokeWidth={2 * s} />
            <polygon points={`${16 * s},0 ${9 * s},${-4 * s} ${9 * s},${4 * s}`} fill={color} />
            <line x1={-4 * s} y1={-4 * s} x2={-4 * s} y2={4 * s} stroke={color} strokeWidth={1.6 * s} />
          </g>
        );

      case 'cleavage':
        return (
          <g>
            <line x1={-16 * s} y1={0} x2={16 * s} y2={0} stroke={color} strokeWidth={2 * s} />
            <line x1={-3.5 * s} y1={0} x2={-3.5 * s} y2={10 * s} stroke={color} strokeWidth={1.7 * s} />
            <line x1={3.5 * s} y1={0} x2={3.5 * s} y2={10 * s} stroke={color} strokeWidth={1.7 * s} />
          </g>
        );

      case 'fold_axis':
        return (
          <g>
            <line x1={-17 * s} y1={0} x2={17 * s} y2={0} stroke={color} strokeWidth={2.2 * s} />
            <polygon points={`${17 * s},0 ${11 * s},${-3.5 * s} ${11 * s},${3.5 * s}`} fill={color} />
            <path d={`M ${-6 * s} ${-7 * s} Q 0 ${-12 * s} ${6 * s} ${-7 * s}`} fill="none" stroke={color} strokeWidth={1.6 * s} />
          </g>
        );

      case 'anticline':
        return (
          <g>
            <line x1={-16 * s} y1={0} x2={16 * s} y2={0} stroke={color} strokeWidth={2.2 * s} />
            {/* Diverging arrows away from axis */}
            <line x1={0} y1={0} x2={0} y2={-12 * s} stroke={color} strokeWidth={1.7 * s} />
            <polygon points={`0,${-13 * s} ${-3 * s},${-8 * s} ${3 * s},${-8 * s}`} fill={color} />
            <line x1={0} y1={0} x2={0} y2={12 * s} stroke={color} strokeWidth={1.7 * s} />
            <polygon points={`0,${13 * s} ${-3 * s},${8 * s} ${3 * s},${8 * s}`} fill={color} />
          </g>
        );

      case 'syncline':
        return (
          <g>
            <line x1={-16 * s} y1={0} x2={16 * s} y2={0} stroke={color} strokeWidth={2.2 * s} />
            {/* Converging arrows pointing toward axis */}
            <line x1={0} y1={-12 * s} x2={0} y2={-2 * s} stroke={color} strokeWidth={1.7 * s} />
            <polygon points={`0,${-1 * s} ${-3 * s},${-6 * s} ${3 * s},${-6 * s}`} fill={color} />
            <line x1={0} y1={12 * s} x2={0} y2={2 * s} stroke={color} strokeWidth={1.7 * s} />
            <polygon points={`0,${1 * s} ${-3 * s},${6 * s} ${3 * s},${6 * s}`} fill={color} />
          </g>
        );

      case 'vein':
        return (
          <g>
            <rect
              x={-15 * s}
              y={-3.5 * s}
              width={30 * s}
              height={7 * s}
              fill="none"
              stroke={color}
              strokeWidth={1.8 * s}
            />
            <line x1={-9 * s} y1={-3.5 * s} x2={-5 * s} y2={3.5 * s} stroke={color} strokeWidth={1.3 * s} />
            <line x1={-2 * s} y1={-3.5 * s} x2={2 * s} y2={3.5 * s} stroke={color} strokeWidth={1.3 * s} />
            <line x1={5 * s} y1={-3.5 * s} x2={9 * s} y2={3.5 * s} stroke={color} strokeWidth={1.3 * s} />
          </g>
        );

      case 'dyke':
        return (
          <g>
            <rect
              x={-15 * s}
              y={-4 * s}
              width={30 * s}
              height={8 * s}
              fill={color}
              fillOpacity={0.22}
              stroke={color}
              strokeWidth={1.9 * s}
            />
            <polyline points={`${-8 * s},${-2 * s} ${-5 * s},${2 * s} ${-2 * s},${-2 * s}`} fill="none" stroke={color} strokeWidth={1.3 * s} />
            <polyline points={`${2 * s},${-2 * s} ${5 * s},${2 * s} ${8 * s},${-2 * s}`} fill="none" stroke={color} strokeWidth={1.3 * s} />
          </g>
        );

      case 'contact':
      case 'lithological_contact':
        return (
          <g>
            <line
              x1={-16 * s}
              y1={0}
              x2={16 * s}
              y2={0}
              stroke={color}
              strokeWidth={2 * s}
              strokeDasharray={symbolType === 'lithological_contact' ? '6,3,2,3' : undefined}
            />
            <line x1={-7 * s} y1={-4 * s} x2={-7 * s} y2={4 * s} stroke={color} strokeWidth={1.5 * s} />
            <line x1={7 * s} y1={-4 * s} x2={7 * s} y2={4 * s} stroke={color} strokeWidth={1.5 * s} />
          </g>
        );

      case 'water_seepage':
        return (
          <g>
            <path
              d={`M ${-14 * s} ${-2 * s} Q ${-7 * s} ${-7 * s} 0 ${-2 * s} T ${14 * s} ${-2 * s}`}
              fill="none"
              stroke={color}
              strokeWidth={1.9 * s}
            />
            <path
              d={`M 0 ${2 * s} C ${-4 * s} ${7 * s} ${-3 * s} ${11 * s} 0 ${11 * s} C ${3 * s} ${11 * s} ${4 * s} ${7 * s} 0 ${2 * s} Z`}
              fill={color}
            />
          </g>
        );

      case 'water_flow':
        return (
          <g>
            <path
              d={`M ${-14 * s} ${-3 * s} Q ${-7 * s} ${-8 * s} 0 ${-3 * s} T ${14 * s} ${-3 * s}`}
              fill="none"
              stroke={color}
              strokeWidth={1.9 * s}
            />
            <path
              d={`M ${-14 * s} ${2 * s} Q ${-7 * s} ${-3 * s} 0 ${2 * s} T ${14 * s} ${2 * s}`}
              fill="none"
              stroke={color}
              strokeWidth={1.9 * s}
            />
            <line x1={0} y1={3 * s} x2={0} y2={13 * s} stroke={color} strokeWidth={1.9 * s} />
            <polygon points={`0,${14 * s} ${-3.5 * s},${9 * s} ${3.5 * s},${9 * s}`} fill={color} />
          </g>
        );

      case 'clay_infill':
        return (
          <g>
            <line x1={-15 * s} y1={-3.5 * s} x2={15 * s} y2={-3.5 * s} stroke={color} strokeWidth={1.8 * s} />
            <line x1={-15 * s} y1={3.5 * s} x2={15 * s} y2={3.5 * s} stroke={color} strokeWidth={1.8 * s} />
            <line x1={-11 * s} y1={0} x2={11 * s} y2={0} stroke={color} strokeWidth={1.4 * s} strokeDasharray="3,2" />
          </g>
        );

      case 'weathered_zone':
        return (
          <g>
            <polyline
              points={`${-10 * s},${-5 * s} ${-5 * s},${6 * s} 0,${-3 * s} ${5 * s},${6 * s} ${10 * s},${-5 * s}`}
              fill="none"
              stroke={color}
              strokeWidth={2 * s}
            />
          </g>
        );

      case 'breccia_zone':
        return (
          <g>
            <polygon
              points={`${-9 * s},${4 * s} ${-4 * s},${-6 * s} ${1 * s},${4 * s}`}
              fill="none"
              stroke={color}
              strokeWidth={1.7 * s}
            />
            <polygon
              points={`${1 * s},${-4 * s} ${6 * s},${6 * s} ${11 * s},${-4 * s}`}
              fill="none"
              stroke={color}
              strokeWidth={1.7 * s}
            />
          </g>
        );

      case 'crushed_zone':
        return (
          <g>
            <polygon
              points={`0,${-8 * s} ${11 * s},0 0,${8 * s} ${-11 * s},0`}
              fill={color}
              fillOpacity={0.2}
              stroke={color}
              strokeWidth={1.8 * s}
            />
            <line x1={-6 * s} y1={-4 * s} x2={6 * s} y2={4 * s} stroke={color} strokeWidth={1.4 * s} />
            <line x1={-6 * s} y1={4 * s} x2={6 * s} y2={-4 * s} stroke={color} strokeWidth={1.4 * s} />
          </g>
        );
    }
  };

  return (
    <g>
      {renderGlyph()}
      {/* Dip angle readout beside the tick when applicable */}
      <text
        x={5 * s}
        y={13 * s}
        fontSize={8.5 * Math.max(0.8, Math.min(1.3, s))}
        fontWeight="700"
        fontFamily="IBM Plex Mono, monospace"
        fill={color}
      >
        {Math.round(dipDeg)}°{uncertainOrientation ? '?' : ''}
      </text>
    </g>
  );
};

/**
 * Sections 13 & 14: Reusable SVG `<pattern>` definitions for all 25 Lithological Units.
 * Subtle, transparent engineering geology patterns so the underlying photograph remains visible.
 */
export const LithologyPatternDefs: React.FC<{
  prefix: string;
  forPrintSheet?: boolean;
}> = ({ prefix, forPrintSheet = false }) => {
  const op = forPrintSheet ? 0.62 : 0.65;
  return (
    <>
      {/* 1. Granite (+ crosses) */}
      <pattern id={`${prefix}granite`} width="18" height="18" patternUnits="userSpaceOnUse">
        <path d="M 3 5 L 7 5 M 5 3 L 5 7" stroke="#FB7185" strokeWidth="0.9" strokeOpacity={op} />
        <path d="M 12 13 L 16 13 M 14 11 L 14 15" stroke="#FB7185" strokeWidth="0.9" strokeOpacity={op} />
      </pattern>

      {/* 2. Granodiorite (+ crosses and angled ticks) */}
      <pattern id={`${prefix}granodiorite`} width="18" height="18" patternUnits="userSpaceOnUse">
        <path d="M 3 5 L 7 5 M 5 3 L 5 7" stroke="#F43F5E" strokeWidth="0.9" strokeOpacity={op} />
        <line x1="11" y1="14" x2="15" y2="10" stroke="#F43F5E" strokeWidth="0.9" strokeOpacity={op} />
      </pattern>

      {/* 3. Gabbro (coarse V/wedge mafic ticks) */}
      <pattern id={`${prefix}gabbro`} width="16" height="16" patternUnits="userSpaceOnUse">
        <path d="M 3 6 L 6 11 L 9 6" fill="none" stroke="#6366F1" strokeWidth="0.9" strokeOpacity={op} />
        <path d="M 10 3 L 13 7" fill="none" stroke="#6366F1" strokeWidth="0.9" strokeOpacity={op} />
      </pattern>

      {/* 4. Basalt (fine volcanic V-ticks) */}
      <pattern id={`${prefix}basalt`} width="14" height="14" patternUnits="userSpaceOnUse">
        <path d="M 3 10 L 5.5 5 L 8 10" fill="none" stroke="#64748B" strokeWidth="0.85" strokeOpacity={op} />
      </pattern>

      {/* 5. Dolerite (diabase angled dash-ticks) */}
      <pattern id={`${prefix}dolerite`} width="15" height="15" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <line x1="0" y1="4" x2="15" y2="4" stroke="#475569" strokeWidth="0.9" strokeDasharray="4,3" strokeOpacity={op} />
        <line x1="0" y1="11" x2="15" y2="11" stroke="#475569" strokeWidth="0.9" strokeDasharray="4,3" strokeOpacity={op} />
      </pattern>

      {/* 6. Quartzite (crystalline dots + short silica bars) */}
      <pattern id={`${prefix}quartzite`} width="16" height="16" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="1" fill="#CA8A04" fillOpacity={op} />
        <circle cx="12" cy="11" r="1.1" fill="#CA8A04" fillOpacity={op} />
        <line x1="2" y1="13" x2="8" y2="13" stroke="#CA8A04" strokeWidth="0.75" strokeOpacity={op * 0.8} />
      </pattern>

      {/* 7. Sandstone (bedded arena stipple dots) */}
      <pattern id={`${prefix}sandstone`} width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="4" r="0.95" fill="#D97706" fillOpacity={op} />
        <circle cx="10" cy="5" r="0.95" fill="#D97706" fillOpacity={op} />
        <circle cx="7" cy="11" r="0.95" fill="#D97706" fillOpacity={op} />
      </pattern>

      {/* 8. Shale (fine horizontal laminations) */}
      <pattern id={`${prefix}shale`} width="16" height="8" patternUnits="userSpaceOnUse">
        <line x1="0" y1="4" x2="16" y2="4" stroke="#64748B" strokeWidth="0.85" strokeDasharray="5,3" strokeOpacity={op} />
      </pattern>

      {/* 9. Slate (closely spaced oblique slaty cleavage lines) */}
      <pattern id={`${prefix}slate`} width="14" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-15)">
        <line x1="0" y1="3" x2="14" y2="3" stroke="#0284C7" strokeWidth="0.8" strokeOpacity={op} />
        <line x1="3" y1="6.5" x2="11" y2="6.5" stroke="#0284C7" strokeWidth="0.7" strokeOpacity={op * 0.8} />
      </pattern>

      {/* 10. Limestone (standard brick-work carbonate pattern) */}
      <pattern id={`${prefix}limestone`} width="20" height="12" patternUnits="userSpaceOnUse">
        <line x1="0" y1="6" x2="20" y2="6" stroke="#0891B2" strokeWidth="0.8" strokeOpacity={op} />
        <line x1="10" y1="0" x2="10" y2="6" stroke="#0891B2" strokeWidth="0.8" strokeOpacity={op} />
        <line x1="0" y1="6" x2="0" y2="12" stroke="#0891B2" strokeWidth="0.8" strokeOpacity={op} />
      </pattern>

      {/* 11. Marble (interlocking rhombohedral carbonate pattern) */}
      <pattern id={`${prefix}marble`} width="20" height="12" patternUnits="userSpaceOnUse">
        <line x1="0" y1="6" x2="20" y2="6" stroke="#06B6D4" strokeWidth="0.8" strokeOpacity={op} />
        <line x1="6" y1="0" x2="10" y2="6" stroke="#06B6D4" strokeWidth="0.8" strokeOpacity={op} />
        <line x1="14" y1="6" x2="18" y2="12" stroke="#06B6D4" strokeWidth="0.8" strokeOpacity={op} />
      </pattern>

      {/* 12. Dolomite (diagonal-tick carbonate pattern) */}
      <pattern id={`${prefix}dolomite`} width="20" height="12" patternUnits="userSpaceOnUse">
        <line x1="0" y1="6" x2="20" y2="6" stroke="#0D9488" strokeWidth="0.8" strokeOpacity={op} />
        <line x1="8" y1="0" x2="12" y2="6" stroke="#0D9488" strokeWidth="0.8" strokeOpacity={op} />
      </pattern>

      {/* 13. Schist (undulating foliated waves) */}
      <pattern id={`${prefix}schist`} width="18" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-22)">
        <path d="M 0 3 Q 4.5 0 9 3 T 18 3" fill="none" stroke="#7C3AED" strokeWidth="0.85" strokeOpacity={op} />
        <path d="M 0 8 Q 4.5 5 9 8 T 18 8" fill="none" stroke="#7C3AED" strokeWidth="0.65" strokeOpacity={op * 0.75} />
      </pattern>

      {/* 14. Gneiss (discontinuous gneissic banding) */}
      <pattern id={`${prefix}gneiss`} width="20" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-15)">
        <line x1="0" y1="3" x2="12" y2="3" stroke="#DB2777" strokeWidth="1.05" strokeOpacity={op} />
        <line x1="8" y1="9" x2="20" y2="9" stroke="#DB2777" strokeWidth="1.05" strokeOpacity={op} />
      </pattern>

      {/* 15. Phyllite (fine silky crenulated foliation waves) */}
      <pattern id={`${prefix}phyllite`} width="16" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)">
        <path d="M 0 4 Q 4 1.5 8 4 T 16 4" fill="none" stroke="#2563EB" strokeWidth="0.8" strokeOpacity={op} />
      </pattern>

      {/* 16. Quartzitic Phyllite (foliation waves + quartz grains) */}
      <pattern id={`${prefix}quartzitic_phyllite`} width="18" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
        <path d="M 0 5 Q 4.5 2 9 5 T 18 5" fill="none" stroke="#0284C7" strokeWidth="0.8" strokeOpacity={op} />
        <circle cx="9" cy="8" r="0.85" fill="#0284C7" fillOpacity={op} />
      </pattern>

      {/* 17. Conglomerate (rounded gravel clasts + matrix dots) */}
      <pattern id={`${prefix}conglomerate`} width="18" height="18" patternUnits="userSpaceOnUse">
        <circle cx="5" cy="6" r="2.5" fill="none" stroke="#D97706" strokeWidth="0.85" strokeOpacity={op} />
        <circle cx="13" cy="13" r="2.1" fill="none" stroke="#D97706" strokeWidth="0.85" strokeOpacity={op} />
        <circle cx="13" cy="5" r="0.8" fill="#D97706" fillOpacity={op} />
      </pattern>

      {/* 18. Breccia (angular triangular clasts) */}
      <pattern id={`${prefix}breccia`} width="18" height="18" patternUnits="userSpaceOnUse">
        <polygon points="3,12 6,4 10,11" fill="none" stroke="#EA580C" strokeWidth="0.85" strokeOpacity={op} />
        <polygon points="11,15 14,9 17,15" fill="none" stroke="#EA580C" strokeWidth="0.85" strokeOpacity={op} />
      </pattern>

      {/* 19. Clay Zone (soft clay dash-dot seam lines) */}
      <pattern id={`${prefix}clay_zone`} width="14" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-10)">
        <line x1="0" y1="4" x2="14" y2="4" stroke="#B45309" strokeWidth="0.9" strokeDasharray="3,2,1,2" strokeOpacity={op} />
      </pattern>

      {/* 20. Weathered Rock (W-ticks + stipple) */}
      <pattern id={`${prefix}weathered_rock`} width="18" height="14" patternUnits="userSpaceOnUse">
        <polyline points="2,4 4,9 6,5 8,9 10,4" fill="none" stroke="#CA8A04" strokeWidth="0.8" strokeOpacity={op} />
        <circle cx="14" cy="10" r="0.9" fill="#CA8A04" fillOpacity={op} />
      </pattern>

      {/* 21. Highly Weathered Rock (dense W-alteration + clay dashes) */}
      <pattern id={`${prefix}highly_weathered_rock`} width="16" height="12" patternUnits="userSpaceOnUse">
        <polyline points="1,3 3,8 5,4 7,8 9,3" fill="none" stroke="#A16207" strokeWidth="0.85" strokeOpacity={op} />
        <line x1="9" y1="10" x2="15" y2="10" stroke="#A16207" strokeWidth="0.85" strokeDasharray="2,2" strokeOpacity={op} />
      </pattern>

      {/* 22. Fractured / Crushed Rock (intersecting fracture network) */}
      <pattern id={`${prefix}fractured_crushed_rock`} width="14" height="14" patternUnits="userSpaceOnUse">
        <line x1="0" y1="14" x2="14" y2="0" stroke="#EA580C" strokeWidth="0.8" strokeOpacity={op} />
        <line x1="0" y1="0" x2="14" y2="14" stroke="#EA580C" strokeWidth="0.8" strokeDasharray="3,3" strokeOpacity={op} />
      </pattern>

      {/* 23. Fault Gouge (sheared clay gouge waves + breccia) */}
      <pattern id={`${prefix}fault_gouge`} width="14" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
        <path d="M 0 3 Q 3.5 0 7 3 T 14 3" fill="none" stroke="#DC2626" strokeWidth="0.9" strokeOpacity={op} />
        <line x1="2" y1="8" x2="12" y2="8" stroke="#DC2626" strokeWidth="0.8" strokeDasharray="2,2" strokeOpacity={op} />
      </pattern>

      {/* 24. Shear Zone (sigmoidal shear fabric) */}
      <pattern id={`${prefix}shear_zone`} width="14" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
        <path d="M 0 5 Q 3.5 1 7 5 T 14 5" fill="none" stroke="#EF4444" strokeWidth="0.9" strokeDasharray="3,2" strokeOpacity={op} />
      </pattern>

      {/* 25. User-Defined Custom Lithology */}
      <pattern id={`${prefix}custom_lithology`} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(25)">
        <line x1="0" y1="8" x2="16" y2="8" stroke="#10B981" strokeWidth="0.85" strokeDasharray="5,3" strokeOpacity={op} />
        <circle cx="8" cy="3" r="0.9" fill="#10B981" fillOpacity={op} />
      </pattern>
    </>
  );
};

/**
 * ============================================================================
 * AUTOMATIC NON-OVERLAPPING LABEL PLACEMENT ENGINE (Sections 2, 7, 16)
 * ============================================================================
 * Prevents Control Point labels, Joint orientation callouts, and Symbol labels
 * from overlapping:
 * - tunnel boundary segments
 * - traced joint segments
 * - dimension lines
 * - other control points & previously placed labels
 *
 * When a label's primary offset is occupied, it selects the lowest-penalty candidate
 * position and returns `needsLeader: true` with leader-line coordinates.
 */

export interface LabelObstacleBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LabelObstacleSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PlacedLabelResult {
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  anchorX: number;
  anchorY: number;
  leaderTargetX: number;
  leaderTargetY: number;
  needsLeader: boolean;
}

function boxesOverlap(a: LabelObstacleBox, b: LabelObstacleBox, pad = 3): boolean {
  return !(
    a.x + a.width + pad < b.x ||
    b.x + b.width + pad < a.x ||
    a.y + a.height + pad < b.y ||
    b.y + b.height + pad < a.y
  );
}

function segmentIntersectsBox(seg: LabelObstacleSegment, box: LabelObstacleBox): boolean {
  // Sample 5 points along segment for fast, deterministic box intersection test
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    const px = seg.x1 + (seg.x2 - seg.x1) * t;
    const py = seg.y1 + (seg.y2 - seg.y1) * t;
    if (
      px >= box.x - 2 &&
      px <= box.x + box.width + 2 &&
      py >= box.y - 2 &&
      py <= box.y + box.height + 2
    ) {
      return true;
    }
  }
  return false;
}

export function computeNonOverlappingLabelPlacement(params: {
  anchorX: number;
  anchorY: number;
  boxW: number;
  boxH: number;
  occupiedBoxes: LabelObstacleBox[];
  obstacleSegments: LabelObstacleSegment[];
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
}): PlacedLabelResult {
  const { anchorX, anchorY, boxW, boxH, occupiedBoxes, obstacleSegments, bounds } = params;

  // 12 candidate offset positions around (anchorX, anchorY), ordered from closest to extended leader offsets
  const candidates: { dx: number; dy: number; isExtended: boolean }[] = [
    { dx: 12, dy: -boxH - 6, isExtended: false },               // 1. Top-Right (default)
    { dx: 12, dy: 8, isExtended: false },                       // 2. Bottom-Right
    { dx: -boxW - 12, dy: -boxH - 6, isExtended: false },       // 3. Top-Left
    { dx: -boxW - 12, dy: 8, isExtended: false },               // 4. Bottom-Left
    { dx: 14, dy: -boxH / 2, isExtended: false },               // 5. Right-Center
    { dx: -boxW - 14, dy: -boxH / 2, isExtended: false },       // 6. Left-Center
    { dx: -boxW / 2, dy: -boxH - 14, isExtended: true },        // 7. Top-Center
    { dx: -boxW / 2, dy: 14, isExtended: true },                // 8. Bottom-Center
    { dx: 28, dy: -boxH - 22, isExtended: true },               // 9. Extended Top-Right
    { dx: 28, dy: 22, isExtended: true },                       // 10. Extended Bottom-Right
    { dx: -boxW - 28, dy: -boxH - 22, isExtended: true },       // 11. Extended Top-Left
    { dx: -boxW - 28, dy: 22, isExtended: true },               // 12. Extended Bottom-Left
  ];

  let bestCandidate = candidates[0];
  let bestPenalty = Infinity;
  let bestBox: LabelObstacleBox = {
    x: anchorX + candidates[0].dx,
    y: anchorY + candidates[0].dy,
    width: boxW,
    height: boxH,
  };

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    let bx = anchorX + c.dx;
    let by = anchorY + c.dy;

    let outOfBoundsPenalty = 0;
    if (bounds) {
      if (bx < bounds.minX || bx + boxW > bounds.maxX || by < bounds.minY || by + boxH > bounds.maxY) {
        outOfBoundsPenalty = 500;
      }
      bx = Math.max(bounds.minX, Math.min(bounds.maxX - boxW, bx));
      by = Math.max(bounds.minY, Math.min(bounds.maxY - boxH, by));
    }

    const candidateBox: LabelObstacleBox = {
      x: bx,
      y: by,
      width: boxW,
      height: boxH,
    };

    let penalty = i * 2 + outOfBoundsPenalty;

    // Penalize overlapping already-placed labels or point markers heavily
    for (const occ of occupiedBoxes) {
      if (boxesOverlap(candidateBox, occ, 4)) {
        penalty += 120;
      }
    }

    // Penalize overlapping tunnel boundary / joint traces / dimension lines
    for (const seg of obstacleSegments) {
      if (segmentIntersectsBox(seg, candidateBox)) {
        penalty += 35;
      }
    }

    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestCandidate = c;
      bestBox = candidateBox;
      if (penalty <= 2) break; // Found a completely clear close position!
    }
  }

  // Compute nearest point on bestBox perimeter to (anchorX, anchorY) for crisp leader line
  const clampedTargetX = Math.max(bestBox.x, Math.min(bestBox.x + bestBox.width, anchorX));
  const clampedTargetY = Math.max(bestBox.y, Math.min(bestBox.y + bestBox.height, anchorY));
  const distToBox = Math.hypot(clampedTargetX - anchorX, clampedTargetY - anchorY);

  return {
    boxX: Number(bestBox.x.toFixed(1)),
    boxY: Number(bestBox.y.toFixed(1)),
    boxW,
    boxH,
    anchorX,
    anchorY,
    leaderTargetX: Number(clampedTargetX.toFixed(1)),
    leaderTargetY: Number(clampedTargetY.toFixed(1)),
    needsLeader: bestCandidate.isExtended || distToBox > 14,
  };
}
