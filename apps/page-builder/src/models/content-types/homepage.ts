import { modularBlocks } from "@timbenniks/contentstack-stacksmith";
import { createPageType } from "../shared/page-factory";
import {
  heroBlock,
  contentBlock,
  ctaBlock,
  featuredContentBlock,
} from "../shared/blocks";

export default createPageType(
  "homepage",
  "Homepage",
  [
    modularBlocks("sections", {
      blocks: [heroBlock, contentBlock, ctaBlock, featuredContentBlock],
    }),
  ],
  { singleton: true },
);
