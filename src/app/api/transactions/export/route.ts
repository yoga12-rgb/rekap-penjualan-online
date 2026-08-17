import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  daysAgoWIBKey,
  isoToWIBDisplay,
  isValidDateKey,
  todayWIBKey,
  wibEndOfDay,
  wibStartOfDay,
} from "@/lib/date";
import { formatIDR, uuidParam } from "@/lib/utils";
import {
  groupTransactionRows,
  type TransactionRow,
} from "@/app/(app)/transactions/transactionData";

export const dynamic = "force-dynamic";

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";
const PAGE_SIZE = 1000;

function sanitizeSearchTerm(value: string | null) {
  return (value ?? "").trim().slice(0, 100);
}

function sanitizePostgrestPattern(value: string) {
  return value.replace(/[\\%_,()*]/g, " ").trim();
}

function matchingIds<T extends { id: string; name: string }>(
  items: T[] | null,
  term: string,
) {
  const needle = term.toLowerCase();
  return (items ?? [])
    .filter((item) => item.name.toLowerCase().includes(needle))
    .map((item) => item.id);
}

function formatUnitPrices(rows: TransactionRow[]) {
  const prices = rows.map((row) => Number(row.initial_price || 0));
  const unique = Array.from(new Set(prices));
  return unique.map((price) => formatIDR(price)).join("; ");
}

function formatProductSummary(rows: TransactionRow[]) {
  return rows
    .map((row) =>
      `${row.product_variants?.name ?? "-"} ${row.qty} × ${formatIDR(row.initial_price)}`,
    )
    .join("\n");
}

export async function GET(request: Request) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const searchParams = new URL(request.url).searchParams;

  const rawFrom = searchParams.get("from") ?? "";
  const rawTo = searchParams.get("to") ?? "";
  let from = isValidDateKey(rawFrom) ? rawFrom : daysAgoWIBKey(6);
  let to = isValidDateKey(rawTo) ? rawTo : todayWIBKey();
  if (from > to) [from, to] = [to, from];

  const filter = {
    from,
    to,
    outlet:
      profile.role === "super_admin"
        ? uuidParam(searchParams.get("outlet") ?? "")
        : "",
    merchant: uuidParam(searchParams.get("merchant") ?? ""),
    variant: uuidParam(searchParams.get("variant") ?? ""),
    q: sanitizeSearchTerm(searchParams.get("q")),
    is_fake: searchParams.get("is_fake") || "all",
  };

  const [{ data: outlets }, { data: merchants }, { data: variants }] =
    await Promise.all([
      supabase.from("outlets").select("id,name").order("name"),
      supabase.from("food_merchants").select("id,name,color").order("name"),
      supabase
        .from("product_variants")
        .select("id,name,base_price")
        .order("name"),
    ]);

  function buildQuery(offset: number) {
    let query = supabase
      .from("transactions")
      .select(
        "id, order_id, order_number, transaction_date, qty, initial_price, deduction_fee, net_profit, company_expense, total_hpp, is_fake, outlet_id, food_merchant_id, product_variant_id, outlets(name), food_merchants(name,color), product_variants(name)",
      )
      .gte("transaction_date", wibStartOfDay(filter.from))
      .lte("transaction_date", wibEndOfDay(filter.to))
      .order("transaction_date", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (profile.role === "kasir")
      query = profile.outlet_id
        ? query.eq("outlet_id", profile.outlet_id)
        : query.is("outlet_id", null);
    if (filter.outlet) query = query.eq("outlet_id", filter.outlet);
    if (filter.merchant) query = query.eq("food_merchant_id", filter.merchant);
    if (filter.variant) query = query.eq("product_variant_id", filter.variant);
    if (filter.q) {
      const clauses: string[] = [];
      const patternTerm = sanitizePostgrestPattern(filter.q);
      if (patternTerm) clauses.push(`order_number.ilike.%${patternTerm}%`);

      const outletIds = matchingIds(outlets ?? [], filter.q);
      const merchantIds = matchingIds(merchants ?? [], filter.q);
      const variantIds = matchingIds(variants ?? [], filter.q);
      if (outletIds.length) clauses.push(`outlet_id.in.(${outletIds.join(",")})`);
      if (merchantIds.length)
        clauses.push(`food_merchant_id.in.(${merchantIds.join(",")})`);
      if (variantIds.length)
        clauses.push(`product_variant_id.in.(${variantIds.join(",")})`);

      query = clauses.length
        ? query.or(clauses.join(","))
        : query.eq("id", EMPTY_UUID);
    }

    if (filter.is_fake === "fake") query = query.eq("is_fake", true);
    if (filter.is_fake === "normal") query = query.eq("is_fake", false);

    return query;
  }

  const rows: TransactionRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await buildQuery(offset);
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }
    const pageRows = (data ?? []) as unknown as TransactionRow[];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
  }

  const groups = groupTransactionRows(rows);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rekap Penjualan Rajaklana";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Transaksi", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const headers = [
    "Tanggal",
    "No Transaksi",
    "Nama Outlet",
    "Merchant",
    "Produk",
    "QTY",
    "Harga Satuan",
    "Subtotal",
    "Potongan Transaksi",
    "Pendapatan Bersih",
    "Status",
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFB91C1C" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;

  for (const group of groups) {
    const row = sheet.addRow([
      isoToWIBDisplay(group.date),
      group.orderNumber ?? group.order_id,
      group.outlet,
      group.merchant,
      formatProductSummary(group.rows),
      group.qty,
      formatUnitPrices(group.rows),
      group.gross,
      group.fee,
      group.net,
      group.is_fake ? "Fake Order" : "Normal",
    ]);
    row.alignment = { vertical: "top", wrapText: true };
    row.getCell(6).numFmt = "#,##0";
    row.getCell(8).numFmt = "#,##0";
    row.getCell(9).numFmt = "#,##0";
    row.getCell(10).numFmt = "#,##0";
  }

  sheet.columns = [
    { width: 22 },
    { width: 40 },
    { width: 20 },
    { width: 16 },
    { width: 52 },
    { width: 10 },
    { width: 22 },
    { width: 18 },
    { width: 20 },
    { width: 22 },
    { width: 14 },
  ];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const body = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const filename = `transaksi_${filter.from}_to_${filter.to}.xlsx`;

  return new NextResponse(body, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}