import React from "react";

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
  return (
    <>
      <div>
        <label className="label">{fromLabel}</label>
        <input
          type="date"
          className="input"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
        />
      </div>
      <div>
        <label className="label">{toLabel}</label>
        <input
          type="date"
          className="input"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
        />
      </div>
    </>
  );
}
