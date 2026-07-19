"use client";

import React, { useState, useEffect, useMemo } from "react";
import { formatIDR } from "@/lib/utils";
import { 
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  format, eachDayOfInterval, eachMonthOfInterval, addMonths, subMonths, addWeeks, subWeeks, addYears, subYears,
  parseISO
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar, DollarSign, Wallet } from "lucide-react";
import { formatWIBDateKey } from "@/lib/date";

type TimeData = {
  gross: number;
  net: number;
};

type OutletData = {
  outlet_id: string;
  outlet_name: string;
  total_gross: number;
  total_net: number;
  time_data: Record<string, TimeData>;
};

type MerchantGroup = {
  merchant_id: string;
  merchant_name: string;
  merchant_color: string | null;
  outlets: OutletData[];
};

type PeriodType = "weekly" | "monthly" | "yearly";
type MetricType = "gross" | "net";

export default function MatrixClient() {
  const [periodType, setPeriodType] = useState<PeriodType>("monthly");
  const [metricType, setMetricType] = useState<MetricType>("gross");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  const [data, setData] = useState<MerchantGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate date ranges and headers based on current settings
  const { from, to, groupBy, columns } = useMemo(() => {
    let start, end, formatStr = "yyyy-MM-dd", cols: { key: string; label: string }[] = [];
    
    if (periodType === "weekly") {
      start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Senin
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start, end });
      cols = days.map(d => ({ key: format(d, "yyyy-MM-dd"), label: format(d, "dd/MM") }));
    } else if (periodType === "monthly") {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
      const days = eachDayOfInterval({ start, end });
      cols = days.map(d => ({ key: format(d, "yyyy-MM-dd"), label: format(d, "d") }));
    } else {
      start = startOfYear(currentDate);
      end = endOfYear(currentDate);
      formatStr = "yyyy-MM";
      const months = eachMonthOfInterval({ start, end });
      cols = months.map(m => ({ key: format(m, "yyyy-MM"), label: format(m, "MMM") }));
    }

    return {
      from: formatWIBDateKey(start),
      to: formatWIBDateKey(end),
      groupBy: periodType === "yearly" ? "month" : "day",
      columns: cols
    };
  }, [currentDate, periodType]);

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/reports/matrix?from=${from}&to=${to}&group_by=${groupBy}`);
        if (!res.ok) throw new Error("Failed to fetch matrix data");
        const json = await res.json();
        if (!ignore) setData(json || []);
      } catch (err: any) {
        if (!ignore) setError(err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchData();
    return () => { ignore = true; };
  }, [from, to, groupBy]);

  const handlePrev = () => {
    if (periodType === "weekly") setCurrentDate(d => subWeeks(d, 1));
    else if (periodType === "monthly") setCurrentDate(d => subMonths(d, 1));
    else setCurrentDate(d => subYears(d, 1));
  };

  const handleNext = () => {
    if (periodType === "weekly") setCurrentDate(d => addWeeks(d, 1));
    else if (periodType === "monthly") setCurrentDate(d => addMonths(d, 1));
    else setCurrentDate(d => addYears(d, 1));
  };

  const periodLabel = useMemo(() => {
    if (periodType === "weekly") {
      return `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "dd MMM")} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "dd MMM yyyy")}`;
    }
    if (periodType === "monthly") {
      return format(currentDate, "MMMM yyyy");
    }
    return format(currentDate, "yyyy");
  }, [currentDate, periodType]);

  // Calculate Column Totals
  const colTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    columns.forEach(c => totals[c.key] = 0);
    
    data.forEach(group => {
      group.outlets?.forEach(outlet => {
        columns.forEach(c => {
          const val = outlet.time_data?.[c.key]?.[metricType] || 0;
          totals[c.key] += val;
        });
      });
    });
    return totals;
  }, [data, columns, metricType]);

  // Calculate Grand Total
  const grandTotal = useMemo(() => {
    return data.reduce((acc, group) => {
      return acc + (group.outlets?.reduce((sum, outlet) => sum + (metricType === "gross" ? outlet.total_gross : outlet.total_net), 0) || 0);
    }, 0);
  }, [data, metricType]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        
        {/* Period Type Selection */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setPeriodType("weekly")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${periodType === "weekly" ? "bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
          >
            Mingguan
          </button>
          <button
            onClick={() => setPeriodType("monthly")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${periodType === "monthly" ? "bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
          >
            Bulanan
          </button>
          <button
            onClick={() => setPeriodType("yearly")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${periodType === "yearly" ? "bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
          >
            Tahunan
          </button>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center gap-3">
          <button onClick={handlePrev} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-[140px] justify-center text-slate-700 dark:text-slate-200 font-medium">
            <Calendar className="w-4 h-4 text-slate-400" />
            {periodLabel}
          </div>
          <button onClick={handleNext} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Metric Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setMetricType("gross")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${metricType === "gross" ? "bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
          >
            <Wallet className="w-4 h-4" />
            Omset
          </button>
          <button
            onClick={() => setMetricType("net")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${metricType === "net" ? "bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
          >
            <DollarSign className="w-4 h-4" />
            Net Profit
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative z-0">
        {loading ? (
          <div className="p-12 text-center text-slate-500 animate-pulse">Memuat Matriks...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 bg-red-50 dark:bg-red-900/10">Error: {error}</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-slate-500">Tidak ada data transaksi pada periode ini.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-slate-800 text-white p-3 font-semibold min-w-[200px] border-b border-r border-slate-700">
                    MERCHANT / OUTLET
                  </th>
                  <th className="sticky left-[200px] z-20 bg-slate-700 text-white p-3 font-semibold min-w-[140px] border-b border-r border-slate-600 text-right">
                    TOTAL
                  </th>
                  {columns.map(c => (
                    <th key={c.key} className="bg-slate-700 text-white p-3 font-medium min-w-[110px] text-center border-b border-r border-slate-600">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((group) => (
                  <React.Fragment key={group.merchant_id}>
                    {/* Merchant Header Row */}
                    <tr>
                      <td colSpan={2} className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-800 p-2 font-bold text-slate-900 dark:text-white border-b border-r border-slate-200 dark:border-slate-700" style={{ color: group.merchant_color || 'inherit' }}>
                        {group.merchant_name}
                      </td>
                      <td colSpan={columns.length} className="bg-slate-100 dark:bg-slate-800 p-2 border-b border-slate-200 dark:border-slate-700"></td>
                    </tr>
                    
                    {/* Outlets Rows */}
                    {group.outlets?.map((outlet) => {
                      const rowTotal = metricType === "gross" ? outlet.total_gross : outlet.total_net;
                      return (
                        <tr key={outlet.outlet_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 p-3 font-medium border-b border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                            {outlet.outlet_name}
                          </td>
                          <td className="sticky left-[200px] z-10 bg-slate-50 dark:bg-slate-800 p-3 font-semibold text-right border-b border-r border-slate-200 dark:border-slate-700">
                            {formatIDR(rowTotal)}
                          </td>
                          {columns.map(c => {
                            const val = outlet.time_data?.[c.key]?.[metricType] || 0;
                            return (
                              <td 
                                key={c.key} 
                                className={`p-3 text-right border-b border-r border-slate-200 dark:border-slate-700 ${val === 0 ? 'text-slate-300 dark:text-slate-700 bg-slate-50/50 dark:bg-slate-900/50' : 'text-slate-700 dark:text-slate-300'}`}
                              >
                                {val === 0 ? '-' : formatIDR(val)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="sticky left-0 z-20 bg-emerald-600 text-white p-3 font-bold border-t-2 border-emerald-700 border-r text-right">
                    TOTAL OMSET
                  </td>
                  <td className="sticky left-[200px] z-20 bg-emerald-600 text-emerald-50 p-3 font-bold text-right border-t-2 border-emerald-700 border-r">
                    {formatIDR(grandTotal)}
                  </td>
                  {columns.map(c => (
                    <td key={c.key} className="bg-emerald-600 text-white p-3 font-semibold text-right border-t-2 border-emerald-700 border-r min-w-[110px]">
                      {colTotals[c.key] === 0 ? '-' : formatIDR(colTotals[c.key])}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
