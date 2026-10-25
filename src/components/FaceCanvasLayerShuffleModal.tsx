import React from 'react';
import {
  Layers,
  X,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  Paintbrush,
  Pencil,
  Droplets,
  Grid,
  Camera,
  Shield,
  FileSpreadsheet,
} from 'lucide-react';

export type CanvasLayerId =
  | 'photo'
  | 'underlay_grid'
  | 'lithology'
  | 'dip_surfaces'
  | 'features'
  | 'water'
  | 'joints'
  | 'channels'
  | 'design_outline';

export interface CanvasLayerMeta {
  id: CanvasLayerId;
  name: string;
  category: string;
  icon: any;
  description: string;
}

export const CANVAS_LAYERS_REGISTRY: Record<CanvasLayerId, CanvasLayerMeta> = {
  photo: {
    id: 'photo',
    name: 'Tunnel Face Photograph (Underlay)',
    category: 'Imagery',
    icon: Camera,
    description: 'Calibrated photogrammetry and surface texture backdrop',
  },
  underlay_grid: {
    id: 'underlay_grid',
    name: 'SPL & Centerline Coordinate Grid',
    category: 'Geometry',
    icon: Grid,
    description: '1m × 1m metric engineering grid and springline axes',
  },
  lithology: {
    id: 'lithology',
    name: 'Rock Lithology & Vein / Foliation Bands',
    category: 'Geology',
    icon: Paintbrush,
    description: 'Hatched lithological domains, quartz veins, and foliation bands',
  },
  dip_surfaces: {
    id: 'dip_surfaces',
    name: 'Dip Plane Surfaces',
    category: 'Discontinuity',
    icon: Layers,
    description: 'Grouped 3D spatial dip planes with strike/dip annotations',
  },
  features: {
    id: 'features',
    name: 'Geological & Structural Features',
    category: 'Structural',
    icon: Sparkles,
    description: 'Faults, shear zones, fold hinges, contacts, and overbreak cavities',
  },
  water: {
    id: 'water',
    name: 'Water Inflow & Seepage Marks',
    category: 'Hydrogeology',
    icon: Droplets,
    description: 'Damp, wet, dripping, and high-pressure inflow symbols',
  },
  joints: {
    id: 'joints',
    name: 'Discontinuity / Joint Traces & Ticks',
    category: 'Discontinuity',
    icon: Pencil,
    description: 'Mapped joint traces (J1–J5, Bedding, Random) with dip-direction ticks',
  },
  channels: {
    id: 'channels',
    name: 'Face Channel Samples (Mining)',
    category: 'Assay',
    icon: FileSpreadsheet,
    description: 'Geochemical chip/channel sample intervals with grade tags',
  },
  design_outline: {
    id: 'design_outline',
    name: 'Tunnel Design Outline & Dimension Rulers',
    category: 'Geometry',
    icon: Shield,
    description: 'Theoretical profile perimeter, height rulers, and span labels',
  },
};

export const DEFAULT_CANVAS_LAYER_ORDER: CanvasLayerId[] = [
  'photo',
  'underlay_grid',
  'lithology',
  'dip_surfaces',
  'features',
  'water',
  'joints',
  'channels',
  'design_outline',
];

interface FaceCanvasLayerShuffleModalProps {
  isOpen: boolean;
  onClose: () => void;
  layerOrder: CanvasLayerId[];
  layerVisibility: Record<CanvasLayerId, boolean>;
  onChangeLayerOrder: (newOrder: CanvasLayerId[]) => void;
  onToggleLayerVisibility: (layerId: CanvasLayerId) => void;
  onResetDefault: () => void;
}

