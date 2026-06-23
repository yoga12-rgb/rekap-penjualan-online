import { describe, expect, it } from "vitest";
import {
  previousPeriodForRange,
  yoyPeriodForRange,
  inclusiveDaysBetween,
} from "./date";

describe("helper tanggal (date helpers)", () => {
  describe("inclusiveDaysBetween", () => {
    it("menghitung selisih hari inklusif dengan benar", () => {
      expect(inclusiveDaysBetween("2026-06-01", "2026-06-01")).toBe(1);
      expect(inclusiveDaysBetween("2026-06-01", "2026-06-07")).toBe(7);
      expect(inclusiveDaysBetween("2026-01-01", "2026-12-31")).toBe(365);
    });
  });

  describe("previousPeriodForRange", () => {
    it("menghitung periode sebelumnya dengan durasi hari yang sama", () => {
      // 1 hari: 2026-06-02 -> sebelumnya: 2026-06-01 s.d 2026-06-01
      expect(previousPeriodForRange("2026-06-02", "2026-06-02")).toEqual({
        from: "2026-06-01",
        to: "2026-06-01",
      });

      // 7 hari: 2026-06-08 s.d 2026-06-14 -> sebelumnya: 2026-06-01 s.d 2026-06-07
      expect(previousPeriodForRange("2026-06-08", "2026-06-14")).toEqual({
        from: "2026-06-01",
        to: "2026-06-07",
      });
    });
  });

  describe("yoyPeriodForRange", () => {
    it("menghitung periode tahun lalu (YoY) untuk tanggal yang sama", () => {
      // 1 hari biasa: 2026-06-23 -> tahun lalu: 2025-06-23
      expect(yoyPeriodForRange("2026-06-23", "2026-06-23")).toEqual({
        from: "2025-06-23",
        to: "2025-06-23",
      });

      // Rentang hari: 2026-06-01 s.d 2026-06-07 -> tahun lalu: 2025-06-01 s.d 2025-06-07
      expect(yoyPeriodForRange("2026-06-01", "2026-06-07")).toEqual({
        from: "2025-06-01",
        to: "2025-06-07",
      });
    });

    it("menangani tanggal kabisat (leap year) secara aman", () => {
      // Tanggal 29 Februari 2024 (tahun kabisat) -> tahun lalu (2023) bukan kabisat, harus dimundurkan ke 28 Februari
      expect(yoyPeriodForRange("2024-02-29", "2024-02-29")).toEqual({
        from: "2023-02-28",
        to: "2023-02-28",
      });
    });
  });
});
