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
  return (
    <>
      <div>
        <label className="label" htmlFor={fromId}>
          {fromLabel}
        </label>
        <input
          id={fromId}
          type="date"
          className="input"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor={toId}>
          {toLabel}
        </label>
        <input
          id={toId}
          type="date"
          className="input"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
        />
      </div>
    </>
  );
}