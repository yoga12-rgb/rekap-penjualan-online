import { describe, expect, it } from "vitest";
import {
  buildDashboardData,
  type AdCostRow,
  type SummaryRow,
} from "./dashboardData";

function transaction(overrides: Partial<SummaryRow>): SummaryRow {
  return {
    id: "row-1",
    order_id: "order-1",
    order_number: "ORD-1",
    transaction_date: "2026-06-01T03:00:00.000Z",
    qty: 1,
    initial_price: 10_000,
    deduction_fee: 1_000,
    net_profit: 9_000,
    outlet_id: "outlet-1",
    food_merchant_id: "merchant-1",
    product_variant_id: "product-1",
    outlets: { name: "Outlet A" },
    food_merchants: { name: "Merchant A", color: "#ef4444" },
    product_variants: { name: "Produk A" },
    ...overrides,
  };
}

function adCost(overrides: Partial<AdCostRow>): AdCostRow {
  return {
    id: "ad-1",
    cost_date: "2026-06-01",
    outlet_id: "outlet-1",
    food_merchant_id: "merchant-1",
    amount: 5_000,
    outlets: { name: "Outlet A" },
    food_merchants: { name: "Merchant A", color: "#ef4444" },
    ...overrides,
  };
}

describe("buildDashboardData", () => {
  it("menghitung total, rata-rata qty, dan profit bersih dari transaksi unik", () => {
    const data = buildDashboardData({
      rows: [
        transaction({
          id: "row-1",
          order_id: "order-1",
          transaction_date: "2026-06-01T03:00:00.000Z",
          qty: 2,
          initial_price: 20_000,
          deduction_fee: 4_000,
          net_profit: 36_000,
          product_variants: { name: "Produk A" },
        }),
        transaction({
          id: "row-2",
          order_id: "order-1",
          transaction_date: "2026-06-01T03:05:00.000Z",
          qty: 1,
          initial_price: 15_000,
          deduction_fee: 1_500,
          net_profit: 13_500,
          product_variant_id: "product-2",
          product_variants: { name: "Produk B" },
        }),
        transaction({
          id: "row-3",
          order_id: "order-2",
          transaction_date: "2026-06-01T10:00:00.000Z",
          qty: 3,
          initial_price: 10_000,
          deduction_fee: 3_000,
          net_profit: 27_000,
          outlet_id: "outlet-2",
          outlets: { name: "Outlet B" },
        }),
      ],
      previousRows: [],
      adCosts: [adCost({ amount: 10_000 })],
      previousAdCosts: [],
    });

    expect(data.totals.gross).toBe(85_000);
    expect(data.totals.fee).toBe(8_500);
    expect(data.totals.net).toBe(76_500);
    expect(data.totals.adCost).toBe(10_000);
    expect(data.totals.cleanProfit).toBe(66_500);
    expect(data.totals.qty).toBe(6);
    expect(data.totals.transactionCount).toBe(2);
    expect(data.totals.avgQty).toBe(3);
    expect(data.totals.avgGross).toBe(42_500);
    expect(data.totals.feePercent).toBe(10);
  });

  it("membangun chart, leaderboard, breakdown, dan insight dari data agregat", () => {
    const data = buildDashboardData({
      rows: [
        transaction({
          id: "row-1",
          order_id: "order-1",
          transaction_date: "2026-06-01T03:00:00.000Z",
          qty: 5,
          initial_price: 10_000,
          net_profit: 45_000,
          product_variants: { name: "Produk A" },
        }),
        transaction({
          id: "row-2",
          order_id: "order-2",
          transaction_date: "2026-06-02T04:00:00.000Z",
          qty: 2,
          initial_price: 20_000,
          net_profit: 36_000,
          food_merchant_id: "merchant-2",
          food_merchants: { name: "Merchant B", color: "#22c55e" },
          outlet_id: "outlet-2",
          outlets: { name: "Outlet B" },
          product_variant_id: "product-2",
          product_variants: { name: "Produk B" },
        }),
      ],
      previousRows: [],
      adCosts: [
        adCost({ amount: 5_000 }),
        adCost({
          id: "ad-2",
          cost_date: "2026-06-02",
          outlet_id: "outlet-2",
          food_merchant_id: "merchant-2",
          amount: 8_000,
          outlets: { name: "Outlet B" },
          food_merchants: { name: "Merchant B", color: "#22c55e" },
        }),
      ],
      previousAdCosts: [],
    });

    expect(data.daily).toHaveLength(2);
    expect(data.daily[0]).toMatchObject({
      date: "2026-06-01",
      gross: 50_000,
      adCost: 5_000,
      cleanProfit: 40_000,
    });
    expect(data.leaderboard[0]).toMatchObject({ name: "Produk A", qty: 5 });
    expect(data.merchantBreakdown[0]).toMatchObject({
      name: "Merchant A",
      cleanProfit: 40_000,
    });
    expect(data.outletBreakdown[0]).toMatchObject({
      name: "Outlet A",
      transactionCount: 1,
      qty: 5,
    });
    expect(data.hourly.some((hour) => hour.transactionCount > 0)).toBe(true);
    expect(data.insights.join(" ")).toContain("Produk terlaris periode ini");
  });

  it("membandingkan periode dan mendeteksi penurunan produk/merchant", () => {
    const data = buildDashboardData({
      rows: [
        transaction({
          id: "row-current",
          order_id: "order-current",
          qty: 2,
          initial_price: 10_000,
          net_profit: 18_000,
          product_variant_id: "product-1",
          product_variants: { name: "Produk A" },
          food_merchant_id: "merchant-1",
          food_merchants: { name: "Merchant A", color: "#ef4444" },
        }),
      ],
      previousRows: [
        transaction({
          id: "row-prev-1",
          order_id: "order-prev-1",
          qty: 5,
          initial_price: 10_000,
          net_profit: 45_000,
          product_variant_id: "product-1",
          product_variants: { name: "Produk A" },
          food_merchant_id: "merchant-1",
          food_merchants: { name: "Merchant A", color: "#ef4444" },
        }),
      ],
      adCosts: [],
      previousAdCosts: [],
    });

    const qtyComparison = data.comparison.find((item) => item.label === "Qty");
    expect(qtyComparison).toMatchObject({
      current: 2,
      previous: 5,
      delta: -3,
      percentChange: -60,
    });
    expect(data.productDeclines[0]).toMatchObject({
      name: "Produk A",
      current: 2,
      previous: 5,
      delta: -3,
    });
    expect(data.merchantDeclines[0]).toMatchObject({
      name: "Merchant A",
      current: 18_000,
      previous: 45_000,
      delta: -27_000,
    });
  });
});
