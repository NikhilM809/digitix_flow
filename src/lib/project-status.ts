import { ProjectStatus } from "@prisma/client";
import { PROJECT_STATUS_ORDER } from "@/lib/constants";

export const INACTIVE_STATUSES: ProjectStatus[] = ["CLOSE", "CANCEL"];

export function isInactiveStatus(status: ProjectStatus) {
  return status === "CLOSE" || status === "CANCEL";
}

export function canSelectCancel(current: ProjectStatus) {
  return current === "BID" || current === "CANCEL";
}

export function statusesAvailable(current: ProjectStatus) {
  const base = PROJECT_STATUS_ORDER.filter((status) => status !== "CANCEL");
  return canSelectCancel(current) ? [...base, "CANCEL" as const] : base;
}
