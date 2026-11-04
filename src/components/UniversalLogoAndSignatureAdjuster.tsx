import React, { useState, useEffect, useRef } from 'react';
import { Crop, Upload, Check, RotateCcw, Sparkles, ZoomIn, Move, X } from 'lucide-react';
import { LogoOrSignatureCropConfig } from '../engine/fieldMappingEngine';

export const DEFAULT_LOGO_CROP_CONFIG: LogoOrSignatureCropConfig = {
  cropTopPct: 0,
  cropBottomPct: 0,
  cropLeftPct: 0,
  cropRightPct: 0,
  zoomPct: 100,
  offsetX: 0,
  offsetY: 0,
  fitMode: 'contain',
};

/**
 * Renders a cropped, scaled, panned, and fitted PNG DataURL from a source image DataURL.
 * Preserves full alpha transparency so logos and PNG signatures sit cleanly without boxes.
 */
export async function renderCroppedLogoOrSignatureDataUrl(
  rawDataUrl: string,
  config: LogoOrSignatureCropConfig,
  targetW = 440,
  targetH = 128
): Promise<string> {
  return new Promise((resolve) => {
    if (!rawDataUrl) {
      resolve('');
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const cropL = Math.max(0, Math.min(45, config.cropLeftPct || 0)) / 100;
        const cropR = Math.max(0, Math.min(45, config.cropRightPct || 0)) / 100;
        const cropT = Math.max(0, Math.min(45, config.cropTopPct || 0)) / 100;
        const cropB = Math.max(0, Math.min(45, config.cropBottomPct || 0)) / 100;

        const sx = Math.round(img.width * cropL);
        const sy = Math.round(img.height * cropT);
        const sw = Math.max(1, Math.round(img.width * (1 - cropL - cropR)));
        const sh = Math.max(1, Math.round(img.height * (1 - cropT - cropB)));

        const zoom = Math.max(0.2, Math.min(3.5, (config.zoomPct || 100) / 100));
        const offX = ((config.offsetX || 0) / 100) * targetW;
        const offY = ((config.offsetY || 0) / 100) * targetH;

        let baseW = targetW;
        let baseH = targetH;

        if (config.fitMode === 'stretch') {
          baseW = targetW;
          baseH = targetH;
        } else if (config.fitMode === 'cover') {
          const scale = Math.max(targetW / sw, targetH / sh);
          baseW = sw * scale;
          baseH = sh * scale;
        } else {
          // contain (default)
          const scale = Math.min(targetW / sw, targetH / sh);
          baseW = sw * scale;
          baseH = sh * scale;
        }

        const dw = baseW * zoom;
        const dh = baseH * zoom;
        const dx = (targetW - dw) / 2 + offX;
        const dy = (targetH - dh) / 2 + offY;

        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

/**
 * Automatically detects excess transparent or near-white margins around a logo/signature
 * and returns optimal crop percentages (0..45%).
 */
export async function detectAutoTrimCropPercentages(
  rawDataUrl: string
): Promise<Pick<LogoOrSignatureCropConfig, 'cropTopPct' | 'cropBottomPct' | 'cropLeftPct' | 'cropRightPct'>> {
  return new Promise((resolve) => {
    const fallback = { cropTopPct: 0, cropBottomPct: 0, cropLeftPct: 0, cropRightPct: 0 };
    if (!rawDataUrl) {
      resolve(fallback);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = Math.min(500, img.width);
        const h = Math.min(500, img.height);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        if (!ctx) {
          resolve(fallback);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);

        let minX = w;
        let maxX = 0;
        let minY = h;
        let maxY = 0;
        let found = false;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            const isTransparent = a < 25;
            const isNearWhite = a >= 25 && r > 244 && g > 244 && b > 244;
            if (!isTransparent && !isNearWhite) {
              found = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (!found || maxX <= minX || maxY <= minY) {
          resolve(fallback);
          return;
        }

        const padX = Math.round(w * 0.02);
        const padY = Math.round(h * 0.02);
        const cropLeftPct = Math.min(45, Math.max(0, Math.floor(((minX - padX) / w) * 100)));
        const cropRightPct = Math.min(45, Math.max(0, Math.floor(((w - 1 - maxX - padX) / w) * 100)));
        const cropTopPct = Math.min(45, Math.max(0, Math.floor(((minY - padY) / h) * 100)));
        const cropBottomPct = Math.min(45, Math.max(0, Math.floor(((h - 1 - maxY - padY) / h) * 100)));

        resolve({ cropTopPct, cropBottomPct, cropLeftPct, cropRightPct });
      } catch {
        resolve(fallback);
      }
    };
    img.onerror = () => resolve(fallback);
    img.src = rawDataUrl;
  });
}

// ============================================================================
// INTERACTIVE MODAL: CROP & FIT LOGO OR PNG SIGNATURE TO BOX
// ============================================================================
export const UniversalImageCropAndFitModal: React.FC<{
  isOpen: boolean;
  title: string;
  mode: 'logo' | 'signature';
  initialRawDataUrl: string;
  initialCropConfig?: LogoOrSignatureCropConfig;
  onApply: (croppedDataUrl: string, rawDataUrl: string, cropConfig: LogoOrSignatureCropConfig) => void;
  onClear?: () => void;
  onClose: () => void;
}> = ({
  isOpen,
  title,
  mode,
  initialRawDataUrl,
  initialCropConfig,
  onApply,
  onClear,
  onClose,
}) => {
  const [rawDataUrl, setRawDataUrl] = useState<string>(initialRawDataUrl || '');
  const [config, setConfig] = useState<LogoOrSignatureCropConfig>(
    initialCropConfig || DEFAULT_LOGO_CROP_CONFIG
  );
  const [previewUrl, setPreviewUrl] = useState<string>(initialRawDataUrl || '');
  const dragStateRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  const targetW = mode === 'logo' ? 440 : 420;
  const targetH = mode === 'logo' ? 120 : 120;

  useEffect(() => {
    if (isOpen) {
      setRawDataUrl(initialRawDataUrl || '');
      setConfig(initialCropConfig || DEFAULT_LOGO_CROP_CONFIG);
    }
  }, [isOpen, initialRawDataUrl, initialCropConfig]);

  useEffect(() => {
    let cancelled = false;
    if (!rawDataUrl) {
      setPreviewUrl('');
      return;
    }
    renderCroppedLogoOrSignatureDataUrl(rawDataUrl, config, targetW, targetH).then((res) => {
      if (!cancelled) setPreviewUrl(res);
    });
    return () => {
      cancelled = true;
    };
  }, [rawDataUrl, config, targetW, targetH]);

  if (!isOpen) return null;

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const nextRaw = String(reader.result || '');
      setRawDataUrl(nextRaw);
      const trimmed = await detectAutoTrimCropPercentages(nextRaw);
      setConfig({
        ...DEFAULT_LOGO_CROP_CONFIG,
        ...trimmed,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAutoTrim = async () => {
    if (!rawDataUrl) return;
    const trimmed = await detectAutoTrimCropPercentages(rawDataUrl);
    setConfig((prev) => ({
      ...prev,
      ...trimmed,
      offsetX: 0,
      offsetY: 0,
    }));
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/75 flex items-center justify-center p-3 print:hidden"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-2 border-amber-500/60 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crop className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-black uppercase tracking-wider text-amber-400">
              {title}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 max-h-[82vh] overflow-y-auto">
          {/* Upload / Auto-Trim / Reset Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow">
              <Upload className="w-3.5 h-3.5" />
              <span>{rawDataUrl ? 'Change Image / PNG' : 'Upload Image / PNG'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
              />
            </label>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!rawDataUrl}
                onClick={handleAutoTrim}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                title="Automatically crop white/transparent margins around logo or signature"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Crop Margins</span>
              </button>
              <button
                type="button"
                onClick={() => setConfig(DEFAULT_LOGO_CROP_CONFIG)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                title="Reset crop, zoom, and position"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Live Target Box Preview (Drag to Pan) */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-bold text-slate-200 flex items-center gap-1">
                <Move className="w-3.5 h-3.5 text-cyan-400" />
                Live Target Box Preview (Drag inside box to reposition)
              </span>
              <span className="font-mono text-[10px] text-amber-400">
                {mode === 'logo' ? 'Header Logo Box Fit' : 'Borderless Signature Fit'}
              </span>
            </div>

            <div
              onPointerDown={(e) => {
                if (!rawDataUrl) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                dragStateRef.current = {
                  active: true,
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: config.offsetX,
                  origY: config.offsetY,
                };
              }}
              onPointerMove={(e) => {
                if (!dragStateRef.current.active) return;
                const dx = ((e.clientX - dragStateRef.current.startX) / 220) * 100;
                const dy = ((e.clientY - dragStateRef.current.startY) / 80) * 100;
                setConfig((prev) => ({
                  ...prev,
                  offsetX: Math.round(Math.max(-100, Math.min(100, dragStateRef.current.origX + dx))),
                  offsetY: Math.round(Math.max(-100, Math.min(100, dragStateRef.current.origY + dy))),
                }));
              }}
              onPointerUp={() => {
                dragStateRef.current.active = false;
              }}
              className={`w-full h-28 bg-white rounded-lg flex items-center justify-center overflow-hidden select-none cursor-move relative ${
                mode === 'logo'
                  ? 'border-2 border-slate-900 shadow-inner'
                  : 'border border-dashed border-slate-300'
              }`}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Cropped Preview"
                  draggable={false}
                  className="w-full h-full object-contain pointer-events-none"
                />
              ) : (
                <span className="text-xs text-slate-400 font-semibold">
                  No image uploaded yet — click "Upload Image / PNG" above
                </span>
              )}
            </div>
          </div>

          {/* Fit Mode Selector */}
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'contain', label: 'Fit Inside (Contain)' },
                { id: 'cover', label: 'Fill Box (Cover)' },
                { id: 'stretch', label: 'Stretch to Box' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, fitMode: opt.id }))}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                  config.fitMode === opt.id
                    ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Zoom & X/Y Offset Sliders */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div>
              <div className="flex justify-between text-[11px] font-bold mb-1">
                <span className="flex items-center gap-1 text-amber-300">
                  <ZoomIn className="w-3.5 h-3.5" />
                  Zoom / Scale To Fit Box
                </span>
                <span className="font-mono text-white">{config.zoomPct}%</span>
              </div>
              <input
                type="range"
                min={25}
                max={300}
                value={config.zoomPct}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, zoomPct: Number(e.target.value) }))
                }
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[10.5px] font-semibold text-slate-300 mb-0.5">
                  <span>Horizontal Shift (X)</span>
                  <span className="font-mono">{config.offsetX}%</span>
                </div>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={config.offsetX}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, offsetX: Number(e.target.value) }))
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10.5px] font-semibold text-slate-300 mb-0.5">
                  <span>Vertical Shift (Y)</span>
                  <span className="font-mono">{config.offsetY}%</span>
                </div>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={config.offsetY}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, offsetY: Number(e.target.value) }))
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* 4-Edge Crop Sliders (Top, Bottom, Left, Right) */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Edge Crop Trim (Top / Bottom / Left / Right)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[10.5px] text-slate-300 mb-0.5">
                  <span>Crop Left</span>
                  <span className="font-mono">{config.cropLeftPct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={45}
                  value={config.cropLeftPct}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, cropLeftPct: Number(e.target.value) }))
                  }
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10.5px] text-slate-300 mb-0.5">
                  <span>Crop Right</span>
                  <span className="font-mono">{config.cropRightPct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={45}
                  value={config.cropRightPct}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, cropRightPct: Number(e.target.value) }))
                  }
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10.5px] text-slate-300 mb-0.5">
                  <span>Crop Top</span>
                  <span className="font-mono">{config.cropTopPct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={45}
                  value={config.cropTopPct}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, cropTopPct: Number(e.target.value) }))
                  }
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10.5px] text-slate-300 mb-0.5">
                  <span>Crop Bottom</span>
                  <span className="font-mono">{config.cropBottomPct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={45}
                  value={config.cropBottomPct}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, cropBottomPct: Number(e.target.value) }))
                  }
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
          <div>
            {rawDataUrl && onClear && (
              <button
                type="button"
                onClick={() => {
                  onClear();
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 text-xs font-bold cursor-pointer"
              >
                Remove
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!rawDataUrl}
              onClick={async () => {
                const finalUrl = await renderCroppedLogoOrSignatureDataUrl(
                  rawDataUrl,
                  config,
                  targetW,
                  targetH
                );
                onApply(finalUrl || rawDataUrl, rawDataUrl, config);
                onClose();
              }}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply &amp; Fit to Box</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// UNIVERSAL REPORT HEADER LOGO BOX (LEFT CLIENT LOGO / RIGHT CONTRACTOR LOGO)
// ============================================================================
export const ReportHeaderLogoBox: React.FC<{
  side: 'left' | 'right';
  logoDataUrl?: string;
  rawLogoDataUrl?: string;
  cropConfig?: LogoOrSignatureCropConfig;
  fallbackTitle: string;
  onUpdateLogo?: (
    croppedDataUrl: string,
    rawDataUrl: string,
    cropConfig: LogoOrSignatureCropConfig
  ) => void;
  onClearLogo?: () => void;
}> = ({
  side,
  logoDataUrl,
  rawLogoDataUrl,
  cropConfig,
  fallbackTitle,
  onUpdateLogo,
  onClearLogo,
}) => {
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  const handleDirectFileSelect = (file: File | undefined) => {
    if (!file || !onUpdateLogo) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = String(reader.result || '');
      const trimmed = await detectAutoTrimCropPercentages(raw);
      const nextCfg: LogoOrSignatureCropConfig = {
        ...DEFAULT_LOGO_CROP_CONFIG,
        ...trimmed,
      };
      const fitted = await renderCroppedLogoOrSignatureDataUrl(raw, nextCfg, 440, 120);
      onUpdateLogo(fitted || raw, raw, nextCfg);
      setIsCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="relative group w-full h-full flex flex-col items-center justify-center min-h-[30px]">
      {logoDataUrl ? (
        <div
          onClick={() => {
            if (onUpdateLogo) setIsCropModalOpen(true);
          }}
          title={onUpdateLogo ? 'Click to Crop & Adjust Logo to Fit Box' : undefined}
          className={`eswa-logo-fit-box w-full max-w-[116px] h-[32px] mx-auto ${
            onUpdateLogo ? 'cursor-pointer' : ''
          }`}
        >
          <img
            src={logoDataUrl}
            alt={side === 'left' ? 'Client Logo' : 'Contractor Logo'}
            className={`max-h-full max-w-full mx-auto ${
              cropConfig?.fitMode === 'stretch'
                ? 'w-full h-full object-fill'
                : cropConfig?.fitMode === 'cover'
                ? 'w-full h-full object-cover'
                : 'w-auto h-auto object-contain'
            }`}
          />
        </div>
      ) : (
        <div
          onClick={() => {
            if (onUpdateLogo) setIsCropModalOpen(true);
          }}
          className={`text-[9px] font-bold text-slate-950 leading-tight ${
            onUpdateLogo ? 'cursor-pointer hover:underline' : ''
          }`}
          title={onUpdateLogo ? 'Click to upload & crop logo' : undefined}
        >
          {fallbackTitle}
        </div>
      )}

      {/* Interactive Hover / Tap Controls (Hidden in Print & Exports) */}
      {onUpdateLogo && (
        <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity absolute inset-x-0 -bottom-0.5 flex items-center justify-center gap-0.5 bg-white/95 border border-slate-300 rounded px-1 py-0.5 shadow-sm print:hidden z-10">
          <label
            title={`Upload ${side === 'left' ? 'Left (Client)' : 'Right (Contractor)'} Logo`}
            className="text-[7.5px] font-black text-slate-800 hover:text-amber-600 px-1 cursor-pointer flex items-center gap-0.5"
          >
            <span>Logo</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleDirectFileSelect(e.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            onClick={() => setIsCropModalOpen(true)}
            title="Crop & Adjust Logo to Fit Box"
            className="text-[7.5px] font-black text-emerald-700 hover:text-emerald-900 px-1 border-l border-slate-300 cursor-pointer"
          >
            Crop/Fit
          </button>
          {logoDataUrl && onClearLogo && (
            <button
              type="button"
              onClick={onClearLogo}
              title="Remove Logo"
              className="text-[7.5px] font-black text-rose-600 hover:text-rose-800 px-0.5 border-l border-slate-300 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {onUpdateLogo && (
        <UniversalImageCropAndFitModal
          isOpen={isCropModalOpen}
          title={
            side === 'left'
              ? 'Left Header Logo — Crop & Fit to Box'
              : 'Right Header Logo — Crop & Fit to Box'
          }
          mode="logo"
          initialRawDataUrl={rawLogoDataUrl || logoDataUrl || ''}
          initialCropConfig={cropConfig}
          onApply={onUpdateLogo}
          onClear={onClearLogo}
          onClose={() => setIsCropModalOpen(false)}
        />
      )}
    </div>
  );
};

// ============================================================================
// BORDERLESS GEOLOGIST NAME & ADJUSTABLE PNG SIGNATURE ROW
// Preserves exact DOM hierarchy (`div > input:nth-of-type(1)` and `div > input:nth-of-type(2)`)
// with ZERO boxes/borders around Name or Signature.
// ============================================================================
export const ReportBorderlessGeologistSignRow: React.FC<{
  roleLabel: string;
  nameValue: string;
  signValue: string;
  rawSignDataUrl?: string;
  signCropConfig?: LogoOrSignatureCropConfig;
  onNameChange: (nextName: string) => void;
  onSignChange: (
    nextSign: string,
    rawSignDataUrl?: string,
    cropConfig?: LogoOrSignatureCropConfig
  ) => void;
  darkTheme?: boolean;
}> = ({
  roleLabel,
  nameValue,
  signValue,
  rawSignDataUrl,
  signCropConfig,
  onNameChange,
  onSignChange,
  darkTheme = false,
}) => {
  const [isSignCropOpen, setIsSignCropOpen] = useState(false);
  const isImageSign = Boolean(signValue && signValue.startsWith('data:image/'));

  const handleSignFileUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = String(reader.result || '');
      const trimmed = await detectAutoTrimCropPercentages(raw);
      const nextCfg: LogoOrSignatureCropConfig = {
        ...DEFAULT_LOGO_CROP_CONFIG,
        ...trimmed,
      };
      const fitted = await renderCroppedLogoOrSignatureDataUrl(raw, nextCfg, 420, 120);
      onSignChange(fitted || raw, raw, nextCfg);
      setIsSignCropOpen(true);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center justify-between gap-1.5">
      <span
        className={`font-black uppercase shrink-0 ${
          darkTheme ? 'text-slate-200' : 'text-slate-950'
        }`}
      >
        {roleLabel}
      </span>

      {/* input:nth-of-type(1) -> Borderless Geologist Name */}
      <input
        type="text"
        value={nameValue}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Name"
        className={`eswa-borderless-report-input border-0 border-none bg-transparent px-1 py-0 font-bold w-[34%] min-w-0 focus:outline-none shadow-none ${
          darkTheme ? 'text-white' : 'text-slate-950'
        }`}
      />

      <span
        className={`font-bold shrink-0 ${
          darkTheme ? 'text-slate-300' : 'text-slate-900'
        }`}
      >
        Sign:
      </span>

      {/* input:nth-of-type(2) -> Kept in DOM at all times for CSS selector compatibility, borderless */}
      <input
        type="text"
        value={isImageSign ? '' : signValue}
        onChange={(e) => onSignChange(e.target.value)}
        placeholder="Sign"
        className={`eswa-borderless-report-input border-0 border-none bg-transparent px-1 py-0 italic font-semibold w-[20%] min-w-0 focus:outline-none shadow-none ${
          isImageSign ? 'hidden' : ''
        } ${darkTheme ? 'text-amber-300' : 'text-slate-950'}`}
      />

      {/* When PNG signature is uploaded: show borderless PNG signature + Crop/Adjust on click */}
      {isImageSign && (
        <div
          onClick={() => setIsSignCropOpen(true)}
          title="Click to crop, resize, or reposition signature PNG"
          className="eswa-signature-fit-box h-7 min-w-[72px] max-w-[115px] px-0.5 relative shrink-0 cursor-pointer group"
        >
          <img
            src={signValue}
            alt={`${roleLabel} Signature`}
            className="max-h-full max-w-full w-auto h-auto object-contain border-0"
          />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-1.5 right-3 bg-slate-900 text-amber-300 text-[7px] font-bold px-1 rounded print:hidden pointer-events-none">
            Adjust
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSignChange('', '', DEFAULT_LOGO_CROP_CONFIG);
            }}
            title="Clear Signature"
            className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-1 right-0 text-[8px] font-black text-rose-600 print:hidden cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Action Buttons: Upload PNG & Crop/Adjust (Hidden in Print) */}
      <div className="flex items-center gap-0.5 shrink-0 print:hidden">
        {isImageSign && (
          <button
            type="button"
            onClick={() => setIsSignCropOpen(true)}
            title="Crop & Adjust Signature PNG"
            className="px-1 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-[7.5px] font-bold text-emerald-800 cursor-pointer"
          >
            Adjust
          </button>
        )}
        <label
          title="Upload Signature PNG (Transparent or White Background)"
          className="px-1 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[7.5px] font-bold text-slate-700 cursor-pointer shrink-0"
        >
          PNG
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => handleSignFileUpload(e.target.files?.[0])}
          />
        </label>
      </div>

      <UniversalImageCropAndFitModal
        isOpen={isSignCropOpen}
        title={`${roleLabel} Signature — Crop & Adjust PNG`}
        mode="signature"
        initialRawDataUrl={rawSignDataUrl || signValue || ''}
        initialCropConfig={signCropConfig}
        onApply={(croppedUrl, rawUrl, cfg) => onSignChange(croppedUrl, rawUrl, cfg)}
        onClear={() => onSignChange('', '', DEFAULT_LOGO_CROP_CONFIG)}
        onClose={() => setIsSignCropOpen(false)}
      />
    </div>
  );
};
