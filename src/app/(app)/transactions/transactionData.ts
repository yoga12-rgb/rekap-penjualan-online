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
};

export type TransactionSummary = {
  orderCount: number;
  qty: number;
  gross: number;
  fee: number;
  net: number;
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
      rows: [],
      qty: 0,
      gross: 0,
      fee: 0,
      net: 0,
    };

    current.rows.push(row);
    current.qty += Number(row.qty || 0);
    current.gross += Number(row.qty || 0) * Number(row.initial_price || 0);
    current.fee += Number(row.deduction_fee || 0);
    current.net += Number(row.net_profit || 0);
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
  const orderIds = new Set<string>();
  const totals = { ...EMPTY_TRANSACTION_SUMMARY };

  for (const row of rows) {
    orderIds.add(row.order_id ?? row.id);
    totals.qty += Number(row.qty || 0);
    totals.gross += Number(row.qty || 0) * Number(row.initial_price || 0);
    totals.fee += Number(row.deduction_fee || 0);
    totals.net += Number(row.net_profit || 0);
  }

  totals.orderCount = orderIds.size;
  return totals;
}
