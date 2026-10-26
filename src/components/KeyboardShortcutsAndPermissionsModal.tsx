import React, { useEffect, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Command,
  FileCheck,
  FolderOpen,
  HelpCircle,
  Info,
  Keyboard,
  RotateCcw,
  Save,
  Search,
  Shield,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import {
  checkMobilePermissions,
  MobilePermissionsState,
  requestMobileCameraPermission,
} from '../engine/stepBackNavigationEngine';

interface KeyboardShortcutsAndPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'shortcuts' | 'permissions';
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  onToggleFieldMode?: () => void;
  onToggleCompass?: () => void;
}

interface ShortcutItem {
  keys: string[];
  action: string;
  category: 'NAVIGATION' | 'MAPPING' | 'SYSTEM';
  description: string;
}

const SHORTCUT_LIST: ShortcutItem[] = [
  // Navigation & Step Back
  {
    keys: ['Esc'],
    action: 'Step-by-Step Back',
    category: 'NAVIGATION',
    description: 'Close active modal, cancel drawing tool, or step back to previous workflow stage.',
  },
  {
    keys: ['Android Back'],
    action: 'Mobile Step Back',
    category: 'NAVIGATION',
    description: 'Hardware or gesture back button executes step-by-step navigation without exiting.',
  },
  {
    keys: ['1', '2', '3'],
    action: 'Switch Industry Mode',
    category: 'NAVIGATION',
    description: 'Toggle between NATM Conventional (1), TBM Mechanized (2), and Underground Mining (3).',
  },
  {
    keys: ['F'],
    action: 'Toggle Field Mapping',
    category: 'NAVIGATION',
    description: 'Instantly launch or exit full-screen rugged Field Mapping Mode.',
  },
  {
    keys: ['C'],
    action: 'Brunton Geological Compass',
    category: 'NAVIGATION',
    description: 'Open full-screen digital Brunton compass with real-time Dip / Dip Direction attitude.',
  },
  {
    keys: ['N'],
    action: 'Rock Mechanics & Joint 3D',
    category: 'NAVIGATION',
    description: 'Open NATM Rock Mechanics, Q-system & 3D Joint plane kinematic inspector.',
  },

  // Mapping & Tracing
  {
    keys: ['Ctrl', 'Z'],
    action: 'Undo',
    category: 'MAPPING',
    description: 'Undo the last joint trace point, feature line, or classification edit.',
  },
  {
    keys: ['Ctrl', 'Y'],
    action: 'Redo',
    category: 'MAPPING',
    description: 'Redo the previously undone trace or geological annotation.',
  },
  {
    keys: ['Ctrl', 'Shift', 'Z'],
    action: 'Redo (Alternate)',
    category: 'MAPPING',
    description: 'Standard CAD/graphics redo hotkey for Mac/Windows users.',
  },
  {
    keys: ['Space'],
    action: 'Pan / Canvas Center',
    category: 'MAPPING',
    description: 'Hold spacebar to pan and center the tunnel face drawing viewport.',
  },
  {
    keys: ['P'],
    action: 'Photogrammetry Camera',
    category: 'MAPPING',
    description: 'Open smart mobile camera capture and optical orientation calibration.',
  },

  // System & Export
  {
    keys: ['Ctrl', 'S'],
    action: 'Quick Save Draft',
    category: 'SYSTEM',
    description: 'Immediately saves current tunnel mapping state to fast offline storage.',
  },
  {
    keys: ['Ctrl', 'P'],
    action: 'Export / Print PDF',
    category: 'SYSTEM',
    description: 'Generate high-resolution printable engineering log sheet or PDF.',
  },
  {
    keys: ['?'],
    action: 'Show Shortcuts Cheatsheet',
    category: 'SYSTEM',
    description: 'Opens this keyboard shortcuts and device permissions reference modal.',
  },
];

