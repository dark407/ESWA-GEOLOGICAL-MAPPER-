import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Code,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  Layers,
  Minimize2,
  Move,
  X,
  Check,
  ChevronUp,
} from 'lucide-react';

export interface InspectedElementData {
  elementId: string;
  windowName: string;
  toolName: string;
  roleName: string;
  actionName: string;
  entityType?: string;
  tagName: string;
  className: string;
  textSnippet: string;
  rect: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  targetElement: HTMLElement;
}

interface ElementInspectorHudProps {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

export const ElementInspectorHud: React.FC<ElementInspectorHudProps> = ({
  isOpen,
  onToggle,
}) => {
  const [hoveredData, setHoveredData] = useState<InspectedElementData | null>(null);
  const [lockedData, setLockedData] = useState<InspectedElementData | null>(null);
  const [copied, setCopied] = useState(false);
  const [hudPosition, setHudPosition] = useState<{ x: number; y: number }>({
    x: 20,
    y: window.innerHeight - 240,
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });
  const hudRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut Alt + I to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        onToggle(!isOpen);
      } else if (e.key === 'Escape' && isOpen) {
        if (lockedData) {
          setLockedData(null);
        } else {
          onToggle(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, lockedData, onToggle]);

  // Extract metadata attributes from an element or its closest semantic ancestor
  const extractElementMetadata = useCallback((el: HTMLElement): InspectedElementData | null => {
    if (!el || el === document.body || el === document.documentElement) return null;
    if (hudRef.current && hudRef.current.contains(el)) return null;

    // Search element or closest ancestor with data-element-id or data-window
    const semanticEl = (el.closest('[data-element-id], [data-window], [data-tool], button, a, input, select') as HTMLElement) || el;
    const windowEl = el.closest('[data-window]') as HTMLElement | null;

    const elementId =
      semanticEl.getAttribute('data-element-id') ||
      semanticEl.id ||
      semanticEl.getAttribute('aria-label') ||
      semanticEl.getAttribute('name') ||
      `${semanticEl.tagName.toLowerCase()}-${semanticEl.className.slice(0, 16).replace(/[^a-zA-Z0-9]/g, '_')}`;

    const windowName =
      semanticEl.getAttribute('data-window') ||
      windowEl?.getAttribute('data-window') ||
      'root-workspace';

    const toolName =
      semanticEl.getAttribute('data-tool') ||
      semanticEl.closest('[data-tool]')?.getAttribute('data-tool') ||
      'general';

    const roleName =
      semanticEl.getAttribute('data-role') ||
      semanticEl.getAttribute('role') ||
      semanticEl.tagName.toLowerCase();

    const actionName =
      semanticEl.getAttribute('data-action') ||
      semanticEl.title ||
      '';

    const entityType = semanticEl.getAttribute('data-entity-type') || undefined;

    const r = semanticEl.getBoundingClientRect();
    const textSnippet = (semanticEl.innerText || semanticEl.textContent || '')
      .trim()
      .slice(0, 40)
      .replace(/\s+/g, ' ');

    return {
      elementId,
      windowName,
      toolName,
      roleName,
      actionName,
      entityType,
      tagName: semanticEl.tagName.toLowerCase(),
      className: semanticEl.className || '',
      textSnippet,
      rect: {
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      },
      targetElement: semanticEl,
    };
  }, []);

  // Hover and click listeners when Inspector is active
  useEffect(() => {
    if (!isOpen) {
      setHoveredData(null);
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (lockedData) return;
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (target) {
        const data = extractElementMetadata(target);
        if (data) {
          setHoveredData(data);
        }
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (hudRef.current && hudRef.current.contains(e.target as Node)) {
        return; // Don't intercept clicks inside the HUD itself
      }

      e.preventDefault();
      e.stopPropagation();

      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (target) {
        const data = extractElementMetadata(target);
        if (data) {
          setLockedData((prev) => (prev?.elementId === data.elementId ? null : data));
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('click', handleClick, true);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('click', handleClick, true);
    };
  }, [isOpen, lockedData, extractElementMetadata]);

  // Dragging HUD panel
  const handleDragMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: hudPosition.x,
      initY: hudPosition.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      setHudPosition({
        x: Math.max(10, Math.min(window.innerWidth - 380, dragStartRef.current.initX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 260, dragStartRef.current.initY + dy)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const activeData = lockedData || hoveredData;

  const handleCopyPromptContext = () => {
    if (!activeData) return;
    const parts = [
      `[Target: ${activeData.elementId}]`,
      `[Window: ${activeData.windowName}]`,
      `[Tool: ${activeData.toolName}]`,
      `[Role: ${activeData.roleName}]`,
    ];
    if (activeData.actionName) parts.push(`[Action: ${activeData.actionName}]`);
    if (activeData.entityType) parts.push(`[Entity: ${activeData.entityType}]`);
    if (activeData.textSnippet) parts.push(`[Text: "${activeData.textSnippet}"]`);

    const snippet = parts.join(' ');
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleHide = () => {
    if (!activeData?.targetElement) return;
    const el = activeData.targetElement;
    if (el.style.display === 'none') {
      el.style.display = '';
    } else {
      el.style.display = 'none';
      setLockedData(null);
      setHoveredData(null);
    }
  };

  const handleInspectParent = () => {
    if (!activeData?.targetElement) return;
    const parent = activeData.targetElement.parentElement;
    if (parent && parent !== document.body) {
      const parentData = extractElementMetadata(parent);
      if (parentData) {
        setLockedData(parentData);
      }
    }
  };

  return (
    <>
      {/* Floating Toggle Pill when HUD is closed */}
      {!isOpen && (
        <button
          onClick={() => onToggle(true)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/90 text-cyan-400 border border-cyan-500/30 rounded-lg shadow-xl hover:bg-slate-800 text-xs font-mono font-medium backdrop-blur transition-all"
          title="Toggle Element Property Inspector (Alt + I)"
          data-element-id="global-btn-element-inspector-toggle"
          data-window="global-workspace"
          data-role="inspector-toggle"
        >
          <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
          <span>Inspect (Alt+I)</span>
        </button>
      )}

      {/* When Inspector is Active */}
      {isOpen && (
        <>
          {/* Active Highlight Bounding Box */}
          {activeData && activeData.rect.width > 0 && (
            <div
              className={`fixed pointer-events-none z-50 border-2 transition-all duration-75 ${
                lockedData
                  ? 'border-amber-400 bg-amber-400/10 shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                  : 'border-cyan-400 bg-cyan-400/10 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
              }`}
              style={{
                top: `${activeData.rect.top}px`,
                left: `${activeData.rect.left}px`,
                width: `${activeData.rect.width}px`,
                height: `${activeData.rect.height}px`,
              }}
            >
              {/* Corner Tag */}
              <div
                className={`absolute -top-6 left-0 px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-t-sm whitespace-nowrap shadow ${
                  lockedData
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-cyan-500 text-slate-950'
                }`}
              >
                {activeData.elementId}
              </div>
            </div>
          )}

          {/* Draggable Inspector HUD Panel */}
          <div
            ref={hudRef}
            className="fixed z-50 w-96 bg-slate-950/95 border border-cyan-500/40 rounded-xl shadow-2xl backdrop-blur-md text-slate-200 overflow-hidden select-none font-sans"
            style={{
              top: `${hudPosition.y}px`,
              left: `${hudPosition.x}px`,
            }}
          >
            {/* Header bar / drag handle */}
            <div
              onMouseDown={handleDragMouseDown}
              className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 cursor-move"
            >
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 font-mono">
                  Element Inspector
                </span>
                {lockedData ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                    LOCKED
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400">
                    LIVE HOVER
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onToggle(false)}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                  title="Close Inspector (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-3 space-y-2.5 text-xs">
              {activeData ? (
                <>
                  <div className="space-y-1.5 font-mono">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400 shrink-0">Element ID:</span>
                      <span className="font-bold text-cyan-300 text-right break-all">
                        {activeData.elementId}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 shrink-0">Window:</span>
                      <span className="text-slate-200 font-medium text-right">
                        {activeData.windowName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 shrink-0">Tool / Category:</span>
                      <span className="text-emerald-400 text-right">
                        {activeData.toolName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 shrink-0">Role / Action:</span>
                      <span className="text-slate-300 text-right">
                        {activeData.roleName} {activeData.actionName ? `(${activeData.actionName})` : ''}
                      </span>
                    </div>

                    {activeData.entityType && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400 shrink-0">Entity Type:</span>
                        <span className="text-amber-300 text-right">
                          {activeData.entityType}
                        </span>
                      </div>
                    )}

                    {activeData.textSnippet && (
                      <div className="pt-1 border-t border-slate-800/80">
                        <div className="text-[11px] text-slate-400">Visible Text:</div>
                        <div className="text-slate-300 italic truncate font-sans">
                          "{activeData.textSnippet}"
                        </div>
                      </div>
                    )}

                    <div className="text-[10px] text-slate-500 pt-1 flex items-center justify-between">
                      <span>Dimensions:</span>
                      <span className="tabular-nums">
                        {Math.round(activeData.rect.width)} × {Math.round(activeData.rect.height)} px
                      </span>
                    </div>
                  </div>

                  {/* Action Toolbar */}
                  <div className="pt-2 border-t border-slate-800 flex items-center gap-1.5">
                    <button
                      onClick={handleCopyPromptContext}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono text-[11px] rounded transition-colors"
                      title="Copy structured metadata snippet for AI Studio edit instructions"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied Context!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy AI Context</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleInspectParent}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                      title="Inspect Parent Window / Container"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={handleToggleHide}
                      className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 rounded border border-slate-700"
                      title="Temporarily Hide Element (Test Removal)"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-4 text-center text-slate-500 font-mono text-xs">
                  Hover over or click any tool, button, or canvas element to inspect its properties.
                </div>
              )}

              <div className="pt-1 text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-900">
                <span>Click element to lock / unlock</span>
                <span>Press Esc to exit</span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};
