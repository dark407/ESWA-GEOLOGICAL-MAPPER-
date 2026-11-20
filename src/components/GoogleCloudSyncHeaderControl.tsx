import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  EngineeringSyncStatus,
  flushPendingEngineeringQueue,
  getEngineeringSyncStatus,
  pullEngineeringModulesFromServerAndCloud,
  subscribeEngineeringSyncStatus,
} from '../engine/engineeringPersistenceEngine';
import {
  GoogleUserAccountInfo,
  pullUserWorkspaceFromCloud,
  signInWithGoogleAccount,
  signOutGoogleAccount,
  syncUserWorkspaceToCloud,
} from '../engine/userCloudAndPackageEngine';

export interface GoogleCloudSyncHeaderControlProps {
  googleUser: GoogleUserAccountInfo | null | undefined;
  onUserChanged?: (user: GoogleUserAccountInfo | null) => void;
  onOpenSettingsAccount?: () => void;
  variant?: 'light' | 'dark-amber' | 'dark-cyan';
  accentBorderColor?: string;
}

export const GoogleCloudSyncHeaderControl: React.FC<
  GoogleCloudSyncHeaderControlProps
> = ({
  googleUser,
  onUserChanged,
  onOpenSettingsAccount,
  variant = 'light',
  accentBorderColor,
}) => {
  const [syncStatus, setSyncStatus] = useState<EngineeringSyncStatus>(() =>
    getEngineeringSyncStatus()
  );
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    return subscribeEngineeringSyncStatus(setSyncStatus);
  }, []);

  const handleSignIn = async () => {
    setIsBusy(true);
    try {
      const res = await signInWithGoogleAccount({ preferPopup: true });
      if (res.user) {
        onUserChanged?.(res.user);
        await flushPendingEngineeringQueue();
        await syncUserWorkspaceToCloud(res.user);
        await pullEngineeringModulesFromServerAndCloud();
      } else if (res.requiresEmailPrompt) {
        onOpenSettingsAccount?.();
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleManualSync = async () => {
    setIsBusy(true);
    try {
      await flushPendingEngineeringQueue();
      if (googleUser) {
        await syncUserWorkspaceToCloud(googleUser);
        await pullUserWorkspaceFromCloud();
      }
      await pullEngineeringModulesFromServerAndCloud();
    } finally {
      setIsBusy(false);
    }
  };

  const handleSignOut = async () => {
    setIsBusy(true);
    try {
      await signOutGoogleAccount();
      onUserChanged?.(null);
    } finally {
      setIsBusy(false);
    }
  };

  const isDark = variant !== 'light';
  const accentText =
    variant === 'dark-amber'
      ? 'text-amber-400'
      : variant === 'dark-cyan'
      ? 'text-cyan-400'
      : 'text-sky-700';

  const baseButtonCls = isDark
    ? 'bg-slate-900/95 border-slate-700 text-slate-200 hover:bg-slate-800'
    : 'bg-white/95 border-slate-300 text-slate-800 hover:bg-stone-50';

  if (!googleUser) {
    return (
      <button
        type="button"
        disabled={isBusy}
        onClick={handleSignIn}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm transition-all cursor-pointer active:scale-95 whitespace-nowrap ${baseButtonCls}`}
        style={
          !isDark && accentBorderColor
            ? { borderColor: `${accentBorderColor}45` }
            : undefined
        }
        title="Optional Google Sign-In for cloud sync across devices (works 100% offline with 1-PC license too)"
      >
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white text-[10px] font-black text-sky-700 border border-slate-300 shrink-0">
          G
        </span>
        <span className="font-semibold">
          {isBusy ? 'Connecting...' : 'Google Sign-In'}
        </span>
      </button>
    );
  }

  const stateBadgeLabel =
    syncStatus.state === 'syncing' || isBusy
      ? 'Syncing'
      : syncStatus.cloudConnected
      ? 'Cloud+Local'
      : syncStatus.serverMirrorConnected
      ? 'Local+Server'
      : 'Offline Ready';

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-sm whitespace-nowrap ${baseButtonCls}`}
      style={
        !isDark && accentBorderColor
          ? { borderColor: `${accentBorderColor}55` }
          : undefined
      }
    >
      <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${accentText}`} />
      <span
        className="max-w-[125px] truncate font-semibold"
        title={`${googleUser.displayName} (${googleUser.email})`}
      >
        {googleUser.email}
      </span>
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold inline-flex items-center gap-1 ${
          isDark
            ? 'bg-slate-800 text-emerald-300 border border-slate-700'
            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
        }`}
      >
        {syncStatus.cloudConnected ? (
          <Cloud className="w-3 h-3 shrink-0" />
        ) : (
          <CloudOff className="w-3 h-3 shrink-0 text-amber-500" />
        )}
        <span>{stateBadgeLabel}</span>
      </span>

      <button
        type="button"
        disabled={isBusy}
        onClick={handleManualSync}
        className={`p-1 rounded transition-colors cursor-pointer ${
          isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
        }`}
        title="Sync projects, core logs, monitoring & blast assessments now"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
      </button>

      <button
        type="button"
        disabled={isBusy}
        onClick={handleSignOut}
        className={`p-1 rounded transition-colors cursor-pointer ${
          isDark ? 'hover:bg-slate-800 text-rose-400' : 'hover:bg-rose-50 text-rose-600'
        }`}
        title="Sign out Google Cloud Sync (keeps offline 1-PC workstation active)"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
