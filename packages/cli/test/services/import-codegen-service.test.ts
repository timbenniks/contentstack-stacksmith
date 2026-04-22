import { join } from "node:path";

import { expect } from "chai";

import { ImportCodegenService } from "../../src/services/import-codegen-service";
import { sampleImportContentTypes, sampleImportGlobalFields } from "../helpers/import-fixtures";

describe("ImportCodegenService", () => {
  it("renders deterministic DSL files for supported Contentstack field types", () => {
    const service = new ImportCodegenService();
    const result = service.generate({
      cwd: "/tmp/developers-cs-website",
      projectName: "developers-cs-website",
      packageName: "developers-cs-website",
      configPath: "/tmp/developers-cs-website/contentstack.stacksmith.config.ts",
      modelsEntryPath: "/tmp/developers-cs-website/src/models/index.ts",
      modelsVersion: "0.1.0",
      contentTypes: sampleImportContentTypes,
      globalFields: sampleImportGlobalFields,
    });

    const articleFile = result.files.find((file) => file.path === join("src", "models", "content-types", "article.ts"));
    const authorFile = result.files.find((file) => file.path === join("src", "models", "content-types", "author.ts"));
    const registryFile = result.files.find((file) => file.path === join("src", "models", "index.ts"));

    expect(articleFile?.content).to.contain('file("hero_image"');
    expect(articleFile?.content).to.contain('link("source_link"');
    expect(articleFile?.content).to.contain('enumField("status"');
    expect(articleFile?.content).to.contain('markdown("summary"');
    expect(articleFile?.content).to.contain('richText("body"');
    expect(articleFile?.content).to.contain('jsonRte("body_json"');
    expect(articleFile?.content).to.contain('taxonomy("tags"');
    expect(articleFile?.content).to.contain('group("details"');
    expect(articleFile?.content).to.contain('modularBlocks("sections"');
    expect(articleFile?.content).to.contain('globalField("seo"');
    expect(articleFile?.content).to.contain('reference("author"');
    expect(authorFile?.content).to.contain('markdown("bio"');
    expect(registryFile?.content).to.contain("defineModels");
    expect(result.contentTypeUids).to.deep.equal(["article", "author"]);
    expect(result.globalFieldUids).to.deep.equal(["seo"]);
  });
});
