import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Check, RotateCcw } from 'lucide-react';

export interface ClampedNumericInputProps {
  label: string;
  value: number | null | undefined;
  onChange: (val: number | null) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  allowNull?: boolean;
  nullLabel?: string;
  helperText?: string;
  disabled?: boolean;
  className?: string;
  scientificReference?: string;
}

export const ClampedNumericInput: React.FC<ClampedNumericInputProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
  placeholder = 'Enter value...',
  allowNull = false,
  nullLabel = 'Not Assessed',
  helperText,
  disabled = false,
  className = '',
  scientificReference,
}) => {
  const [localText, setLocalText] = useState<string>(() =>
    value !== null && value !== undefined && !isNaN(value) ? String(value) : ''
  );
  const [warning, setWarning] = useState<string | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (value === null || value === undefined) {
      setLocalText('');
    } else if (!isNaN(value)) {
      setLocalText(String(value));
    }
  }, [value]);

  const showTemporaryWarning = (msg: string) => {
    setWarning(msg);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = setTimeout(() => {
      setWarning(null);
    }, 4500);
  };

  const handleCommitValue = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      if (allowNull) {
        onChange(null);
        setWarning(null);
      } else {
        // Fallback to min
        onChange(min);
        setLocalText(String(min));
        showTemporaryWarning(`Required field: set to minimum ${min}${unit}`);
      }
      return;
    }

    const parsed = parseFloat(trimmed);
    if (isNaN(parsed)) {
      if (allowNull) {
        onChange(null);
        setLocalText('');
      } else {
        onChange(min);
        setLocalText(String(min));
      }
      showTemporaryWarning(`Invalid numeric input; reverted.`);
      return;
    }

    if (parsed < min) {
      onChange(min);
      setLocalText(String(min));
      showTemporaryWarning(`Value ${parsed}${unit} is below physical minimum; clamped to ${min}${unit}.`);
    } else if (parsed > max) {
      onChange(max);
      setLocalText(String(max));
      showTemporaryWarning(`Value ${parsed}${unit} exceeds theoretical limit; clamped to ${max}${unit}.`);
    } else {
      // Valid within [min, max]
      onChange(parsed);
      setLocalText(String(parsed));
      setWarning(null);
    }
  };

  const isUnassessed = value === null || value === undefined;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <label className="font-medium text-slate-200 flex items-center gap-1.5">
          <span>{label}</span>
          {unit && <span className="font-mono text-[10px] text-slate-400">({unit})</span>}
        </label>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-slate-400 tabular-nums">
            [{min} – {max}{unit ? ` ${unit}` : ''}]
          </span>
          {allowNull && (
            <button
              type="button"
              onClick={() => {
                if (isUnassessed) {
                  const defaultVal = min <= 0 && max >= 0 ? 0 : min;
                  onChange(defaultVal);
                  setLocalText(String(defaultVal));
                  setWarning(null);
                } else {
                  onChange(null);
                  setLocalText('');
                  setWarning(null);
                }
              }}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer border ${
                isUnassessed
                  ? 'bg-amber-950/60 border-amber-600/50 text-amber-300 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
              title={isUnassessed ? 'Click to enter measured parameter' : 'Mark as Not Assessed'}
            >
              {isUnassessed ? 'Not Assessed' : 'Clear / Unassess'}
            </button>
          )}
        </div>
      </div>

      <div className="relative flex items-center">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={localText}
          placeholder={allowNull ? `Optional (${nullLabel})` : placeholder}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value;
            setLocalText(raw);
            const num = parseFloat(raw);
            if (!isNaN(num)) {
              if (num > max) {
                setWarning(`Warning: ${num}${unit} exceeds ${max}${unit} limit. Will clamp on blur.`);
              } else if (num < min) {
                setWarning(`Warning: ${num}${unit} is below ${min}${unit} limit. Will clamp on blur.`);
              } else {
                setWarning(null);
              }
            } else {
              setWarning(null);
            }
          }}
          onBlur={(e) => handleCommitValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCommitValue((e.target as HTMLInputElement).value);
            }
          }}
          className={`w-full px-3 py-2 bg-slate-950 border rounded-lg font-mono text-sm tabular-nums text-slate-100 placeholder-slate-500 focus:outline-hidden focus:ring-1 transition-colors ${
            warning
              ? 'border-amber-500/80 focus:ring-amber-400 bg-amber-950/10'
              : isUnassessed
              ? 'border-slate-800 text-slate-400 italic'
              : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500'
          }`}
        />
        {unit && (
          <span className="absolute right-3 text-xs font-mono text-slate-500 pointer-events-none">
            {unit}
          </span>
        )}
      </div>

      {warning && (
        <div className="flex items-start gap-1.5 p-1.5 rounded bg-amber-950/40 border border-amber-600/40 text-[11px] text-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>{warning}</span>
        </div>
      )}

      {(helperText || scientificReference) && !warning && (
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
          <span>{helperText}</span>
          {scientificReference && <span className="font-mono text-slate-400">{scientificReference}</span>}
        </div>
      )}
    </div>
  );
};
