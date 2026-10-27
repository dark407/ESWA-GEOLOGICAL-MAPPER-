import React, { memo } from 'react';
import {
  StylusTelemetry,
  PalmRejectionMode,
} from '../engine/tabletStylusAndZeroLagEngine';
import {
  PenTool,
  Eraser,
  Compass,
  Layers,
  Sparkles,
  Shield,
  Activity,
  CheckCircle,
  X,
  Crosshair,
  Sliders,
} from 'lucide-react';

export interface RadialMenuItem {
  id: string;
  label: string;
  subLabel?: string;
  icon: React.ReactNode;
  color: string;
  action: () => void;
}

interface StylusHudAndQuickRadialMenuProps {
  telemetry: StylusTelemetry | null;
  cursorScreenPos?: { x: number; y: number } | null;
  applyStylusTiltToDip: boolean;
  onToggleApplyStylusTiltToDip: () => void;
  palmRejectionMode: PalmRejectionMode;
  onChangePalmRejectionMode: (mode: PalmRejectionMode) => void;
  // Radial Menu State
  isRadialMenuOpen?: boolean;
  radialMenuPos: { x: number; y: number } | null;
  onCloseRadialMenu: () => void;
  onSelectRadialAction: (actionId: string) => void;
  activeFeatureType?: string;
  activeJointSet?: string;
  isMiningMode?: boolean;
}

