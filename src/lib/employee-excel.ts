import ExcelJS from "exceljs";
import { Role } from "@prisma/client";
import { parseRole } from "@/lib/roles";

export type EmployeeImportRow = {
  row: number;
  name: string;
  email: string;
  role: Role;
  error?: string;
};

function cellText(value: ExcelJS.CellValue | undefined) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (typeof value === "object" && "text" in value) return String(value.text ?? "").trim();
  if (typeof value === "object" && "result" in value) return cellText(value.result as ExcelJS.CellValue);
  return String(value).trim();
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function columnIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.includes(header));
}

export async function parseEmployeeWorkbook(buffer: ArrayBuffer | Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { error: "The Excel file has no worksheet." as const, rows: [] as EmployeeImportRow[] };

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = normalizeHeader(cellText(cell.value));
  });

  const nameCol = columnIndex(headers, ["name", "employeename", "fullname", "employee"]);
  const emailCol = columnIndex(headers, ["email", "emailid", "emailaddress", "workemail"]);
  const roleCol = columnIndex(headers, ["role", "designation", "usertype"]);

  if (nameCol < 0 || emailCol < 0) {
    return {
      error: "The file must have Name and Email columns. Download the template if you are unsure.",
      rows: [] as EmployeeImportRow[],
    };
  }

  const rows: EmployeeImportRow[] = [];
  const seen = new Set<string>();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = cellText(row.getCell(nameCol).value);
    const email = cellText(row.getCell(emailCol).value).toLowerCase();
    const roleValue = roleCol >= 0 ? cellText(row.getCell(roleCol).value) : "";
    if (!name && !email) return;
    if (!name || !email) {
      rows.push({ row: rowNumber, name, email, role: Role.EMPLOYEE, error: "Name and email are required." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      rows.push({ row: rowNumber, name, email, role: Role.EMPLOYEE, error: "Email is not valid." });
      return;
    }
    const role = parseRole(roleValue, Role.EMPLOYEE);
    if (!role) {
      rows.push({
        row: rowNumber,
        name,
        email,
        role: Role.EMPLOYEE,
        error: "Role must be Employee, Manager, Senior Manager, or Admin.",
      });
      return;
    }
    if (seen.has(email)) {
      rows.push({ row: rowNumber, name, email, role, error: "This email appears more than once in the file." });
      return;
    }
    seen.add(email);
    rows.push({ row: rowNumber, name, email, role });
  });

  return { rows };
}

export async function buildEmployeeTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Employees");
  sheet.columns = [
    { header: "Name", key: "name", width: 28 },
    { header: "Email", key: "email", width: 36 },
    { header: "Role", key: "role", width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({ name: "Priya Nair", email: "priya@digitix.local", role: "Admin" });
  sheet.addRow({ name: "Asha Menon", email: "asha@digitix.local", role: "Senior Manager" });
  sheet.addRow({ name: "Arjun Mehta", email: "arjun@digitix.local", role: "Manager" });
  sheet.addRow({ name: "John D'Souza", email: "john@digitix.local", role: "Employee" });
  const note = workbook.addWorksheet("Instructions");
  note.getColumn(1).width = 90;
  note.addRow(["Use the Employees sheet. Keep the header row."]);
  note.addRow(["Required columns: Name, Email."]);
  note.addRow(["Role is optional. Allowed values: Employee, Manager, Senior Manager, Admin. Blank defaults to Employee."]);
  note.addRow(["Existing emails are updated (name and role). New emails are created with the default password Digitix@123."]);
  return workbook.xlsx.writeBuffer();
}
