import type { CompiledEntity, CompiledField, SchemaArtifact } from "@timbenniks/contentstack-stacksmith";
import { buildDependencyGraph, toCanonicalJson } from "@timbenniks/contentstack-stacksmith";

export type DocsFormat = "md" | "json" | "html";

interface DocsField {
  uid: string;
  kind: CompiledField["kind"];
  required: boolean;
  description?: string | undefined;
}

interface DocsEntity {
  uid: string;
  title: string;
  kind: CompiledEntity["kind"];
  description?: string | undefined;
  fields: DocsField[];
  dependencies: Array<{
    uid: string;
    kind: CompiledEntity["kind"];
    reason: string;
    description: string;
  }>;
}

interface DocsDocument {
  projectName: string;
  summary: {
    totalEntities: number;
    contentTypes: number;
    globalFields: number;
  };
  globalFields: DocsEntity[];
  contentTypes: DocsEntity[];
  dependencyGraph: {
    nodes: Array<{
      uid: string;
      title: string;
      kind: CompiledEntity["kind"];
    }>;
    edges: Array<{
      source: string;
      target: string;
      reason: string;
      description: string;
    }>;
  };
}

const fieldRow = (field: DocsField): string => {
  const req = field.required ? "Yes" : "No";
  const desc = field.description ?? "";
  return `| \`${field.uid}\` | ${field.kind} | ${req} | ${desc} |`;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const mapEntity = (entity: CompiledEntity): DocsEntity => ({
  uid: entity.uid,
  title: entity.title,
  kind: entity.kind,
  description: entity.description,
  fields: entity.fields.map((field) => ({
    uid: field.uid,
    kind: field.kind,
    required: field.required,
    description: field.description,
  })),
  dependencies: entity.dependencies.map((dependency) => ({
    uid: dependency.uid,
    kind: dependency.kind,
    reason: dependency.reason,
    description: dependency.description,
  })),
});

const entitySection = (entity: DocsEntity): string => {
  const lines = [
    `### ${entity.title}`,
    "",
    `- **UID:** \`${entity.uid}\``,
    `- **Kind:** ${entity.kind.replace("_", " ")}`,
  ];

  if (entity.description) {
    lines.push(`- **Description:** ${entity.description}`);
  }

  if (entity.fields.length > 0) {
    lines.push(
      "",
      "| Field | Kind | Required | Description |",
      "|-------|------|----------|-------------|",
      ...entity.fields.map(fieldRow),
    );
  }

  if (entity.dependencies.length > 0) {
    lines.push(
      "",
      "**Dependencies:**",
      ...entity.dependencies.map((dep) => `- ${dep.description}`),
    );
  }

  return lines.join("\n");
};

const mermaidGraph = (document: DocsDocument): string => {
  if (document.dependencyGraph.edges.length === 0) return "";

  const lines = ["```mermaid", "graph TD"];

  for (const node of document.dependencyGraph.nodes) {
    lines.push(`    ${node.uid}["${node.title}"]`);
  }

  for (const edge of document.dependencyGraph.edges) {
    lines.push(`    ${edge.source} --> ${edge.target}`);
  }

  lines.push("```");
  return lines.join("\n");
};

const renderMarkdown = (document: DocsDocument): string => {
  const lines = [
    `# ${document.projectName} — Content Model Documentation`,
    "",
    `> Auto-generated from schema. ${document.summary.contentTypes} content type(s), ${document.summary.globalFields} global field(s).`,
    "",
  ];

  lines.push("## Table of Contents", "");
  for (const entity of [...document.contentTypes, ...document.globalFields]) {
    lines.push(`- [${entity.title}](#${entity.uid})`);
  }
  lines.push("");

  if (document.globalFields.length > 0) {
    lines.push("---", "", "## Global Fields", "");
    for (const gf of document.globalFields) {
      lines.push(entitySection(gf), "");
    }
  }

  if (document.contentTypes.length > 0) {
    lines.push("---", "", "## Content Types", "");
    for (const ct of document.contentTypes) {
      lines.push(entitySection(ct), "");
    }
  }

  const diagram = mermaidGraph(document);
  if (diagram) {
    lines.push("---", "", "## Dependency Graph", "", diagram, "");
  }

  return lines.join("\n");
};

const renderJson = (document: DocsDocument): string => toCanonicalJson(document);

const renderHtmlEntity = (entity: DocsEntity): string => {
  const dependencyMarkup = entity.dependencies.length > 0
    ? [
      '<div class="entity-dependencies">',
      "<h4>Dependencies</h4>",
      "<ul>",
      ...entity.dependencies.map((dependency) => `<li>${escapeHtml(dependency.description)}</li>`),
      "</ul>",
      "</div>",
    ].join("\n")
    : "";

  return [
    `<section id="${escapeHtml(entity.uid)}" class="entity-card">`,
    `  <h3>${escapeHtml(entity.title)}</h3>`,
    "  <dl class=\"entity-meta\">",
    `    <div><dt>UID</dt><dd><code>${escapeHtml(entity.uid)}</code></dd></div>`,
    `    <div><dt>Kind</dt><dd>${escapeHtml(entity.kind.replace("_", " "))}</dd></div>`,
    ...(entity.description ? [`    <div><dt>Description</dt><dd>${escapeHtml(entity.description)}</dd></div>`] : []),
    "  </dl>",
    "  <table>",
    "    <thead>",
    "      <tr><th>Field</th><th>Kind</th><th>Required</th><th>Description</th></tr>",
    "    </thead>",
    "    <tbody>",
    ...entity.fields.map((field) =>
      `      <tr><td><code>${escapeHtml(field.uid)}</code></td><td>${escapeHtml(field.kind)}</td><td>${field.required ? "Yes" : "No"}</td><td>${escapeHtml(field.description ?? "")}</td></tr>`),
    "    </tbody>",
    "  </table>",
    dependencyMarkup,
    "</section>",
  ].join("\n");
};

const renderHtml = (document: DocsDocument): string => {
  const dependencyGraphMarkup = document.dependencyGraph.edges.length > 0
    ? [
      '<section class="graph-card">',
      "  <h2>Dependency Graph</h2>",
      "  <ul>",
      ...document.dependencyGraph.edges.map((edge) => `    <li><code>${escapeHtml(edge.source)}</code> -> <code>${escapeHtml(edge.target)}</code> (${escapeHtml(edge.reason)})</li>`),
      "  </ul>",
      "</section>",
    ].join("\n")
    : "";

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\" />",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `  <title>${escapeHtml(document.projectName)} - Content Model Documentation</title>`,
    "  <style>",
    "    :root { color-scheme: light; --bg: #f7f4ed; --surface: #fffdf8; --ink: #1f1b16; --muted: #6b6257; --line: #d7cdbf; --accent: #9a3412; }",
    "    * { box-sizing: border-box; }",
    "    body { margin: 0; font-family: Georgia, 'Times New Roman', serif; background: linear-gradient(180deg, #f0e7d8 0%, var(--bg) 280px); color: var(--ink); }",
    "    main { max-width: 1100px; margin: 0 auto; padding: 48px 20px 72px; }",
    "    header { margin-bottom: 32px; }",
    "    h1, h2, h3, h4 { margin: 0 0 12px; line-height: 1.1; }",
    "    p, li, dd, td, th { line-height: 1.5; }",
    "    .lede { color: var(--muted); max-width: 70ch; }",
    "    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 24px 0 32px; }",
    "    .summary-card, .entity-card, .graph-card, .toc { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 18px; box-shadow: 0 8px 24px rgba(31, 27, 22, 0.06); }",
    "    .summary-card strong { display: block; font-size: 1.8rem; color: var(--accent); }",
    "    .toc ul, .graph-card ul, .entity-dependencies ul { margin: 0; padding-left: 20px; }",
    "    .section-stack { display: grid; gap: 16px; }",
    "    table { width: 100%; border-collapse: collapse; margin-top: 16px; }",
    "    th, td { border-top: 1px solid var(--line); padding: 10px 8px; text-align: left; vertical-align: top; }",
    "    th { font-size: 0.9rem; color: var(--muted); }",
    "    code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 0.92em; }",
    "    .entity-meta { display: grid; gap: 8px; margin: 0; }",
    "    .entity-meta div { display: grid; gap: 4px; }",
    "    .entity-meta dt { font-size: 0.82rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }",
    "    .entity-meta dd { margin: 0; }",
    "    @media (max-width: 720px) { main { padding: 32px 14px 56px; } table { display: block; overflow-x: auto; } }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    "    <header>",
    `      <h1>${escapeHtml(document.projectName)} Content Model Documentation</h1>`,
    `      <p class="lede">Auto-generated from schema. ${document.summary.contentTypes} content type(s), ${document.summary.globalFields} global field(s).</p>`,
    "      <section class=\"summary\">",
    `        <div class="summary-card"><strong>${document.summary.totalEntities}</strong><span>Total entities</span></div>`,
    `        <div class="summary-card"><strong>${document.summary.contentTypes}</strong><span>Content types</span></div>`,
    `        <div class="summary-card"><strong>${document.summary.globalFields}</strong><span>Global fields</span></div>`,
    "      </section>",
    "    </header>",
    "    <section class=\"toc\">",
    "      <h2>Table of Contents</h2>",
    "      <ul>",
    ...[...document.contentTypes, ...document.globalFields].map((entity) => `        <li><a href="#${escapeHtml(entity.uid)}">${escapeHtml(entity.title)}</a></li>`),
    "      </ul>",
    "    </section>",
    ...(document.globalFields.length > 0
      ? [
        "    <section>",
        "      <h2>Global Fields</h2>",
        "      <div class=\"section-stack\">",
        ...document.globalFields.map((entity) => renderHtmlEntity(entity).split("\n").map((line) => `      ${line}`).join("\n")),
        "      </div>",
        "    </section>",
      ]
      : []),
    ...(document.contentTypes.length > 0
      ? [
        "    <section>",
        "      <h2>Content Types</h2>",
        "      <div class=\"section-stack\">",
        ...document.contentTypes.map((entity) => renderHtmlEntity(entity).split("\n").map((line) => `      ${line}`).join("\n")),
        "      </div>",
        "    </section>",
      ]
      : []),
    ...(
      dependencyGraphMarkup
        ? dependencyGraphMarkup.split("\n").map((line) => `    ${line}`)
        : []
    ),
    "  </main>",
    "</body>",
    "</html>",
  ].join("\n");
};

