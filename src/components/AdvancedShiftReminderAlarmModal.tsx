import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Clock,
  AlarmClock,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  X,
  Volume2,
  VolumeX,
  ShieldAlert,
  Flame,
  HardHat,
  Timer,
} from 'lucide-react';

export interface ShiftAlarmItem {
  id: string;
  title: string;
  category: 'safety' | 'shotcrete' | 'ventilation' | 'cycle' | 'convergence' | 'general';
  triggerTimestamp: number; // Unix timestamp ms
  originalDurationSeconds: number;
  priority: 'normal' | 'critical';
  soundEnabled: boolean;
  status: 'running' | 'paused' | 'ringing' | 'dismissed';
  notes?: string;
}

interface AdvancedShiftReminderAlarmModalProps {
  isOpen: boolean;
  onClose: () => void;
  industryMode?: 'NATM' | 'TBM' | 'MINING';
}

const STORAGE_KEY = 'eswa_shift_alarms_v1';

// Web Audio API Synthesizer for gentle yet unmistakable alert chimes
function playChimeSound(type: 'gentle' | 'critical' = 'gentle') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (type === 'critical') {
      // 3-tone urgent alert
      [0, 0.18, 0.36].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(idx === 1 ? 880 : 720, now + delay);
        gain.gain.setValueAtTime(0.25, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.24);
      });
    } else {
      // Pleasant marimba two-tone chime
      const freqs = [523.25, 659.25]; // C5, E5
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);
        gain.gain.setValueAtTime(0.2, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.42);
      });
    }
  } catch (err) {
    console.warn('Audio chime notice:', err);
  }
}

