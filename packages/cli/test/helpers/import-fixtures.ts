export const sampleImportGlobalFields = [
  {
    uid: "seo",
    title: "SEO",
    description: "Reusable SEO metadata.",
    schema: [
      {
        uid: "meta_title",
        data_type: "text",
        display_name: "Meta Title",
        mandatory: false,
        unique: false,
        multiple: false,
        field_metadata: { description: "SEO title" },
      },
      {
        uid: "meta_description",
        data_type: "text",
        display_name: "Meta Description",
        mandatory: false,
        unique: false,
        multiple: false,
        field_metadata: {},
      },
    ],
  },
] satisfies Record<string, any>[];

export const sampleImportContentTypes = [
  {
    uid: "author",
    title: "Author",
    description: "Author profile content type.",
    options: { singleton: false },
    schema: [
      {
        uid: "title",
        data_type: "text",
        display_name: "Title",
        mandatory: true,
        unique: false,
        multiple: false,
        field_metadata: {},
      },
      {
        uid: "name",
        data_type: "text",
        display_name: "Name",
        mandatory: true,
        unique: false,
        multiple: false,
        field_metadata: {},
      },
      {
        uid: "bio",
        data_type: "text",
        display_name: "Bio",
        mandatory: false,
        unique: false,
        multiple: false,
        field_metadata: {
          markdown: true,
          description: "Short markdown biography.",
        },
      },
    ],
  },
  {
    uid: "article",
    title: "Article",
    description: "Imported article content type.",
    options: { singleton: false },
    schema: [
      {
        uid: "title",
        data_type: "text",
        display_name: "Title",
        mandatory: true,
        unique: false,
        multiple: false,
        field_metadata: {},
      },
      {
        uid: "slug",
        data_type: "text",
        display_name: "Slug",
        mandatory: true,
        unique: true,
        multiple: false,
        field_metadata: {},
      },
      {
        uid: "hero_image",
        data_type: "file",
        display_name: "Hero Image",
        mandatory: true,
        unique: false,
        multiple: false,
        field_metadata: {},
      },
      {
        uid: "source_link",
        data_type: "link",
        display_name: "Source Link",
        mandatory: false,
        unique: false,
        multiple: false,
        field_metadata: {},
      },
      {
        uid: "status",
        data_type: "text",
        display_name: "Status",
        mandatory: true,
        unique: false,
        multiple: false,
        default_value: "draft",
        enum: {
          choices: [{ value: "draft" }, { value: "published" }],
        },
        display_type: "dropdown",
        field_metadata: {},
      },
      {
        uid: "summary",
        data_type: "text",
        display_name: "Summary",
        mandatory: false,
        unique: false,
        multiple: false,
        field_metadata: {
          markdown: true,
        },
      },
      {
        uid: "body",
        data_type: "text",
        display_name: "Body",
        mandatory: true,
        unique: false,
        multiple: false,
        field_metadata: {
          allow_rich_text: true,
          rich_text_type: "advanced",
        },
      },
      {
        uid: "body_json",
        data_type: "json",
        display_name: "Body JSON",
        mandatory: false,
        unique: false,
        multiple: false,
        reference_to: ["author"],
        field_metadata: {
          allow_json_rte: true,
          rich_text_type: "basic",
        },
      },
      {
        uid: "publish_date",
        data_type: "isodate",
        display_name: "Publish Date",
        mandatory: false,
        unique: false,
        multiple: false,
        startDate: "2024-01-01",
        endDate: "2026-12-31",
        field_metadata: {},
      },
      {
        uid: "custom_attributes",
        data_type: "json",
        display_name: "Custom Attributes",
        mandatory: false,
        unique: false,
        multiple: false,
        default_value: { featured: true },
        field_metadata: {},
      },
      {
        uid: "author",
        data_type: "reference",
        display_name: "Author",
        mandatory: false,
        unique: false,
        multiple: false,
        reference_to: ["author"],
        field_metadata: {},
      },
      {
        uid: "seo",
        data_type: "global_field",
        display_name: "SEO",
        mandatory: false,
        unique: false,
        multiple: false,
        reference_to: "seo",
        field_metadata: {},
      },
      {
        uid: "tags",
        data_type: "taxonomy",
        display_name: "Tags",
        mandatory: false,
        unique: false,
        multiple: true,
        taxonomies: [{ taxonomy_uid: "topic", max_terms: 5 }],
        field_metadata: {},
      },
      {
        uid: "details",
        data_type: "group",
        display_name: "Details",
        mandatory: false,
        unique: false,
        multiple: false,
        field_metadata: {},
        schema: [
          {
            uid: "reading_time",
            data_type: "number",
            display_name: "Reading Time",
            mandatory: false,
            unique: false,
            multiple: false,
            default_value: 5,
            field_metadata: {},
          },
          {
            uid: "featured",
            data_type: "boolean",
            display_name: "Featured",
            mandatory: false,
            unique: false,
            multiple: false,
            default_value: false,
            field_metadata: {},
          },
        ],
      },
      {
        uid: "sections",
        data_type: "blocks",
        display_name: "Sections",
        mandatory: false,
        unique: false,
        multiple: true,
        field_metadata: {},
        blocks: [
          {
            uid: "hero",
            title: "Hero",
            schema: [
              {
                uid: "heading",
                data_type: "text",
                display_name: "Heading",
                mandatory: true,
                unique: false,
                multiple: false,
                field_metadata: {},
              },
            ],
          },
          {
            uid: "callout",
            title: "Callout",
            schema: [
              {
                uid: "copy",
                data_type: "text",
                display_name: "Copy",
                mandatory: false,
                unique: false,
                multiple: false,
                field_metadata: {
                  markdown: true,
                },
              },
            ],
          },
        ],
      },
    ],
  },
] satisfies Record<string, any>[];

export const createImportFetchMock = (
  contentTypes = sampleImportContentTypes,
  globalFields = sampleImportGlobalFields,
): typeof fetch =>
  (async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/v3/content_types")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ content_types: contentTypes, count: contentTypes.length }),
        text: async () => JSON.stringify({ content_types: contentTypes, count: contentTypes.length }),
      } as Response;
    }

    if (url.includes("/v3/global_fields")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ global_fields: globalFields, count: globalFields.length }),
        text: async () => JSON.stringify({ global_fields: globalFields, count: globalFields.length }),
      } as Response;
    }

    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;
