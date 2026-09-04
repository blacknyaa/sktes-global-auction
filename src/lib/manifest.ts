import ExcelJS from "exceljs";

/**
 * Excel manifest import.
 *
 * Sellers already keep their lot contents in a spreadsheet, so the platform
 * meets them there instead of asking anyone to retype 400 rows into a form.
 * Column order does not matter - headers are matched by name, in Japanese or
 * English - and every row that cannot be read is reported back rather than
 * silently dropped.
 */

export type ManifestRow = {
  lineNo: number;
  maker: string;
  model: string;
  cpu: string | null;
  ramGb: number | null;
  storage: string | null;
  gpu: string | null;
  screen: string | null;
  grade: string | null;
  quantity: number;
  note: string | null;
};

export type ManifestParseResult = {
  rows: ManifestRow[];
  errors: { row: number; reason: string }[];
  totalUnits: number;
  sheetName: string;
  headerRow: number;
};

const HEADER_ALIASES: Record<keyof Omit<ManifestRow, "lineNo">, string[]> = {
  maker: ["maker", "brand", "manufacturer", "メーカー", "メーカ", "ブランド", "厂商", "品牌"],
  model: ["model", "model no", "part number", "型番", "モデル", "機種", "型号"],
  cpu: ["cpu", "processor", "プロセッサ", "処理装置", "处理器"],
  ramGb: ["ram", "ram(gb)", "ram gb", "memory", "memory(gb)", "メモリ", "メモリー", "内存"],
  storage: ["storage", "hdd", "ssd", "disk", "ストレージ", "容量", "存储"],
  gpu: ["gpu", "graphics", "vga", "グラフィック", "显卡"],
  screen: ["screen", "display", "size", "画面", "液晶", "画面サイズ", "屏幕"],
  grade: ["grade", "rank", "condition grade", "グレード", "ランク", "等级"],
  quantity: ["quantity", "qty", "units", "count", "数量", "台数", "个数"],
  note: ["note", "notes", "remarks", "comment", "備考", "メモ", "备注"],
};

function normalise(value: unknown): string {
  return String(value ?? "")
    .replace(/[\s　]+/g, " ")
    .replace(/[（）]/g, (m) => (m === "（" ? "(" : ")"))
    .trim()
    .toLowerCase();
}

function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return "";
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text.trim();
    if ("result" in v) return String(v.result ?? "").trim();
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((r) => r.text).join("").trim();
    }
    return "";
  }
  return String(v).trim();
}

function toInt(text: string): number | null {
  const m = text.replace(/[^\d.-]/g, "");
  if (!m) return null;
  const n = Number(m);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export async function parseManifest(
  buffer: ArrayBuffer | Buffer
): Promise<ManifestParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) {
    return { rows: [], errors: [{ row: 0, reason: "シートが見つかりません" }], totalUnits: 0, sheetName: "-", headerRow: 0 };
  }

  // Find the header row: the first row within the top 20 that matches at
  // least two known column names. Sellers often put a title above the table.
  let headerRow = 0;
  let mapping: Partial<Record<keyof Omit<ManifestRow, "lineNo">, number>> = {};

  for (let r = 1; r <= Math.min(20, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const candidate: typeof mapping = {};
    let hits = 0;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const text = normalise(cellText(cell));
      if (!text) return;
      for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
        if (aliases.includes(text)) {
          candidate[field as keyof typeof mapping] = col;
          hits++;
        }
      }
    });
    if (hits >= 2) {
      headerRow = r;
      mapping = candidate;
      break;
    }
  }

  if (!headerRow || mapping.maker === undefined || mapping.model === undefined) {
    return {
      rows: [],
      errors: [
        {
          row: 0,
          reason:
            "メーカーと型番の列が見つかりませんでした。テンプレートの列名をご確認ください。",
        },
      ],
      totalUnits: 0,
      sheetName: ws.name,
      headerRow: 0,
    };
  }

  const rows: ManifestRow[] = [];
  const errors: { row: number; reason: string }[] = [];
  let lineNo = 0;

  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (field: keyof typeof mapping) =>
      mapping[field] ? cellText(row.getCell(mapping[field]!)) : "";

    const maker = get("maker");
    const model = get("model");
    if (!maker && !model) continue; // blank spacer row

    if (!maker || !model) {
      errors.push({ row: r, reason: "メーカーまたは型番が空欄です" });
      continue;
    }

    const qtyText = get("quantity");
    const quantity = qtyText ? toInt(qtyText) : 1;
    if (quantity === null || quantity <= 0) {
      errors.push({ row: r, reason: `数量を数値として読めません（${qtyText}）` });
      continue;
    }

    lineNo++;
    rows.push({
      lineNo,
      maker,
      model,
      cpu: get("cpu") || null,
      ramGb: toInt(get("ramGb")),
      storage: get("storage") || null,
      gpu: get("gpu") || null,
      screen: get("screen") || null,
      grade: get("grade")?.toUpperCase() || null,
      quantity,
      note: get("note") || null,
    });
  }

  return {
    rows,
    errors,
    totalUnits: rows.reduce((sum, r) => sum + r.quantity, 0),
    sheetName: ws.name,
    headerRow,
  };
}

