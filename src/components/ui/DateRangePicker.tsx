"use client";
import { useId } from "react";

export interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromLabel?: string;
  toLabel?: string;
}

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel = "Dari",
  toLabel = "Sampai",
}: DateRangePickerProps) {
  const fromId = useId();
  const toId = useId();
  const invalid = Boolean(from && to && from > to);
  const invalidClass = invalid
    ? "border-red-400 focus:border-red-500 focus:ring-red-100 dark:focus:ring-red-900/30"
    : "";

  return (
    <>
      <div>
        <label className="label" htmlFor={fromId}>
          {fromLabel}
        </label>
        <input
          id={fromId}
          type="date"
          className={`input ${invalidClass}`}
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          aria-invalid={invalid || undefined}
        />
      </div>
      <div>
        <label className="label" htmlFor={toId}>
          {toLabel}
        </label>
        <input
          id={toId}
          type="date"
          className={`input ${invalidClass}`}
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          aria-invalid={invalid || undefined}
        />
        {invalid && (
          <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
            Tanggal "Dari" tidak boleh lebih besar dari "Sampai".
          </p>
        )}
      </div>
    </>
  );
}