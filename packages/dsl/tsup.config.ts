import { resolve } from "node:path";

import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  tsconfig: "tsconfig.build.json",
  noExternal: ["@timbenniks/contentstack-stacksmith-core"],
  esbuildOptions(options) {
    options.alias = {
      "@timbenniks/contentstack-stacksmith-core": resolve(__dirname, "../core/src/index.ts"),
    };
  },
});
