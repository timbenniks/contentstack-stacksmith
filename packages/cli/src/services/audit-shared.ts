import type { RiskLevel } from "@timbenniks/contentstack-stacksmith";

export const SEVERITY_ORDER: ReadonlyArray<RiskLevel> = ["blocker", "high", "medium", "low"];

export const SEVERITY_PREFIX: Record<RiskLevel, string> = {
  blocker: "[BLOCKER]",
  high: "[HIGH]",
  medium: "[MEDIUM]",
  low: "[LOW]",
};

export const SEVERITY_TITLE: Record<RiskLevel, string> = {
  blocker: "Blockers",
  high: "High-severity warnings",
  medium: "Medium-severity warnings",
  low: "Informational",
};

export const USAGE_HIGH_THRESHOLD = 0.8;
export const USAGE_CRITICAL_THRESHOLD = 0.95;

export const ratio = (usage: number, limit: number | undefined): number => {
  if (!limit || limit <= 0) return 0;
  return usage / limit;
};

export const percentLabel = (r: number): string => `${Math.round(r * 100)}%`;
