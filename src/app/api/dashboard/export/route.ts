import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ExportRow = Array<string | number | null>;

function safeString(value: unknown) {
  if (value == null) return "";
  return String(value);
}

export async function POST(request: Request) {
  const profile = await requireProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { headers?: unknown; rows?: unknown; filename?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body tidak valid" },
      { status: 400 },
    );
  }

  const headers = Array.isArray(body.headers)
    ? body.headers.map(safeString)
    : [];
  const rows = Array.isArray(body.rows)
    ? (body.rows as unknown[]).filter((r) => Array.isArray(r)).map((r) =>
        (r as unknown[]).map((cell) =>
          cell == null ? "" : (cell as ExportRow[number]),
        ),
      )
    : [];

  const filename =
    typeof body.filename === "string" && body.filename.trim()
      ? body.filename.trim().replace(/\.(csv|xlsx)$/i, "") + ".xlsx"
      : "dashboard_export.xlsx";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rekap Penjualan Rajaklana";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Data", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFB91C1C" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;

  for (const row of rows) {
    const excelRow = sheet.addRow(row as ExportRow);
    excelRow.alignment = { vertical: "top", wrapText: true };
  }

  sheet.columns = headers.map((header) => ({
    width: Math.max(14, Math.min(40, header.length + 4)),
  }));

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(1, headers.length) },
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
  const bodyBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  return new NextResponse(bodyBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}