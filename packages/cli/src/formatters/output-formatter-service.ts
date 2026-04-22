import type { DiffResult, OrgAuditReport, PlanArtifact } from "@timbenniks/contentstack-stacksmith";

import type { BuildResult } from "../services/build-service.js";
import type { ImportResult } from "../services/import-service.js";
import type { ParentCliRuntimeContext } from "../utils/parent-cli-context.js";
import { BuildFormatter } from "./build-formatter.js";
import { OrgAuditFormatter } from "./org-audit-formatter.js";

/**
 * Thin facade that delegates to domain-specific formatters. Exists so existing
 * callers (commands) can continue to instantiate a single formatter; internally
 * the work is split by concern (build/plan/diff/import vs. org audit).
 */
export class OutputFormatterService {
  private readonly build = new BuildFormatter();
  private readonly orgAudit = new OrgAuditFormatter();

  formatBuild(result: BuildResult): string {
    return this.build.formatBuild(result);
  }

  formatPlan(plan: PlanArtifact): string {
    return this.build.formatPlan(plan);
  }

  formatRemoteRuntimeContext(runtime: ParentCliRuntimeContext): string {
    return this.build.formatRemoteRuntimeContext(runtime);
  }

  formatDiff(diff: DiffResult): string {
    return this.build.formatDiff(diff);
  }

  formatJson(value: unknown): string {
    return this.build.formatJson(value);
  }

  formatImport(result: ImportResult): string {
    return this.build.formatImport(result);
  }

  formatOrgAudit(report: OrgAuditReport): string {
    return this.orgAudit.formatText(report);
  }

  formatOrgAuditMarkdown(report: OrgAuditReport): string {
    return this.orgAudit.formatMarkdown(report);
  }
}