const TEMPLATE_HEADERS = [
  "Maker / メーカー",
  "Model / 型番",
  "CPU",
  "RAM(GB) / メモリ",
  "Storage / ストレージ",
  "GPU",
  "Screen / 画面",
  "Grade / グレード",
  "Quantity / 数量",
  "Note / 備考",
];

const TEMPLATE_SAMPLE = [
  ["Dell", "Latitude 5420", "Core i5-1135G7", 16, "SSD 256GB NVMe", "", "14 inch", "A", 120, ""],
  ["HP", "EliteBook 840 G8", "Core i7-1165G7", 16, "SSD 512GB NVMe", "", "14 inch", "B", 80, "外装傷あり"],
  ["Lenovo", "ThinkPad T14 Gen 2", "Ryzen 5 PRO 5650U", 8, "SSD 256GB NVMe", "", "14 inch", "B", 60, ""],
];

function styleHeader(ws: ExcelJS.Worksheet) {
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  header.height = 22;
  header.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1A48AD" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = { bottom: { style: "thin", color: { argb: "FF0D1F45" } } };
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

export async function buildTemplateWorkbook(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SK TES Global Auction";
  const ws = wb.addWorksheet("Manifest");

  ws.addRow(TEMPLATE_HEADERS);
  TEMPLATE_SAMPLE.forEach((r) => ws.addRow(r));
  ws.columns.forEach((c, i) => {
    c.width = [14, 26, 22, 13, 22, 18, 12, 10, 12, 24][i] ?? 16;
  });
  styleHeader(ws);

  const notes = wb.addWorksheet("読み方");
  notes.getColumn(1).width = 100;
  [
    "このテンプレートはロット明細の取り込み用です。",
    "",
    "・列の順番は自由です。ヘッダーの名前で自動的に判別します。",
    "・日本語・英語どちらのヘッダーでも読み取れます（例: メーカー / Maker）。",
    "・表の上にタイトル行があっても構いません。上から20行以内にヘッダーがあれば認識します。",
    "・メーカーと型番は必須です。数量は空欄の場合1として扱います。",
    "・読み取れなかった行は取り込み前のプレビューで一覧表示され、黙って捨てられることはありません。",
  ].forEach((line) => notes.addRow([line]));

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function buildManifestWorkbook(
  lotNumber: string,
  title: string,
  rows: ManifestRow[]
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SK TES Global Auction";
  const ws = wb.addWorksheet(lotNumber.slice(0, 30));

  ws.addRow(TEMPLATE_HEADERS);
  rows.forEach((r) =>
    ws.addRow([
      r.maker,
      r.model,
      r.cpu ?? "",
      r.ramGb ?? "",
      r.storage ?? "",
      r.gpu ?? "",
      r.screen ?? "",
      r.grade ?? "",
      r.quantity,
      r.note ?? "",
    ])
  );
  ws.columns.forEach((c, i) => {
    c.width = [14, 26, 22, 13, 22, 18, 12, 10, 12, 24][i] ?? 16;
  });
  styleHeader(ws);

  const total = rows.reduce((s, r) => s + r.quantity, 0);
  const totalRow = ws.addRow(["", "", "", "", "", "", "", "TOTAL", total, ""]);
  totalRow.font = { bold: true };

  const meta = wb.addWorksheet("Lot");
  meta.getColumn(1).width = 22;
  meta.getColumn(2).width = 70;
  meta.addRow(["Lot number", lotNumber]);
  meta.addRow(["Title", title]);
  meta.addRow(["Lines", rows.length]);
  meta.addRow(["Total units", total]);
  meta.addRow(["Exported at", new Date().toISOString()]);
  meta.getColumn(1).font = { bold: true };

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
