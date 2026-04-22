import type { OrgAuditReport } from "@timbenniks/contentstack-stacksmith";

import { SEVERITY_ORDER, SEVERITY_PREFIX, SEVERITY_TITLE } from "../services/audit-shared.js";

const TRAFFIC_METRIC_UIDS = new Set(["bandwidth", "api_requests"]);

export class OrgAuditFormatter {
  formatText(report: OrgAuditReport): string {
    const lines: string[] = [];
    lines.push(`Organization: ${report.organizationName || report.organizationUid} (${report.organizationUid})`);
    lines.push(`Plan: ${report.plan.name}`);
    lines.push("");

    const featureEntries = Object.entries(report.features);
    if (featureEntries.length > 0) {
      lines.push(`Plan features (${featureEntries.length}):`);
      const sorted = [...featureEntries].sort(([a], [b]) => a.localeCompare(b));
      for (const [uid, feature] of sorted) {
        const available = feature.enabled && feature.limit > 0;
        const label = feature.name && feature.name !== uid ? `${uid} — ${feature.name}` : uid;
        if (feature.limit > 1) {
          lines.push(`  ${available ? "✓" : "✗"} ${label} (limit: ${feature.limit}${feature.max_limit && feature.max_limit !== feature.limit ? `/${feature.max_limit}` : ""})`);
        } else {
          lines.push(`  ${available ? "✓" : "✗"} ${label}`);
        }
      }
      lines.push("");
    }

    if (report.usage) {
      const { metrics, stacks } = report.usage;
      const metricEntries = Object.entries(metrics).filter(([uid]) => !TRAFFIC_METRIC_UIDS.has(uid));
      if (metricEntries.length > 0) {
        lines.push(`Usage (org-wide, last 30 days):`);
        const sortedMetrics = [...metricEntries].sort(([a], [b]) => a.localeCompare(b));
        for (const [uid, metric] of sortedMetrics) {
          const label = uid.replaceAll("_", " ");
          if (metric.limit && metric.limit > 0) {
            const percent = Math.round((metric.usage / metric.limit) * 100);
            lines.push(`  ${label}: ${metric.usage.toLocaleString("en-US")} / ${metric.limit.toLocaleString("en-US")} (${percent}%)`);
          } else {
            lines.push(`  ${label}: ${metric.usage.toLocaleString("en-US")}`);
          }
        }
        lines.push("");
      }

      if (stacks.length > 0) {
        lines.push(`Stacks surveyed: ${stacks.length}`);
        const sortedStacks = [...stacks].sort((a, b) => b.contentTypes - a.contentTypes).slice(0, 10);
        for (const row of sortedStacks) {
          lines.push(`  ${row.name} (${row.apiKey}): ${row.contentTypes} CT, ${row.globalFields} GF, ${row.entries} entries, ${row.assets} assets`);
        }
        if (stacks.length > 10) {
          lines.push(`  …and ${stacks.length - 10} more (sorted by content-type count)`);
        }
        lines.push("");
      }
    }

    lines.push(
      `Summary: ${report.summary.blockers} blocker(s), ${report.summary.warnings} warning(s), ${report.summary.passes} pass(es).`,
    );

    if (report.findings.length > 0) {
      lines.push("");
      lines.push("Findings:");
      for (const level of SEVERITY_ORDER) {
        for (const finding of report.findings) {
          if (finding.level !== level) continue;
          lines.push(`  ${SEVERITY_PREFIX[level]} ${finding.code}: ${finding.message}`);
          if (finding.remediation) {
            lines.push(`      → ${finding.remediation}`);
          }
        }
      }
    }

    return lines.join("\n");
  }

