import { defineModels } from "@timbenniks/contentstack-stacksmith";

import author from "./content-types/author";
import category from "./content-types/category";
import post from "./content-types/post";

export default defineModels({
  contentTypes: [author, category, post],
});
