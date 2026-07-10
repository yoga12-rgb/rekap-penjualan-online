export type TransactionOption = { id: string; name: string };

export type TransactionMerchant = TransactionOption & {
  color?: string | null;
};

export type TransactionVariantPrice = {
  food_merchant_id: string;
  price: number;
};

export type TransactionVariant = TransactionOption & {
  base_price: number;
  product_variant_prices?: TransactionVariantPrice[] | null;
};

export type TransactionRow = {
  id: string;
  order_id: string | null;
  order_number: string | null;
  transaction_date: string;
  qty: number;
  initial_price: number;
  deduction_fee: number;
  net_profit: number;
  company_expense: number;
  total_hpp?: number;
  is_fake: boolean;
  outlet_id: string;
  food_merchant_id: string;
  product_variant_id: string;
  outlets: { name: string } | null;
  food_merchants: { name: string; color: string | null } | null;
  product_variants: { name: string } | null;
};

export type TransactionGroup = {
  order_id: string;
  orderNumber: string | null;
  date: string;
  outlet: string;
  merchant: string;
  merchantColor: string | null;
  rows: TransactionRow[];
  qty: number;
  gross: number;
  fee: number;
  net: number;
  company_expense: number;
  total_hpp: number;
  is_fake: boolean;
};

export type TransactionSummary = {
  orderCount: number;
  qty: number;
  gross: number;
  fee: number;
  net: number;
  hpp: number;
  cleanProfit: number;
};

export type TransactionOrderPage = {
  groups: TransactionGroup[];
  nextOffset: number;
  hasMore: boolean;
};

export const EMPTY_TRANSACTION_SUMMARY: TransactionSummary = {
  orderCount: 0,
  qty: 0,
  gross: 0,
  fee: 0,
  net: 0,
  hpp: 0,
  cleanProfit: 0,
};

export const EMPTY_TRANSACTION_ORDER_PAGE: TransactionOrderPage = {
  groups: [],
  nextOffset: 0,
  hasMore: false,
};

export function groupTransactionRows(
  rows: TransactionRow[],
): TransactionGroup[] {
  const map = new Map<string, TransactionGroup>();

  for (const row of rows) {
    const key = row.order_id ?? row.id;
    const current = map.get(key) ?? {
      order_id: key,
      orderNumber: row.order_number ?? null,
      date: row.transaction_date,
      outlet: row.outlets?.name ?? "",
      merchant: row.food_merchants?.name ?? "",
      merchantColor: row.food_merchants?.color ?? null,
      rows: [] as TransactionRow[],
      qty: 0,
      gross: 0,
      fee: 0,
      net: 0,
      company_expense: 0,
      total_hpp: 0,
      is_fake: row.is_fake,
    };

    current.rows.push(row);
    current.qty += Number(row.qty || 0);
    current.gross += Number(row.qty || 0) * Number(row.initial_price || 0);
    current.fee += Number(row.deduction_fee || 0);
    current.net += Number(row.net_profit || 0);
    current.company_expense += Number(row.company_expense || 0);
    current.total_hpp += Number(row.total_hpp || 0);
    if (row.transaction_date > current.date) current.date = row.transaction_date;
    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}

export function summarizeTransactionRows(
  rows: TransactionRow[],
): TransactionSummary {
  const summary = { ...EMPTY_TRANSACTION_SUMMARY };
  const keys = new Set<string>();

  for (const r of rows) {
    keys.add(r.order_id || r.id);
    summary.qty += r.qty;
    summary.gross += r.qty * r.initial_price;
    summary.fee += r.deduction_fee;
    summary.net += r.net_profit;
    summary.hpp += r.total_hpp || 0;
  }
  summary.orderCount = keys.size;
  summary.cleanProfit = summary.net - summary.hpp;
  return summary;
}
