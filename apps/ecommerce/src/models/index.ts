import { defineModels } from "@timbenniks/contentstack-stacksmith";

import brand from "./content-types/brand";
import collection from "./content-types/collection";
import product from "./content-types/product";
import store from "./content-types/store";
import address from "./global-fields/address";
import seo from "./global-fields/seo";

export default defineModels({
  contentTypes: [brand, collection, product, store],
  globalFields: [address, seo],
});