export const StylusHudAndQuickRadialMenu: React.FC<StylusHudAndQuickRadialMenuProps> = memo(
  ({
    telemetry,
    cursorScreenPos = null,
    applyStylusTiltToDip,
    onToggleApplyStylusTiltToDip,
    palmRejectionMode,
    onChangePalmRejectionMode,
    isRadialMenuOpen: isRadialMenuOpenProp,
    radialMenuPos,
    onCloseRadialMenu,
    onSelectRadialAction,
    activeFeatureType = 'joint',
    activeJointSet = 'J1',
    isMiningMode = false,
  }) => {
    const isRadialMenuOpen = isRadialMenuOpenProp ?? Boolean(radialMenuPos);
    const isPen = telemetry?.pointerType === 'pen';
    const isEraser = telemetry?.isEraserTip;
    const hasTilt = Boolean(telemetry?.hasHardwareTilt);
    const pressurePct = Math.round((telemetry?.pressure ?? 0) * 100);

    // Radial Menu Items configuration
    const radialItems: RadialMenuItem[] = [
      {
        id: 'trace_j1',
        label: 'Set J1 Trace',
        subLabel: 'Joint Set 1',
        icon: <PenTool className="w-4 h-4 text-emerald-400" />,
        color: 'border-emerald-500/80 hover:bg-emerald-950/80 text-emerald-300',
        action: () => onSelectRadialAction('trace_j1'),
      },
      {
        id: 'trace_j2',
        label: 'Set J2 Trace',
        subLabel: 'Joint Set 2',
        icon: <PenTool className="w-4 h-4 text-cyan-400" />,
        color: 'border-cyan-500/80 hover:bg-cyan-950/80 text-cyan-300',
        action: () => onSelectRadialAction('trace_j2'),
      },
      {
        id: 'trace_fault',
        label: 'Fault / Shear',
        subLabel: 'Major Discontinuity',
        icon: <Activity className="w-4 h-4 text-rose-400" />,
        color: 'border-rose-500/80 hover:bg-rose-950/80 text-rose-300',
        action: () => onSelectRadialAction('trace_fault'),
      },
      {
        id: 'lithology_contact',
        label: 'Lithology Contact',
        subLabel: 'Rock Unit Boundary',
        icon: <Layers className="w-4 h-4 text-amber-400" />,
        color: 'border-amber-500/80 hover:bg-amber-950/80 text-amber-300',
        action: () => onSelectRadialAction('lithology_contact'),
      },
      {
        id: 'lock_pen_tilt',
        label: applyStylusTiltToDip ? 'Tilt-to-Dip: ON' : 'Lock Dip from Tilt',
        subLabel: hasTilt
          ? `${telemetry?.inferredDipAngle}° / ${telemetry?.inferredDipDirection}°`
          : 'Tilt Stylus for Dip',
        icon: <Compass className="w-4 h-4 text-purple-400" />,
        color: 'border-purple-500/80 hover:bg-purple-950/80 text-purple-300',
        action: () => {
          onToggleApplyStylusTiltToDip();
          onCloseRadialMenu();
        },
      },
      ...(isMiningMode
        ? [
            {
              id: 'channel_sample',
              label: 'Channel Sample',
              subLabel: 'Mining Assay Log',
              icon: <Crosshair className="w-4 h-4 text-yellow-400" />,
              color: 'border-yellow-500/80 hover:bg-yellow-950/80 text-yellow-300',
              action: () => onSelectRadialAction('channel_sample'),
            },
          ]
        : []),
      {
        id: 'eraser_tool',
        label: 'Eraser Tip',
        subLabel: 'Remove Trace',
        icon: <Eraser className="w-4 h-4 text-slate-300" />,
        color: 'border-slate-500/80 hover:bg-slate-800 text-slate-200',
        action: () => onSelectRadialAction('eraser_tool'),
      },
    ];

    return (
      <>
        {/* =========================================================================
            1. HOVER PROTRACTOR CROSSHAIR (Following Stylus Tip)
            ========================================================================= */}

        {/* =========================================================================
            2. HOVER PROTRACTOR CROSSHAIR (Following Stylus Tip)
            ========================================================================= */}
        {cursorScreenPos && isPen && (telemetry?.isHovering || applyStylusTiltToDip) && (
          <div
            className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 will-change-transform"
            style={{
              left: `${cursorScreenPos.x}px`,
              top: `${cursorScreenPos.y}px`,
            }}
          >
            <svg
              width="68"
              height="68"
              viewBox="-34 -34 68 68"
              className="overflow-visible filter drop-shadow-md"
            >
              {/* Outer compass ring */}
              <circle
                cx="0"
                cy="0"
                r="28"
                fill="none"
                stroke="rgba(192, 132, 252, 0.45)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />

              {/* Crosshair ticks */}
              <line x1="-32" y1="0" x2="-22" y2="0" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1" />
              <line x1="22" y1="0" x2="32" y2="0" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1" />
              <line x1="0" y1="-32" x2="0" y2="-22" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1" />
              <line x1="0" y1="22" x2="0" y2="32" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1" />

              {/* Center pointer dot */}
              <circle cx="0" cy="0" r="3.5" fill="#C084FC" stroke="#FFFFFF" strokeWidth="1" />

              {/* 3D Physical Stylus Tilt Direction Arrow */}
              {telemetry && (
                <g transform={`rotate(${telemetry.penAzimuthDeg})`}>
                  {/* Strike Line perpendicular to Dip */}
                  <line
                    x1="-20"
                    y1="0"
                    x2="20"
                    y2="0"
                    stroke="#F59E0B"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  {/* Dip tick pointing in dip azimuth */}
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="24"
                    stroke="#EC4899"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <polygon points="0,26 -4,18 4,18" fill="#EC4899" />
                </g>
              )}

              {/* Real-time Inferred Dip Angle & Direction Label */}
              {telemetry && (
                <text
                  x="0"
                  y="-16"
                  textAnchor="middle"
                  fill="#E9D5FF"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                  className="bg-black/60 px-1"
                >
                  {telemetry.inferredDipAngle}° ∠ {telemetry.inferredDipDirection}°
                </text>
              )}
            </svg>
          </div>
        )}

        {/* =========================================================================
            3. BARREL-BUTTON / LONG-PRESS QUICK RADIAL MENU
            ========================================================================= */}
        {isRadialMenuOpen && radialMenuPos && (
          <div className="fixed inset-0 z-50 pointer-events-auto">
            {/* Backdrop click to dismiss */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-none"
              onClick={onCloseRadialMenu}
            />

            {/* Radial Pie Menu centered at Stylus Tip position */}
            <div
              className="absolute transform -translate-x-1/2 -translate-y-1/2 animate-in fade-in zoom-in-95 duration-100 select-none"
              style={{
                left: `${radialMenuPos.x}px`,
                top: `${radialMenuPos.y}px`,
              }}
            >
              {/* Central hub dismiss button */}
              <div className="relative flex items-center justify-center">
                <button
                  type="button"
                  onClick={onCloseRadialMenu}
                  className="w-12 h-12 rounded-full bg-slate-900 border-2 border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800 shadow-2xl flex items-center justify-center z-10 cursor-pointer active:scale-90 transition-transform"
                  title="Close Radial Menu"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Satellite Radial Buttons arranged in a circle */}
                {radialItems.map((item, index) => {
                  const total = radialItems.length;
                  // Start at top (-90 degrees) and distribute evenly
                  const angleRad = ((index * (360 / total) - 90) * Math.PI) / 180;
                  const radiusPx = 86;
                  const itemX = Math.round(Math.cos(angleRad) * radiusPx);
                  const itemY = Math.round(Math.sin(angleRad) * radiusPx);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        item.action();
                        onCloseRadialMenu();
                      }}
                      className={`absolute w-24 p-2 rounded-xl bg-slate-950/95 border shadow-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 ${item.color}`}
                      style={{
                        transform: `translate(${itemX}px, ${itemY}px) translate(-50%, -50%)`,
                      }}
                    >
                      <div className="p-1 rounded-lg bg-slate-900/80 mb-0.5">
                        {item.icon}
                      </div>
                      <span className="text-[10px] font-bold leading-tight font-mono">
                        {item.label}
                      </span>
                      {item.subLabel && (
                        <span className="text-[8px] text-slate-400 font-mono truncate max-w-[84px]">
                          {item.subLabel}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
);
