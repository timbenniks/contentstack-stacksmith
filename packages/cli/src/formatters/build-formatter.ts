import { toCanonicalJson, type DiffResult, type PlanArtifact } from "@timbenniks/contentstack-stacksmith";

import type { BuildResult } from "../services/build-service.js";
import type { ImportResult } from "../services/import-service.js";
import type { ParentCliRuntimeContext } from "../utils/parent-cli-context.js";
import { SEVERITY_PREFIX } from "../services/audit-shared.js";

export class BuildFormatter {
  formatBuild(result: BuildResult): string {
    const lines = [
      `Built schema at ${result.schemaPath}`,
      `Manifest written to ${result.manifestPath}`,
      `Validation findings: ${result.findings.length}`,
    ];

    if (result.findings.length > 0) {
      lines.push("");
      for (const finding of result.findings) {
        const location = finding.fieldId ?? finding.entityId ?? "";
        lines.push(`  ${SEVERITY_PREFIX[finding.level]} ${finding.code}: ${finding.message}${location ? ` (${location})` : ""}`);
      }
    }

    return lines.join("\n");
  }

  formatPlan(plan: PlanArtifact): string {
    return [
      `Operations: ${plan.summary.total}`,
      `Creates: ${plan.summary.creates}`,
      `Updates: ${plan.summary.updates}`,
      `Deletes: ${plan.summary.deletes}`,
      `Blocked: ${plan.summary.blocked}`,
      "",
      "Dependency order:",
      ...plan.dependencyOrder.map((entityId) => `- ${entityId}`),
      "",
      "Dependency notes:",
      ...plan.dependencyNotes.map((note) => `- ${note}`),
      "",
      "Operations:",
      ...plan.operations.map((operation) => `- [${operation.status}] ${operation.summary}`),
    ].join("\n");
  }

  formatRemoteRuntimeContext(runtime: ParentCliRuntimeContext): string {
    const sourceLabel = {
      flag: "--management-token flag",
      "token-alias": runtime.tokenAlias ? `alias ${runtime.tokenAlias}` : "token alias",
      "cli-session": "csdx auth:login session",
      "cli-oauth": "csdx auth:login --oauth session",
      environment: "environment (CS_AUTHTOKEN)",
      prompt: "interactive prompt",
      missing: "none",
    }[runtime.managementToken.source];

    return [
      `Region: ${runtime.regionName}`,
      `CMA URL: ${runtime.cmaBaseUrl}`,
      `CDA URL: ${runtime.cdaBaseUrl}`,
      `UI Host: ${runtime.uiHost}`,
      `Token Source: ${sourceLabel}`,
    ].join("\n");
  }

  formatDiff(diff: DiffResult): string {
    if (diff.operations.length === 0) return "No differences found.";

    const kindSymbol: Record<string, string> = {
      create_entity: "+",
      delete_entity: "-",
      add_field: "+",
      remove_field: "-",
      rename_field: "→",
      update_entity: "~",
      update_field: "~",
      reorder_fields: "~",
    };

    const grouped = new Map<string, typeof diff.operations>();
    for (const op of diff.operations) {
      const key = op.entity.id;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(op);
    }

    const lines: string[] = [`Differences: ${diff.operations.length} operation(s)`, ""];
    for (const [entityId, ops] of grouped) {
      lines.push(`  ${entityId}:`);
      for (const op of ops) {
        const sym = kindSymbol[op.kind] ?? "?";
        lines.push(`    ${sym} ${op.summary}`);
        for (const detail of op.details) {
          if (detail.before !== undefined && detail.after !== undefined) {
            lines.push(`      ${detail.path}: ${JSON.stringify(detail.before)} -> ${JSON.stringify(detail.after)}`);
          }
        }
      }
    }

    return lines.join("\n");
  }

  formatJson(value: unknown): string {
    return toCanonicalJson(value);
  }

  formatImport(result: ImportResult): string {
    const lines = [
      `Imported models into ${result.cwd}`,
      `Schema written to ${result.schemaPath}`,
      `Build manifest written to ${result.buildManifestPath}`,
      `Import manifest written to ${result.manifestPath}`,
      `Generated files: ${result.generatedFiles.length}`,
      `Content types: ${result.contentTypeUids.length}`,
      `Global fields: ${result.globalFieldUids.length}`,
    ];

    if (result.scaffoldedFiles.length > 0) {
      lines.push("", "Scaffolded files:", ...result.scaffoldedFiles.map((file) => `- ${file}`));
    }

    return lines.join("\n");
  }
}
