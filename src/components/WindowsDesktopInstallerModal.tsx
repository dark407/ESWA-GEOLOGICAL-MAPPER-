import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Download,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Terminal,
  ShieldCheck,
  Wifi,
  WifiOff,
  Keyboard,
  X,
  HardDrive,
  Sparkles,
} from 'lucide-react';
import {
  usePWAInstall,
  useOnlineStatus,
  downloadWindowsDesktopExe,
  downloadWindowsInstallerBatchScript,
} from '../engine/windowsDesktopEngine';

interface WindowsDesktopTitlebarProps {
  onOpenInstallerModal: () => void;
  tunnelName?: string;
  chainage?: string;
}

export const WindowsDesktopTitlebar: React.FC<WindowsDesktopTitlebarProps> = ({
  onOpenInstallerModal,
  tunnelName,
  chainage,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <div className="w-full h-8 bg-[#070A0F] border-b border-slate-800/90 px-3 flex items-center justify-between select-none shrink-0 z-40">
      {/* Left: Windows App Branding & Active Document Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-1.5">
          <img src="/icon.svg" alt="ESWA App Icon" className="w-4 h-4 rounded-sm" />
          <span className="font-display font-bold text-[11px] tracking-wider text-slate-200 whitespace-nowrap">
            ESWA TUNNEL MAPPER
          </span>
          <span className="px-1.5 py-0.2 bg-cyan-950/90 text-cyan-300 border border-cyan-700/60 rounded text-[9px] font-mono font-semibold whitespace-nowrap">
            WINDOWS PC x64
          </span>
        </div>

        {tunnelName && (
          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono text-slate-400 truncate border-l border-slate-800 pl-2.5">
            <span className="text-slate-300 truncate">{tunnelName}</span>
            {chainage && <span className="text-cyan-400/90">· {chainage}</span>}
          </div>
        )}
      </div>

      {/* Right: Windows PC .EXE Download, Native Install, Connectivity & Window Controls */}
      <div className="flex items-center gap-1.5">
        {/* Online / Offline Field Cache Status */}
        <div
          className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border ${
            isOnline
              ? 'bg-slate-900/90 text-emerald-400 border-slate-800'
              : 'bg-amber-950/80 text-amber-300 border-amber-700/70'
          }`}
          title={
            isOnline
              ? 'PC Offline Cache Ready — All project data saved locally on your PC'
              : 'Offline Field Mode Active — Running from local PC storage'
          }
        >
          {isOnline ? (
            <>
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span>PC Ready</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-amber-400" />
              <span>Offline Mode</span>
            </>
          )}
        </div>

        {/* Direct 1-Click .EXE Download Button */}
        <button
          type="button"
          onClick={() => downloadWindowsDesktopExe()}
          className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-semibold text-[10px] rounded border border-emerald-400/50 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
          title="Download Native Windows PC Executable (Akash_Tunnel_Mapper_PC.exe)"
        >
          <Download className="w-3 h-3" />
          <span>Download .EXE</span>
        </button>

        {/* Native PWA Desktop Install Button (if supported & not yet running standalone) */}
        {!isInstalled && isInstallable && (
          <button
            type="button"
            onClick={install}
            className="flex items-center gap-1 px-2 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-semibold text-[10px] rounded border border-cyan-400/50 transition-colors cursor-pointer whitespace-nowrap"
            title="Install directly as a Native Windows Desktop App"
          >
            <Monitor className="w-3 h-3" />
            <span>Install App</span>
          </button>
        )}

        {/* Open Full PC Setup & Keyboard Shortcuts Modal */}
        <button
          type="button"
          onClick={onOpenInstallerModal}
          className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white font-mono text-[10px] rounded border border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
          title="Open Windows PC Setup Center, .EXE Installer Options & PC Keyboard Shortcuts"
        >
          <Monitor className="w-3 h-3 text-cyan-400" />
          <span className="hidden sm:inline">PC Setup &amp; .EXE</span>
        </button>

        {/* Fullscreen Window Toggle */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Toggle Fullscreen PC Workspace (F11)"
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
};

interface WindowsDesktopInstallerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WindowsDesktopInstallerModal: React.FC<WindowsDesktopInstallerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [downloadedExe, setDownloadedExe] = useState(false);
  const [downloadedBat, setDownloadedBat] = useState(false);

  if (!isOpen) return null;

  const handleDownloadExe = () => {
    downloadWindowsDesktopExe();
    setDownloadedExe(true);
  };

  const handleDownloadBat = () => {
    downloadWindowsInstallerBatchScript();
    setDownloadedBat(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#0E131D] border border-slate-700 rounded-lg shadow-2xl overflow-hidden font-mono text-xs text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#141C2B] border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <Monitor className="w-4 h-4 text-cyan-400" />
            <span className="font-display font-bold text-sm tracking-wide text-white">
              WINDOWS PC DESKTOP (.EXE) INSTALLER &amp; WORKSTATION SUITE
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Primary Banner */}
          <div className="p-4 bg-gradient-to-r from-cyan-950/60 via-slate-900 to-emerald-950/50 border border-cyan-500/40 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-600 text-white font-bold text-[10px] rounded">
                  READY FOR WINDOWS 10 / 11 (x64 &amp; x86)
                </span>
                {isInstalled && (
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Installed on PC
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-white pt-1">
                ESWA TUNNEL MAPPER — Standalone Windows PC Application
              </h3>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Optimized for Windows PC widescreen monitors, high-precision mouse/CAD wheel zoom,
                keyboard shortcuts, local disk project memory, and A3/A4 engineering sheet printing.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadExe}
              className="shrink-0 flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-md border border-emerald-400 shadow-lg transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Akash_Tunnel_Mapper_PC.exe</span>
            </button>
          </div>

          {/* Zero-Warning & SmartScreen Bypass Guide */}
          <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/50 rounded-lg space-y-2 text-[11px] text-slate-200">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>HOW TO INSTALL ON WINDOWS 10 / 11 WITH ZERO WARNINGS OR BARRIERS</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-0.5">
              <div className="p-2.5 bg-slate-950/90 border border-emerald-700/50 rounded">
                <strong className="text-emerald-300">1. Want 100% Zero Security Prompts?</strong>
                <div className="text-slate-300 mt-0.5">
                  Use <strong>Option 3 (1-Click Direct App Install)</strong> or <strong>Option 2 (.BAT Desktop Setup)</strong> below. Because it uses Edge/Chrome&apos;s verified HTTPS SSL engine, Windows installs it to your Desktop, Start Menu &amp; Taskbar with <strong>zero SmartScreen or Admin prompts</strong>.
                </div>
              </div>
              <div className="p-2.5 bg-slate-950/90 border border-cyan-700/50 rounded">
                <strong className="text-cyan-300">2. Using the Standalone .EXE Installer?</strong>
                <div className="text-slate-300 mt-0.5">
                  Our <code className="text-emerald-300">.EXE</code> installer is configured for <strong>User-Space (No Admin / UAC password required)</strong>. If Windows Defender SmartScreen appears on first launch, simply click <strong>&ldquo;More info&rdquo; → &ldquo;Run anyway&rdquo;</strong>.
                </div>
              </div>
            </div>
          </div>

          {/* 3 Installation Methods Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Option 1: Direct .EXE */}
            <div className="p-3.5 bg-slate-900/90 border border-emerald-500/40 rounded flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700/60 rounded text-[10px] font-bold">
                    OPTION 1 · NATIVE .EXE
                  </span>
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="font-bold text-white text-xs pt-1">
                  Portable Windows .EXE Launcher
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Downloads <strong className="text-slate-200">Akash_Tunnel_Mapper_PC.exe</strong>{' '}
                  (PE32 Windows GUI executable). Double-click on any Windows 10/11 PC to launch in a
                  dedicated maximized desktop window.
                </p>
              </div>

              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={handleDownloadExe}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadedExe ? 'Downloaded .EXE Again' : 'Download .EXE (Windows)'}
                </button>
                {downloadedExe && (
                  <div className="text-[10px] text-emerald-400 text-center">
                    Saved! If Windows SmartScreen prompts, click &quot;More info&quot; → &quot;Run
                    anyway&quot;.
                  </div>
                )}
              </div>
            </div>

            {/* Option 2: Desktop & Start Menu Setup Script (.BAT) */}
            <div className="p-3.5 bg-slate-900/90 border border-cyan-500/40 rounded flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-700/60 rounded text-[10px] font-bold">
                    OPTION 2 · DESKTOP SHORTCUT
                  </span>
                  <Terminal className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="font-bold text-white text-xs pt-1">
                  Windows Desktop &amp; Start Menu Setup
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Downloads{' '}
                  <strong className="text-slate-200">Install_Akash_Tunnel_Mapper_PC.bat</strong>.
                  Automatically creates a Windows Desktop shortcut &amp; Start Menu entry and opens
                  the native PC window.
                </p>
              </div>

              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={handleDownloadBat}
                  className="w-full py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadedBat ? 'Downloaded Setup .BAT' : 'Download Setup Installer (.BAT)'}
                </button>
              </div>
            </div>

            {/* Option 3: 1-Click Direct Windows App Install (PWA) */}
            <div className="p-3.5 bg-slate-900/90 border border-purple-500/40 rounded flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-700/60 rounded text-[10px] font-bold">
                    OPTION 3 · 1-CLICK INSTALL
                  </span>
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div className="font-bold text-white text-xs pt-1">
                  Direct Windows 10/11 App Install
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Installs directly via Microsoft Edge or Google Chrome into Windows Programs,
                  Taskbar &amp; Desktop with full offline Service Worker caching.
                </p>
              </div>

              <div>
                {isInstalled ? (
                  <div className="w-full py-2 px-3 bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 rounded text-center font-semibold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Already Installed on PC
                  </div>
                ) : isInstallable ? (
                  <button
                    type="button"
                    onClick={install}
                    className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    Install to Windows Now
                  </button>
                ) : (
                  <div className="p-2 bg-slate-950 border border-slate-800 rounded text-[10px] text-slate-300">
                    In Chrome/Edge on Windows: click the <strong>Install App icon (+)</strong> in
                    the right side of the address bar (or open in a new tab first).
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Windows PC Mouse & Keyboard Controls Reference */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded space-y-3">
            <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
              <Keyboard className="w-4 h-4" />
              <span>WINDOWS PC CAD MOUSE &amp; KEYBOARD SHORTCUTS</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
              <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                <span className="text-cyan-400 font-bold">Mouse Wheel</span>
                <div className="text-slate-400">Zoom in/out at cursor on tunnel canvas</div>
              </div>
              <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                <span className="text-cyan-400 font-bold">Space + Left Drag</span>
                <div className="text-slate-400">Pan across high-res tunnel photograph</div>
              </div>
              <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                <span className="text-cyan-400 font-bold">Middle Mouse Drag</span>
                <div className="text-slate-400">CAD-style direct canvas panning</div>
              </div>
              <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                <span className="text-cyan-400 font-bold">Ctrl + Z / Ctrl + Y</span>
                <div className="text-slate-400">Undo / Redo joint, lithology &amp; survey edits</div>
              </div>
              <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                <span className="text-cyan-400 font-bold">Delete / Backspace</span>
                <div className="text-slate-400">Delete selected joint, vertex or control point</div>
              </div>
              <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                <span className="text-cyan-400 font-bold">F11</span>
                <div className="text-slate-400">Toggle fullscreen Windows PC CAD workspace</div>
              </div>
            </div>
          </div>

          {/* Offline Electron .EXE Build Note */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded flex items-start gap-2.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-200">
                Included Offline Electron .EXE Builder (For Local Source Packaging):
              </strong>{' '}
              This project also includes <code className="text-cyan-300">electron/main.cjs</code>{' '}
              and <code className="text-cyan-300">BUILD_WINDOWS_EXE.bat</code> in the project root
              to compile a standalone offline x64 Electron executable via{' '}
              <code className="text-cyan-300">electron-builder</code>.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#141C2B] border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Windows 10 / Windows 11 Compatible · Full Offline Project Memory &amp; DXF/PDF/SVG CAD
            Export
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded border border-slate-600 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