export const FaceCanvasLayerShuffleModal: React.FC<FaceCanvasLayerShuffleModalProps> = ({
  isOpen,
  onClose,
  layerOrder,
  layerVisibility,
  onChangeLayerOrder,
  onToggleLayerVisibility,
  onResetDefault,
}) => {
  if (!isOpen) return null;

  const handleMoveUp = (idx: number) => {
    if (idx <= 0) return;
    const next = [...layerOrder];
    const temp = next[idx];
    next[idx] = next[idx - 1];
    next[idx - 1] = temp;
    onChangeLayerOrder(next);
  };

  const handleMoveDown = (idx: number) => {
    if (idx >= layerOrder.length - 1) return;
    const next = [...layerOrder];
    const temp = next[idx];
    next[idx] = next[idx + 1];
    next[idx + 1] = temp;
    onChangeLayerOrder(next);
  };

  const applyPreset = (preset: 'joints_top' | 'litho_top' | 'photo_top') => {
    if (preset === 'joints_top') {
      // Put joints & features above lithology
      const order: CanvasLayerId[] = [
        'photo',
        'underlay_grid',
        'lithology',
        'dip_surfaces',
        'water',
        'features',
        'joints',
        'channels',
        'design_outline',
      ];
      onChangeLayerOrder(order);
    } else if (preset === 'litho_top') {
      // Put lithology on top of joints
      const order: CanvasLayerId[] = [
        'photo',
        'underlay_grid',
        'joints',
        'features',
        'water',
        'dip_surfaces',
        'lithology',
        'channels',
        'design_outline',
      ];
      onChangeLayerOrder(order);
    } else if (preset === 'photo_top') {
      // Semi-transparent photo on top
      const order: CanvasLayerId[] = [
        'underlay_grid',
        'lithology',
        'dip_surfaces',
        'features',
        'water',
        'joints',
        'channels',
        'photo',
        'design_outline',
      ];
      onChangeLayerOrder(order);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-indigo-500/60 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-indigo-500/30 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-indigo-300 tracking-tight flex items-center gap-1.5">
                <span>Face Canvas Layers &amp; Z-Order Shuffle</span>
              </h3>
              <p className="text-[10.5px] text-slate-400 font-mono">
                Reorder rendering depth (Bottom to Top) &amp; toggle layer visibility
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-rose-950/80 hover:text-rose-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Shuffle Presets Bar */}
        <div className="p-2.5 bg-slate-950 border-b border-slate-800 shrink-0 flex flex-wrap items-center justify-between gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Quick Presets:</span>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => applyPreset('joints_top')}
              className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-indigo-400 text-indigo-300 cursor-pointer"
              title="Ensure Joint Traces render over Lithology"
            >
              Joints on Top
            </button>
            <button
              type="button"
              onClick={() => applyPreset('litho_top')}
              className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400 text-amber-300 cursor-pointer"
              title="Render Lithology over Joint Traces"
            >
              Lithology on Top
            </button>
            <button
              type="button"
              onClick={onResetDefault}
              className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer"
              title="Reset to default engineering stack"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Default</span>
            </button>
          </div>
        </div>

        {/* Layer List (Bottom layer at top or Top layer at top: Top layer is rendered last / on top) */}
        <div className="p-3 overflow-y-auto no-scrollbar space-y-1.5 flex-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-1 pb-1">
            <span>LAYER NAME &amp; CATEGORY</span>
            <span>DEPTH ORDER (▲ UP / ▼ DOWN)</span>
          </div>

          {layerOrder.map((layerId, idx) => {
            const meta = CANVAS_LAYERS_REGISTRY[layerId] || {
              id: layerId,
              name: layerId,
              category: 'Layer',
              icon: Layers,
              description: '',
            };
            const Icon = meta.icon;
            const isVisible = layerVisibility[layerId] !== false;
            const isFirst = idx === 0; // Rendered first (at bottom)
            const isLast = idx === layerOrder.length - 1; // Rendered last (on very top)

            return (
              <div
                key={layerId}
                className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                  isVisible
                    ? 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-950/40 border-slate-800/50 opacity-50'
                }`}
              >
                {/* Left: Visibility Eye + Icon + Names */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => onToggleLayerVisibility(layerId)}
                    className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                      isVisible
                        ? 'bg-indigo-950/70 text-indigo-300 border-indigo-500/50'
                        : 'bg-slate-900 text-slate-600 border-slate-800'
                    }`}
                    title={isVisible ? 'Hide layer' : 'Show layer'}
                  >
                    {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>

                  <div className="w-6 h-6 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 shrink-0">
                    <Icon className="w-3.5 h-3.5 text-indigo-400" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-xs text-slate-100 truncate">{meta.name}</h4>
                      <span className="text-[9px] font-mono text-slate-400 px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
                        {meta.category}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{meta.description}</p>
                  </div>
                </div>

                {/* Right: Depth order badge & Up/Down buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="font-mono text-[10px] text-slate-500 w-5 text-right font-bold">
                    #{idx + 1}
                  </span>

                  <button
                    type="button"
                    disabled={isFirst}
                    onClick={() => handleMoveUp(idx)}
                    className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300 hover:text-white border border-slate-800 cursor-pointer"
                    title="Send backward in stack (render earlier)"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    disabled={isLast}
                    onClick={() => handleMoveDown(idx)}
                    className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300 hover:text-white border border-slate-800 cursor-pointer"
                    title="Bring forward in stack (render on top)"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs shrink-0">
          <span className="text-[10.5px] text-slate-400 font-mono">
            Items lower on this list (#9) render on top of items above (#1).
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer transition-colors shadow-sm"
          >
            Apply &amp; Done
          </button>
        </div>
      </div>
    </div>
  );
};
