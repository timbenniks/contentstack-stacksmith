import { writeFile } from "node:fs/promises";
import { extname, resolve as resolvePath } from "node:path";

import { Command } from "@contentstack/cli-command";
import { configHandler, flags, type FlagInput } from "@contentstack/cli-utilities";

import { OutputFormatterService } from "../../formatters/output-formatter-service.js";
import { ManagementClientFactory } from "../../integrations/contentstack/management-client-factory.js";
import { OrganizationRepository } from "../../integrations/contentstack/organization-repository.js";
import { BuildService } from "../../services/build-service.js";
import { OrgAuditService, OrgAuditServiceError } from "../../services/org-audit-service.js";
import { automationFlags, buildFlags } from "../../utils/common-flags.js";
import { resolveUserAuthToken } from "../../utils/token.js";

const USER_AUTH_HINT = [
  "This command requires a user session, not a stack-scoped management token.",
  "Run one of:",
  "  csdx auth:login",
  "  csdx auth:login --oauth",
].join("\n");

const MGMT_TOKEN_REJECT = [
  "Management tokens are stack-scoped and cannot read /v3/organizations/{uid}.",
  "Drop --management-token / --token-alias / CS_AUTHTOKEN for this command and run one of:",
  "  csdx auth:login",
  "  csdx auth:login --oauth",
].join("\n");

const ORG_UID_MISSING = [
  "Could not determine the organization UID. Pass one of:",
  "  --org <uid>",
  "  --stack <api_key>               (we'll derive the org UID from the stack)",
  "  (or run csdx auth:login --oauth and retry — the org UID is picked up from the session)",
].join("\n");

export default class ModelsAuditOrg extends Command {
  static description = "Audit your organization's plan capabilities and cross-reference them against your local DSL.";

  static examples = [
    "$ csdx stacksmith:audit-org",
    "$ csdx stacksmith:audit-org --org blt-org-uid",
    "$ csdx stacksmith:audit-org --cwd apps/simple-blog",
    "$ csdx stacksmith:audit-org --stack blt123abc --cwd apps/example-project --json",
    "$ csdx stacksmith:audit-org --include-usage --output audit-report.md",
    "$ csdx stacksmith:audit-org --include-usage --stack blt123abc --output report.json",
  ];

  static flags: FlagInput = {
    ...buildFlags,
    org: flags.string({
      description: "Organization UID. Falls back to your csdx auth:login --oauth session or --stack derivation.",
    }),
    stack: flags.string({
      char: "s",
      description: "Stack API key. Used to derive the org UID when --org is omitted, and to focus stack-usage findings when --include-usage is on.",
    }),
    "include-usage": flags.boolean({
      description: "Also fetch CMS usage analytics (stack counts, entries, assets, etc.) and cross-reference them against plan limits. Requires org analytics to be enabled.",
      default: false,
    }),
    output: flags.string({
      description: "Write the full audit report to this file path. Format is inferred from the extension: .json or .md (default: .md). Useful for attaching to Contentstack support tickets.",
    }),
    "output-format": flags.string({
      description: "Explicit output format for --output. Overrides the extension inference.",
      options: ["json", "md"],
    }),
    // Hidden: these are accepted to emit a helpful redirect rather than oclif's generic "Nonexistent flag".
    "management-token": flags.string({ hidden: true }),
    "token-alias": flags.string({ hidden: true, char: "t" }),
    ...automationFlags,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ModelsAuditOrg);

    // Redirect users who passed management-token-shaped flags to the user-auth flow.
    if (flags["management-token"] || flags["token-alias"]) {
      this.error(MGMT_TOKEN_REJECT, { exit: 1 });
    }

    const token = resolveUserAuthToken();
    if (token.source === "missing") {
      this.error(USER_AUTH_HINT, { exit: 1 });
    }

    // Additional safety: CS_AUTHTOKEN env vars are treated as management-kind by resolveToken;
    // if we're here we already have a session/oauth token, so env vars didn't win — but warn if
    // they're present since they'll be ignored.
    if (process.env.CS_AUTHTOKEN || process.env.CONTENTSTACK_MANAGEMENT_TOKEN) {
      this.warn("CS_AUTHTOKEN / CONTENTSTACK_MANAGEMENT_TOKEN env vars are ignored by this command — org endpoints need a user session.");
    }

    const cmaBaseUrl = this.cmaAPIUrl;
    const managementClientFactory = new ManagementClientFactory();

    // Resolve org UID via the three-tier fallback.
    let orgUid = flags.org;

    if (!orgUid) {
      const oauthOrgUid = configHandler.get("oauthOrgUid");
      if (typeof oauthOrgUid === "string" && oauthOrgUid.length > 0) {
        orgUid = oauthOrgUid;
      }
    }

    if (!orgUid && flags.stack) {
      try {
        const client = managementClientFactory.create({
          stackApiKey: flags.stack,
          managementToken: token,
          cmaBaseUrl,
        });
        const repository = new OrganizationRepository(client);
        const stackOrg = await repository.fetchStackOrg(flags.stack);
        if (stackOrg.organization_uid) {
          orgUid = stackOrg.organization_uid;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.error(
          `Could not derive org UID from stack ${flags.stack}: ${message}. Pass --org <uid> explicitly.`,
          { exit: 1 },
        );
      }
    }

    if (!orgUid) {
      this.error(ORG_UID_MISSING, { exit: 1 });
    }

    // Optional local schema for cross-reference.
    let localSchema;
    if (flags.cwd || flags.config) {
      try {
        const build = await new BuildService().build({
          cwd: flags.cwd,
          configPath: flags.config,
          outDirOverride: flags["out-dir"],
        });
        localSchema = build.schema;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.error(`Could not build local DSL for cross-reference: ${message}`, { exit: 1 });
      }
    }

    const formatter = new OutputFormatterService();
    const service = new OrgAuditService(managementClientFactory);

    let report;
    try {
      report = await service.audit({
        organizationUid: orgUid,
        localSchema,
        remoteOptions: {
          // The org endpoint doesn't need an api_key, but ManagementClientFactory expects one.
          // We pass an empty string; the CMA ignores it for org-scoped paths.
          stackApiKey: flags.stack ?? "",
          managementToken: token,
          cmaBaseUrl,
        },
        ...(flags["include-usage"]
          ? {
              usageOptions: {
                auth: token,
                appBaseUrl: this.uiHost,
                ...(flags.stack ? { targetStackApiKey: flags.stack } : {}),
              },
            }
          : {}),
      });
    } catch (error) {
      if (error instanceof OrgAuditServiceError) {
        this.error(error.message, { exit: 1 });
      }
      throw error;
    }

    if (flags.json) {
      this.log(formatter.formatJson(report));
    } else {
      this.log(formatter.formatOrgAudit(report));
    }

    if (flags.output) {
      const extension = extname(flags.output).toLowerCase().replace(/^\./, "");
      const format = (flags["output-format"] ?? (extension === "json" ? "json" : "md")).toLowerCase();
      const outputPath = resolvePath(process.cwd(), flags.output);
      const body = format === "json" ? formatter.formatJson(report) : formatter.formatOrgAuditMarkdown(report);
      try {
        await writeFile(outputPath, `${body}\n`, "utf8");
        this.log("");
        this.log(`Wrote audit report to ${outputPath}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.warn(`Could not write report to ${outputPath}: ${message}`);
      }
    }

    if (report.summary.blockers > 0) {
      this.exit(1);
    }
  }
}