export const AdvancedShiftReminderAlarmModal: React.FC<AdvancedShiftReminderAlarmModalProps> = ({
  isOpen,
  onClose,
  industryMode = 'NATM',
}) => {
  const [alarms, setAlarms] = useState<ShiftAlarmItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'init_shotcrete_1',
        title: 'Shotcrete Re-Entry Safety Window (2-Hour Cure)',
        category: 'shotcrete',
        triggerTimestamp: Date.now() + 2 * 60 * 60 * 1000,
        originalDurationSeconds: 7200,
        priority: 'critical',
        soundEnabled: true,
        status: 'running',
        notes: 'Confirm early compressive strength (J2/J3 curve > 1.0 MPa) before worker entry under newly sprayed crown.',
      },
    ];
  });

  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [newTitle, setNewTitle] = useState('');
  const [newMinutes, setNewMinutes] = useState(45);
  const [newPriority, setNewPriority] = useState<'normal' | 'critical'>('normal');
  const [soundMuted, setSoundMuted] = useState(false);

  // Sync site clock every second and check ringing alarms
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setCurrentTime(new Date());

      setAlarms((prev) => {
        let changed = false;
        const next = prev.map((a) => {
          if (a.status === 'running' && now >= a.triggerTimestamp) {
            changed = true;
            if (!soundMuted && a.soundEnabled) {
              playChimeSound(a.priority === 'critical' ? 'critical' : 'gentle');
            }
            return { ...a, status: 'ringing' as const };
          }
          return a;
        });
        if (changed) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {}
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [soundMuted]);

  // Persist alarms
  const saveAlarms = (list: ShiftAlarmItem[]) => {
    setAlarms(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {}
  };

  const handleCreateQuickPreset = (
    title: string,
    minutes: number,
    category: ShiftAlarmItem['category'],
    priority: 'normal' | 'critical' = 'normal',
    notes = ''
  ) => {
    const newAlarm: ShiftAlarmItem = {
      id: `alarm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title,
      category,
      triggerTimestamp: Date.now() + minutes * 60 * 1000,
      originalDurationSeconds: minutes * 60,
      priority,
      soundEnabled: true,
      status: 'running',
      notes,
    };
    saveAlarms([newAlarm, ...alarms]);
    playChimeSound('gentle');
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const minutes = Math.max(1, newMinutes);
    const newAlarm: ShiftAlarmItem = {
      id: `alarm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: newTitle.trim(),
      category: 'general',
      triggerTimestamp: Date.now() + minutes * 60 * 1000,
      originalDurationSeconds: minutes * 60,
      priority: newPriority,
      soundEnabled: true,
      status: 'running',
    };
    saveAlarms([newAlarm, ...alarms]);
    setNewTitle('');
    setNewMinutes(45);
    playChimeSound('gentle');
  };

  const handleDismiss = (id: string) => {
    saveAlarms(alarms.map((a) => (a.id === id ? { ...a, status: 'dismissed' as const } : a)));
  };

  const handleSnooze = (id: string, extraMinutes = 10) => {
    saveAlarms(
      alarms.map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'running' as const,
              triggerTimestamp: Date.now() + extraMinutes * 60 * 1000,
            }
          : a
      )
    );
    playChimeSound('gentle');
  };

  const handleDelete = (id: string) => {
    saveAlarms(alarms.filter((a) => a.id !== id));
  };

  if (!isOpen) return null;

  // Format remaining seconds into HH:MM:SS
  const formatRemaining = (targetMs: number) => {
    const diffSec = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;
    return `${h > 0 ? `${h}h ` : ''}${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-slate-900 border-2 border-cyan-500/60 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-cyan-500/30 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
              <AlarmClock className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-cyan-300 tracking-tight flex items-center gap-2">
                <span>Underground Shift &amp; Inspection Reminder Center</span>
                <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30">
                  {industryMode} Mode
                </span>
              </h3>
              <p className="text-[10.5px] text-slate-400 font-mono">
                Automated Excavation Cycles, Shotcrete Re-Entry &amp; Monitoring Alarms
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSoundMuted((p) => !p)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title={soundMuted ? 'Unmute Audio Chime' : 'Mute Audio Chime'}
            >
              {soundMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-rose-950/80 hover:text-rose-200 transition-colors cursor-pointer"
              title="Close Reminder Center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-4 overflow-y-auto no-scrollbar space-y-3.5 flex-1">
          {/* Site Digital Clock & Shift Status Bar */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-cyan-400" />
              <div>
                <div className="text-xl sm:text-2xl font-black font-mono text-cyan-300 tracking-wider">
                  {currentTime.toLocaleTimeString([], { hour12: false })}
                </div>
                <div className="text-[10.5px] text-slate-400 font-mono">
                  {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>

            {/* Shift Identifier */}
            <div className="flex items-center gap-2 text-xs">
              <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-right">
                <span className="block text-[9px] text-slate-400 uppercase font-bold">Current Shift</span>
                <span className="font-mono font-bold text-amber-300">
                  {currentTime.getHours() >= 6 && currentTime.getHours() < 14
                    ? 'Shift 1 (Day: 06:00–14:00)'
                    : currentTime.getHours() >= 14 && currentTime.getHours() < 22
                    ? 'Shift 2 (Evening: 14:00–22:00)'
                    : 'Shift 3 (Night: 22:00–06:00)'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick-Start Operational Presets */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-amber-400" />
              <span>Standard Operational Reminders (1-Tap Launch):</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  handleCreateQuickPreset(
                    'Shotcrete Early Re-Entry Window',
                    120,
                    'shotcrete',
                    'critical',
                    'Mandatory 2h minimum curing window. Verify J2 compressive strength > 1.2 MPa before worker entry.'
                  )
                }
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-850 border border-emerald-500/40 hover:border-emerald-400 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                  <span>Shotcrete Re-Entry</span>
                  <span className="text-[10px] font-mono font-bold bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-600">2h 00m</span>
                </div>
                <p className="text-[9.5px] text-slate-400 mt-0.5 line-clamp-1">Safety curing window</p>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleCreateQuickPreset(
                    'Ventilation & Fume Clearance',
                    45,
                    'ventilation',
                    'critical',
                    'Post-blast clearing window. Ensure NOx & CO gases have reached safe threshold (< 25 ppm).'
                  )
                }
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-850 border border-cyan-500/40 hover:border-cyan-400 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
                  <span>Post-Blast Ventilation</span>
                  <span className="text-[10px] font-mono font-bold bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-600">45m</span>
                </div>
                <p className="text-[9.5px] text-slate-400 mt-0.5 line-clamp-1">Gas clearing check</p>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleCreateQuickPreset(
                    'Convergence & Extensometer Pin Reading',
                    240,
                    'convergence',
                    'normal',
                    'Daily NATM convergence monitoring profile reading (tape extensometer or optical total station targets).'
                  )
                }
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-850 border border-amber-500/40 hover:border-amber-400 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                  <span>Convergence Check</span>
                  <span className="text-[10px] font-mono font-bold bg-amber-950 px-1.5 py-0.2 rounded border border-amber-600">4h 00m</span>
                </div>
                <p className="text-[9.5px] text-slate-400 mt-0.5 line-clamp-1">Extensometer pin read</p>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleCreateQuickPreset(
                    'Face Geology & Rockbolt Torque Inspection',
                    180,
                    'safety',
                    'normal',
                    'Random pullout / torque check on Swellex / SN bolts in crown (minimum 85 kN target).'
                  )
                }
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-850 border border-indigo-500/40 hover:border-indigo-400 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                  <span>Rockbolt Torque Check</span>
                  <span className="text-[10px] font-mono font-bold bg-indigo-950 px-1.5 py-0.2 rounded border border-indigo-600">3h 00m</span>
                </div>
                <p className="text-[9.5px] text-slate-400 mt-0.5 line-clamp-1">Torque &amp; anchor verification</p>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleCreateQuickPreset(
                    'Water Inflow Rate Gauge Recording',
                    60,
                    'safety',
                    'normal',
                    'Record V-notch weir flow (L/min) at portal and check face probe hole pressures.'
                  )
                }
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-850 border border-blue-500/40 hover:border-blue-400 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-xs font-bold text-blue-300">
                  <span>Water Inflow Check</span>
                  <span className="text-[10px] font-mono font-bold bg-blue-950 px-1.5 py-0.2 rounded border border-blue-600">1h 00m</span>
                </div>
                <p className="text-[9.5px] text-slate-400 mt-0.5 line-clamp-1">Weir box flow rate</p>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleCreateQuickPreset(
                    'Shift Handover Report Due',
                    30,
                    'general',
                    'normal',
                    'Compile round chainage, GSI/Q logs, and overbreak survey for incoming shift superintendent.'
                  )
                }
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-700 hover:border-slate-500 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span>Shift Handover Log</span>
                  <span className="text-[10px] font-mono font-bold bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700">30m</span>
                </div>
                <p className="text-[9.5px] text-slate-400 mt-0.5 line-clamp-1">Face handover packet</p>
              </button>
            </div>
          </div>

          {/* Custom Reminder / Timer Creator */}
          <form onSubmit={handleCreateCustom} className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 space-y-2">
            <div className="text-[10.5px] font-bold text-slate-400 uppercase">Set Custom Reminder / Timer:</div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                placeholder="Reminder title (e.g. Inspect crown joint water seepage)..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="sm:col-span-7 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none"
              />
              <div className="sm:col-span-3 flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={newMinutes}
                  onChange={(e) => setNewMinutes(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-cyan-300 text-center focus:border-cyan-500 outline-none"
                />
                <span className="text-xs text-slate-400 font-mono">min</span>
              </div>
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-slate-950 font-black text-xs cursor-pointer transition-all flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start</span>
              </button>
            </div>
          </form>

          {/* Active Alarms & Reminders List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span>Active Shift Timers ({alarms.filter((a) => a.status !== 'dismissed').length})</span>
              {alarms.length > 0 && (
                <button
                  type="button"
                  onClick={() => saveAlarms([])}
                  className="text-[10.5px] text-slate-500 hover:text-rose-400 cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {alarms.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                No active shift reminders. Launch one from the 1-tap presets above!
              </div>
            ) : (
              <div className="space-y-2">
                {alarms.map((alarm) => {
                  const isRinging = alarm.status === 'ringing';
                  const isDismissed = alarm.status === 'dismissed';
                  const remaining = formatRemaining(alarm.triggerTimestamp);

                  return (
                    <div
                      key={alarm.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isRinging
                          ? 'bg-rose-950/80 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse'
                          : isDismissed
                          ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            {alarm.priority === 'critical' && (
                              <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-black bg-rose-950 text-rose-300 border border-rose-600 uppercase">
                                Safety Critical
                              </span>
                            )}
                            <h4
                              className={`text-xs font-bold ${
                                isRinging ? 'text-rose-200' : isDismissed ? 'text-slate-400 line-through' : 'text-slate-100'
                              }`}
                            >
                              {alarm.title}
                            </h4>
                          </div>
                          {alarm.notes && <p className="text-[10.5px] text-slate-400">{alarm.notes}</p>}
                        </div>

                        {/* Remaining Time Badge */}
                        <div className="text-right shrink-0">
                          {isRinging ? (
                            <span className="px-2 py-1 rounded-lg bg-rose-600 text-white font-mono font-black text-xs animate-bounce inline-block">
                              ALARM RINGING!
                            </span>
                          ) : isDismissed ? (
                            <span className="text-[10px] font-mono text-slate-500">Dismissed</span>
                          ) : (
                            <div className="font-mono font-black text-sm text-cyan-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              {remaining}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Controls Row */}
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-[10px] font-mono text-slate-500">
                          Target: {new Date(alarm.triggerTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isRinging ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSnooze(alarm.id, 10)}
                                className="px-2 py-1 rounded bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
                              >
                                Snooze (+10m)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDismiss(alarm.id)}
                                className="px-2 py-1 rounded bg-slate-800 text-slate-200 font-bold text-xs cursor-pointer"
                              >
                                Dismiss
                              </button>
                            </>
                          ) : !isDismissed ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSnooze(alarm.id, 15)}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono cursor-pointer"
                              >
                                +15m
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDismiss(alarm.id)}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono cursor-pointer"
                              >
                                Mark Done
                              </button>
                            </>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleDelete(alarm.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 cursor-pointer"
                            title="Delete reminder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs shrink-0">
          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
            <span>Alarms run locally in the browser background and trigger synthesized audio chimes.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