export const KeyboardShortcutsAndPermissionsModal: React.FC<KeyboardShortcutsAndPermissionsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'shortcuts',
}) => {
  const [activeTab, setActiveTab] = useState<'shortcuts' | 'permissions'>(defaultTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [permState, setPermState] = useState<MobilePermissionsState | null>(null);
  const [isTestingCamera, setIsTestingCamera] = useState(false);
  const [cameraTestSuccess, setCameraTestSuccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      void checkMobilePermissions().then(setPermState);
    }
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  const handleTestCamera = async () => {
    setIsTestingCamera(true);
    setCameraTestSuccess(null);
    const ok = await requestMobileCameraPermission();
    setCameraTestSuccess(ok);
    setIsTestingCamera(false);
    const updated = await checkMobilePermissions();
    setPermState(updated);
  };

  const filteredShortcuts = SHORTCUT_LIST.filter(
    (s) =>
      s.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.keys.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-3 backdrop-blur-md animate-fadeIn">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-sky-500/30 bg-slate-900 text-slate-100 shadow-2xl shadow-sky-950/60 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/30">
              {activeTab === 'shortcuts' ? (
                <Keyboard className="h-5 w-5" />
              ) : (
                <Shield className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                {activeTab === 'shortcuts'
                  ? 'Keyboard Shortcuts & Quick Controls'
                  : 'Mobile Permissions & Hardware Access'}
              </h2>
              <p className="text-xs text-slate-400">
                ESWA Geological Mapper • Fast Operation Guide
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 px-5 pt-2">
          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'shortcuts'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Keyboard className="h-3.5 w-3.5" />
            Keyboard Shortcuts
          </button>

          <button
            onClick={() => setActiveTab('permissions')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'permissions'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Camera & File Permissions
            {permState?.camera === 'granted' && (
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'shortcuts' && (
            <>
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search shortcuts (e.g. undo, compass, esc, pan)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Step-by-Step Mobile Back Banner */}
              <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 p-3.5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-sky-500/20 p-1.5 text-sky-400">
                    <RotateCcw className="h-4 w-4" />
                  </div>
                  <div className="text-xs">
                    <span className="font-semibold text-sky-300">
                      Mobile & Desktop Step-by-Step Back Navigation:
                    </span>
                    <p className="mt-1 text-slate-300 leading-relaxed">
                      Pressing <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-sky-300 font-mono text-[11px] border border-slate-700">Esc</kbd> on a keyboard or the Android <strong>hardware / gesture back button</strong> moves backwards step-by-step:
                    </p>
                    <ul className="mt-1.5 list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
                      <li>Closes the top open modal, dialog, or drawer first.</li>
                      <li>Cancels active line tracing or measurement tools.</li>
                      <li>Returns from sub-workspaces (Mining, TBM, Field Mode) to the Main Overview.</li>
                      <li>At the root screen, double-tap back within 2 seconds to exit cleanly.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Shortcut Table */}
              <div className="space-y-2">
                {filteredShortcuts.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 hover:border-slate-700 transition-all"
                  >
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-100">
                          {item.action}
                        </span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                          {item.category}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, ki) => (
                        <kbd
                          key={ki}
                          className="min-w-[28px] text-center rounded-lg border border-slate-700 bg-slate-800/90 px-2 py-1 font-mono text-xs font-semibold text-sky-300 shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'permissions' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-emerald-500/20 p-1.5 text-emerald-400">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-300">
                      Mobile Hardware & Storage Permissions
                    </h3>
                    <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                      ESWA Geological Mapper requires access to your mobile device's camera for tunnel face photogrammetry, and local file storage for importing photos and exporting engineering data sheets (.dat, .dxf, .csv, .pdf).
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Camera Card */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Camera className="h-4 w-4 text-sky-400" />
                        <span className="text-xs font-semibold text-white">Camera Access</span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          permState?.camera === 'granted'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : permState?.camera === 'denied'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {permState?.camera === 'granted'
                          ? 'GRANTED'
                          : permState?.camera === 'denied'
                          ? 'BLOCKED'
                          : 'READY TO PROMPT'}
                      </span>
                    </div>

                    <p className="mt-2 text-[11px] text-slate-400">
                      Used for live tunnel face capture, photogrammetry feature tracing, and optical tilt detection.
                    </p>

                    {cameraTestSuccess === true && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Camera successfully verified!
                      </div>
                    )}
                    {cameraTestSuccess === false && (
                      <div className="mt-2 text-[11px] text-rose-400 leading-tight">
                        Could not access camera stream. If on Android, please enable Camera permission in <em>App Info &gt; Permissions</em>.
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => void handleTestCamera()}
                    disabled={isTestingCamera}
                    className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 active:scale-95 transition-all shadow-md shadow-sky-950"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    {isTestingCamera ? 'Testing Camera...' : 'Test & Grant Camera'}
                  </button>
                </div>

                {/* File Storage Card */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-sky-400" />
                        <span className="text-xs font-semibold text-white">Files & Storage</span>
                      </div>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                        AVAILABLE
                      </span>
                    </div>

                    <p className="mt-2 text-[11px] text-slate-400">
                      Supports direct photo selection, offline SQLite / IndexedDB caching, and native document creation (.dxf, .dat, .csv).
                    </p>

                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-300">
                      <FileCheck className="h-3.5 w-3.5 text-sky-400" />
                      HTML5 File System & Storage Ready
                    </div>
                  </div>

                  <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 active:scale-95 transition-all">
                    <FolderOpen className="h-3.5 w-3.5" />
                    Test File Picker
                    <input
                      type="file"
                      accept="image/*,.dat,.csv,.json,.dxf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          alert(`File access confirmed: ${file.name} (${Math.round(file.size / 1024)} KB)`);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Troubleshooting Tips */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5 text-xs text-slate-400">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-sky-400" />
                  Android Phone Permission Instructions:
                </span>
                <p className="mt-1 text-[11px] leading-relaxed">
                  If your Android device previously denied camera or file permissions, open your phone's <strong>Settings &gt; Apps &gt; ESWA Geological Mapper &gt; Permissions</strong>, and toggle <strong>Camera</strong> and <strong>Photos/Files</strong> to <em>Allow</em>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/80 px-5 py-3">
          <span className="text-[11px] text-slate-400">
            Tip: Press <kbd className="rounded bg-slate-800 px-1 py-0.5 text-sky-300 font-mono text-[10px]">?</kbd> anywhere to open this dialog
          </span>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
