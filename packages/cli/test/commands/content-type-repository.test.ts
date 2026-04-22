import { expect } from "chai";

import { ContentTypeRepository } from "../../lib/integrations/contentstack/content-type-repository";
import type { ManagementClient } from "../../lib/integrations/contentstack/management-client-factory";

const createMockClient = (pages: Array<{ content_types: any[]; count: number }>): { client: ManagementClient; paths: string[] } => {
  let callIndex = 0;
  const paths: string[] = [];

  const client: ManagementClient = {
    request: async <T>(path: string): Promise<T> => {
      paths.push(path);
      const page = pages[callIndex++];
      if (!page) throw new Error("No more mock pages");
      return page as unknown as T;
    },
  };

  return { client, paths };
};

describe("ContentTypeRepository.list() pagination", () => {
  it("returns all items from a single page", async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ uid: `ct_${i}` }));
    const { client } = createMockClient([{ content_types: items, count: 5 }]);

    const repo = new ContentTypeRepository(client);
    const result = await repo.list();

    expect(result).to.have.lengthOf(5);
  });

  it("paginates across multiple pages", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ uid: `ct_${i}` }));
    const page2 = Array.from({ length: 100 }, (_, i) => ({ uid: `ct_${100 + i}` }));
    const page3 = Array.from({ length: 50 }, (_, i) => ({ uid: `ct_${200 + i}` }));

    const { client, paths } = createMockClient([
      { content_types: page1, count: 250 },
      { content_types: page2, count: 250 },
      { content_types: page3, count: 250 },
    ]);

    const repo = new ContentTypeRepository(client);
    const result = await repo.list();

    expect(result).to.have.lengthOf(250);
    expect(paths).to.have.lengthOf(3);
    expect(paths[0]).to.contain("skip=0");
    expect(paths[1]).to.contain("skip=100");
    expect(paths[2]).to.contain("skip=200");
  });

  it("returns empty array when API returns no items", async () => {
    const { client } = createMockClient([{ content_types: [], count: 0 }]);

    const repo = new ContentTypeRepository(client);
    const result = await repo.list();

    expect(result).to.have.lengthOf(0);
  });

  it("sends correct limit param", async () => {
    const { client, paths } = createMockClient([{ content_types: [], count: 0 }]);

    const repo = new ContentTypeRepository(client);
    await repo.list();

    expect(paths[0]).to.contain("limit=100");
    expect(paths[0]).to.contain("include_count=true");
  });
});