  /**
   * Render the org audit report as a support-ticket-friendly Markdown document.
   * Users can paste this into a Contentstack support ticket or save it as an
   * artifact for later review.
   */
  formatMarkdown(report: OrgAuditReport): string {
    const lines: string[] = [];
    const timestamp = new Date().toISOString();
    lines.push(`# Contentstack Organization Audit Report`);
    lines.push("");
    lines.push(`- **Organization:** ${report.organizationName || report.organizationUid} (\`${report.organizationUid}\`)`);
    lines.push(`- **Plan:** ${report.plan.name}`);
    lines.push(`- **Generated:** ${timestamp}`);
    lines.push(`- **Summary:** ${report.summary.blockers} blocker(s), ${report.summary.warnings} warning(s), ${report.summary.passes} pass(es)`);
    lines.push("");

    if (report.findings.length > 0) {
      lines.push("## Findings");
      lines.push("");
      for (const level of SEVERITY_ORDER) {
        const items = report.findings.filter((f) => f.level === level);
        if (items.length === 0) continue;
        lines.push(`### ${SEVERITY_TITLE[level]} (${items.length})`);
        lines.push("");
        for (const finding of items) {
          lines.push(`- **\`${finding.code}\`** — ${finding.message}`);
          if (finding.remediation) lines.push(`  - _Remediation:_ ${finding.remediation}`);
          if (finding.planValue !== undefined) lines.push(`  - _Plan value:_ \`${JSON.stringify(finding.planValue)}\``);
          if (finding.localValue !== undefined) lines.push(`  - _Observed:_ \`${JSON.stringify(finding.localValue)}\``);
        }
        lines.push("");
      }
    }

    const featureEntries = Object.entries(report.features);
    if (featureEntries.length > 0) {
      lines.push(`## Plan features (${featureEntries.length})`);
      lines.push("");
      lines.push("| Feature | Enabled | Limit | Max |");
      lines.push("| --- | --- | --- | --- |");
      const sorted = [...featureEntries].sort(([a], [b]) => a.localeCompare(b));
      for (const [uid, feature] of sorted) {
        const name = feature.name && feature.name !== uid ? `${uid} (${feature.name})` : uid;
        const enabled = feature.enabled ? "yes" : "no";
        const limit = feature.limit > 1 ? feature.limit.toLocaleString("en-US") : "—";
        const max = feature.max_limit && feature.max_limit !== feature.limit ? feature.max_limit.toLocaleString("en-US") : "—";
        lines.push(`| ${name} | ${enabled} | ${limit} | ${max} |`);
      }
      lines.push("");
    }

    if (report.usage) {
      lines.push("## Usage snapshot (last 30 days)");
      lines.push("");
      const metricEntries = Object.entries(report.usage.metrics).filter(([uid]) => !TRAFFIC_METRIC_UIDS.has(uid));
      if (metricEntries.length > 0) {
        lines.push("| Metric | Used | Limit | % |");
        lines.push("| --- | --- | --- | --- |");
        const sorted = [...metricEntries].sort(([a], [b]) => a.localeCompare(b));
        for (const [uid, metric] of sorted) {
          const label = uid.replaceAll("_", " ");
          const used = metric.usage.toLocaleString("en-US");
          const limit = metric.limit && metric.limit > 0 ? metric.limit.toLocaleString("en-US") : "—";
          const percent = metric.limit && metric.limit > 0 ? `${Math.round((metric.usage / metric.limit) * 100)}%` : "—";
          lines.push(`| ${label} | ${used} | ${limit} | ${percent} |`);
        }
        lines.push("");
      }

      if (report.usage.stacks.length > 0) {
        lines.push(`### Stack-level usage (${report.usage.stacks.length} stacks)`);
        lines.push("");
        lines.push("| Stack | API key | Content types | Global fields | Entries | Assets |");
        lines.push("| --- | --- | --- | --- | --- | --- |");
        const sortedStacks = [...report.usage.stacks].sort((a, b) => b.contentTypes - a.contentTypes);
        for (const row of sortedStacks) {
          lines.push(`| ${row.name || "(unnamed)"} | \`${row.apiKey}\` | ${row.contentTypes} | ${row.globalFields} | ${row.entries.toLocaleString("en-US")} | ${row.assets.toLocaleString("en-US")} |`);
        }
        lines.push("");
      }
    }

    lines.push("---");
    lines.push("");
    lines.push("_Generated by `csdx stacksmith:audit-org` ([@timbenniks/contentstack-stacksmith-cli](https://github.com/timbenniks/contentstack-stacksmith))_");
    lines.push("");

    return lines.join("\n");
  }
}
