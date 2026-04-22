import { defineModels } from "@timbenniks/contentstack-stacksmith";

import article from "./content-types/article";
import author from "./content-types/author";
import homepage from "./content-types/homepage";
import landingPage from "./content-types/landing_page";
import product from "./content-types/product";
import seo from "./global-fields/seo";

export default defineModels({
  contentTypes: [article, author, homepage, landingPage, product],
  globalFields: [seo],
});
