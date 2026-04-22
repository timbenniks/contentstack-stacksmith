import { modularBlocks } from "@timbenniks/contentstack-stacksmith";
import { createPageType } from "../shared/page-factory";
import {
  heroBlock,
  contentBlock,
  imageGalleryBlock,
  testimonialBlock,
  ctaBlock,
  featuredContentBlock,
  videoBlock,
} from "../shared/blocks";

export default createPageType("landing_page", "Landing Page", [
  modularBlocks("sections", {
    blocks: [
      heroBlock,
      contentBlock,
      imageGalleryBlock,
      testimonialBlock,
      ctaBlock,
      featuredContentBlock,
      videoBlock,
    ],
  }),
]);
