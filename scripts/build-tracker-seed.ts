import ExcelJS from "exceljs";
import { writeFileSync } from "fs";

const SOURCE =
  "C:/Users/HP/Downloads/DigitiXLabs_Pureprofile_APR2026_31MAR2027_Efforts_Tracker (1).xlsx";

const SKIP_NAMES = /^(remittance|total|discount|pending discount)/i;

export type SeedProject = {
  key: string;
  code: string;
  jobCode: string;
  name: string;
  status: "NEED_TO_START" | "SCRIPT_WIP" | "CHANGES" | "LIVE" | "CLOSE";
  sellValue: number;
  startDate: string | null;
  eta: string | null;
  actualCompletionDate: string | null;
  billed: boolean;
  poc: string;
  remarks: string;
};

export type SeedHour = {
  projectKey: string;
  date: string;
  workType: "CHANGES" | "LIVE" | "INITIAL_SCRIPTING";
  hours: number;
  notes: string;
};

function cell(value: unknown): unknown {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      return (obj.richText as { text: string }[]).map((part) => part.text).join("");
    }
    if (typeof obj.text === "string") return obj.text;
    if ("result" in obj) return obj.result ?? null;
  }
  return value;
}

function str(value: unknown) {
  return value == null ? "" : String(value).replace(/\s+/g, " ").trim();
}

function num(value: unknown) {
  if (typeof value === "number") return value;
  const parsed = Number(str(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
  }
  const text = str(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const mdy = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }
  return null;
}

function extractCode(name: string) {
  const match = name.match(/A-(\d{4,6})/i) || name.match(/\b(\d{5,6})\b/);
  if (!match) return "";
  return `A-${String(match[1]).replace(/\D/g, "")}`;
}

function mapStatus(label: string): SeedProject["status"] {
  const value = label.toLowerCase();
  if (value.includes("closed")) return "CLOSE";
  if (value.includes("full launched") || value === "launched") return "LIVE";
  if (value.includes("programming") || value === "qa") return "SCRIPT_WIP";
  if (value.includes("delivered") || value.includes("changes")) return "CHANGES";
  return "NEED_TO_START";
}

function mapWorkType(task: string): SeedHour["workType"] {
  const value = task.toLowerCase();
  if (value.includes("initial")) return "INITIAL_SCRIPTING";
  if (value.includes("launch") || value.includes("lauch") || value.includes("managemnt") || value.includes("management")) {
    return "LIVE";
  }
  return "CHANGES";
}

function scoreName(changeName: string, projectName: string) {
  const a = changeName.toLowerCase();
  const b = projectName.toLowerCase();
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80 + Math.min(a.length, b.length) / 20;
  return 0;
}

async function readSheet(name: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SOURCE);
  const sheet = workbook.getWorksheet(name);
  if (!sheet) throw new Error(`Missing sheet ${name}`);
  const rows: unknown[][] = [];
  const maxCol = Math.min(sheet.columnCount || 20, 20);
  for (let r = 2; r <= (sheet.rowCount || 1); r++) {
    const row = sheet.getRow(r);
    const vals: unknown[] = [];
    let any = false;
    for (let c = 1; c <= maxCol; c++) {
      const value = cell(row.getCell(c).value);
      vals.push(value);
      if (value != null && value !== "") any = true;
    }
    if (any) rows.push(vals);
  }
  return rows;
}

async function main() {
  const billingRows = await readSheet("Project_Billing_details_status");
  const changeRows = await readSheet("Changes");
  const usedCodes = new Set<string>();
  const projects: SeedProject[] = [];

  for (const row of billingRows) {
    const name = str(row[1]);
    if (!name || SKIP_NAMES.test(name)) continue;
    const jobCode = extractCode(name);
    let code = jobCode || `DX-${1000 + projects.length + 1}`;
    let suffix = 2;
    while (usedCodes.has(code)) {
      code = `${jobCode || "DX"}-${suffix++}`;
    }
    usedCodes.add(code);
    const startDate = isoDate(row[3]);
    const delivery = isoDate(row[4]);
    const status = mapStatus(str(row[0]));
    projects.push({
      key: `p${projects.length + 1}`,
      code,
      jobCode,
      name,
      status,
      sellValue: num(row[2]),
      startDate,
      eta: delivery ?? startDate,
      actualCompletionDate: status === "CLOSE" ? delivery : null,
      billed: str(row[5]).toLowerCase() === "yes",
      poc: str(row[11]),
      remarks: str(row[7]) || str(row[14]),
    });
  }

  const hours: SeedHour[] = [];
  const unmatched: string[] = [];

  for (const row of changeRows) {
    const name = str(row[2]);
    const hoursValue = num(row[4]);
    const date = isoDate(row[1]);
    if (!name || !date || hoursValue <= 0) continue;

    let project =
      projects.find((item) => item.name.toLowerCase() === name.toLowerCase()) ??
      null;
    if (!project) {
      const jobCode = extractCode(name);
      const candidates = jobCode ? projects.filter((item) => item.jobCode === jobCode) : [];
      if (candidates.length === 1) project = candidates[0];
      else if (candidates.length > 1) {
        project = [...candidates].sort((a, b) => scoreName(name, b.name) - scoreName(name, a.name))[0];
      }
    }
    if (!project) {
      const jobCode = extractCode(name);
      let code = jobCode || `DX-${1000 + projects.length + 1}`;
      let suffix = 2;
      while (usedCodes.has(code)) {
        code = `${jobCode || "DX"}-${suffix++}`;
      }
      usedCodes.add(code);
      project = {
        key: `p${projects.length + 1}`,
        code,
        jobCode,
        name,
        status: "CHANGES",
        sellValue: 0,
        startDate: date,
        eta: date,
        actualCompletionDate: null,
        billed: /checked and billed/i.test(str(row[5])),
        poc: "",
        remarks: "Created from the Changes sheet; not listed on Project_Billing_details_status.",
      };
      projects.push(project);
      unmatched.push(name);
    }
    const remark = str(row[5]);
    hours.push({
      projectKey: project.key,
      date,
      workType: mapWorkType(str(row[3])),
      hours: hoursValue,
      notes: /billed/i.test(remark) ? "" : remark,
    });
  }

  const payload = {
    clientName: "Pureprofile",
    currencyCode: "AUD",
    projects,
    hours,
    unmatched,
  };
  writeFileSync("prisma/tracker-seed.json", JSON.stringify(payload));
  console.log(
    JSON.stringify({
      projects: projects.length,
      hours: hours.length,
      billed: projects.filter((project) => project.billed).length,
      unmatched,
      byStatus: projects.reduce<Record<string, number>>((sum, project) => {
        sum[project.status] = (sum[project.status] ?? 0) + 1;
        return sum;
      }, {}),
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
