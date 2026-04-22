import { toCanonicalJson } from "@timbenniks/contentstack-stacksmith";

import { sampleSchema } from "../fixtures/models.js";

export const sampleSchemaSnapshot = toCanonicalJson(sampleSchema);
