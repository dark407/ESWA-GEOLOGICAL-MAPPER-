import React, { useEffect, useRef, useState, useTransition } from 'react';

export interface FastInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string | number | undefined | null;
  onChange?: (val: any) => void;
  onChangeValue?: (val: any) => void;
  debounceMs?: number;
  asNumber?: boolean;
}

/**
 * Universal Zero-Lag Buffered Input Component
 *
 * Eliminates typing lag, backspace delays, and cursor jump bugs across complex CAD/GIS forms:
 * 1. Maintains local state inside the input node so every keystroke (0-9, backspace, delete)
 *    updates in < 0.2ms without triggering parent tree re-renders.
 * 2. Propagates changes to the parent/global geotechnical state inside React.startTransition
 *    after a 250ms typing pause, or IMMEDIATELY on onBlur / Enter key.
 */
export const FastInput = React.forwardRef<HTMLInputElement, FastInputProps>(
  (
    {
      value,
      onChange,
      onChangeValue,
      debounceMs = 250,
      asNumber = false,
      onBlur,
      onKeyDown,
      className,
      ...rest
    },
    ref
  ) => {
    const [localValue, setLocalValue] = useState<string>(() =>
      value === undefined || value === null ? '' : String(value)
    );
    const isFocusedRef = useRef<boolean>(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [, startTransition] = useTransition();

    // Sync external changes when the input is NOT actively being typed into by the user
    useEffect(() => {
      if (!isFocusedRef.current) {
        const nextStr = value === undefined || value === null ? '' : String(value);
        setLocalValue(nextStr);
      }
    }, [value]);

    // Cleanup timer on unmount
    useEffect(() => {
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, []);

    const commitChange = (currentStr: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      let finalVal: string | number = currentStr;
      if (asNumber) {
        if (currentStr.trim() === '') {
          finalVal = 0;
        } else {
          const num = Number(currentStr);
          finalVal = isNaN(num) ? 0 : num;
        }
      }
      startTransition(() => {
        if (onChange) onChange(finalVal);
        if (onChangeValue) onChangeValue(finalVal);
      });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextStr = e.target.value;
      // Instant local update in < 0.2ms (zero parent re-render)
      setLocalValue(nextStr);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        commitChange(nextStr);
      }, debounceMs);
    };

    const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = false;
      commitChange(e.target.value);
      if (onBlur) onBlur(e);
    };

    const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = true;
      if (rest.onFocus) rest.onFocus(e);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commitChange((e.target as HTMLInputElement).value);
      }
      if (onKeyDown) onKeyDown(e);
    };

    return (
      <input
        ref={ref}
        {...rest}
        value={localValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
        className={className}
      />
    );
  }
);

FastInput.displayName = 'FastInput';

/**
 * Universal Zero-Lag Buffered Input Hook
 */
export function useFastBufferedInput<T extends string | number>(
  externalValue: T,
  onCommit: (val: T) => void,
  debounceMs: number = 250,
  asNumber: boolean = typeof externalValue === 'number'
) {
  const [localValue, setLocalValue] = useState<string>(String(externalValue ?? ''));
  const isFocusedRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(String(externalValue ?? ''));
    }
  }, [externalValue]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const commit = (valStr: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    let result: any = valStr;
    if (asNumber) {
      result = valStr.trim() === '' ? 0 : Number(valStr);
      if (isNaN(result)) result = 0;
    }
    startTransition(() => {
      onCommit(result as T);
    });
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const next = e.target.value;
    setLocalValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      commit(next);
    }, debounceMs);
  };

  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    isFocusedRef.current = false;
    commit(e.target.value);
  };

  const onFocus = () => {
    isFocusedRef.current = true;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commit((e.target as HTMLInputElement).value);
    }
  };

  return {
    value: localValue,
    onChange,
    onBlur,
    onFocus,
    onKeyDown,
    setValue: setLocalValue,
  };
}