export const defaultDocsExtension = (format: DocsFormat): string => {
  switch (format) {
    case "json":
      return "json";
    case "html":
      return "html";
    case "md":
    default:
      return "md";
  }
};

export class DocsService {
  createDocument(schema: SchemaArtifact, projectName: string): DocsDocument {
    const graph = buildDependencyGraph(schema);
    const contentTypes = schema.entities.filter((e) => e.kind === "content_type").map(mapEntity);
    const globalFields = schema.entities.filter((e) => e.kind === "global_field").map(mapEntity);

    return {
      projectName,
      summary: {
        totalEntities: schema.entities.length,
        contentTypes: contentTypes.length,
        globalFields: globalFields.length,
      },
      globalFields,
      contentTypes,
      dependencyGraph: {
        nodes: schema.entities.map((entity) => ({
          uid: entity.uid,
          title: entity.title,
          kind: entity.kind,
        })),
        edges: graph.edges.map((edge) => ({
          source: edge.sourceEntityId.split(":")[1] ?? edge.sourceEntityId,
          target: edge.targetEntityId.split(":")[1] ?? edge.targetEntityId,
          reason: edge.reason,
          description: edge.description,
        })),
      },
    };
  }

  generate(schema: SchemaArtifact, projectName: string, format: DocsFormat = "md"): string {
    const document = this.createDocument(schema, projectName);

    switch (format) {
      case "json":
        return renderJson(document);
      case "html":
        return renderHtml(document);
      case "md":
      default:
        return renderMarkdown(document);
    }
  }
}
