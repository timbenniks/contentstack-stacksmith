import { expect } from "chai";

import { GlobalFieldRepository } from "../../lib/integrations/contentstack/global-field-repository";
import type { ManagementClient } from "../../lib/integrations/contentstack/management-client-factory";

const createMockClient = (pages: Array<{ global_fields: any[]; count: number }>): { client: ManagementClient; paths: string[]; inits: any[] } => {
  let callIndex = 0;
  const paths: string[] = [];
  const inits: any[] = [];

  const client: ManagementClient = {
    request: async <T>(path: string, init?: any): Promise<T> => {
      paths.push(path);
      inits.push(init);
      const page = pages[callIndex++];
      if (!page) throw new Error("No more mock pages");
      return page as unknown as T;
    },
  };

  return { client, paths, inits };
};

describe("GlobalFieldRepository.list() pagination", () => {
  it("returns all items from a single page", async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ uid: `gf_${i}` }));
    const { client } = createMockClient([{ global_fields: items, count: 5 }]);

    const repo = new GlobalFieldRepository(client);
    const result = await repo.list();

    expect(result).to.have.lengthOf(5);
  });

  it("paginates across multiple pages", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ uid: `gf_${i}` }));
    const page2 = Array.from({ length: 30 }, (_, i) => ({ uid: `gf_${100 + i}` }));

    const { client, paths } = createMockClient([
      { global_fields: page1, count: 130 },
      { global_fields: page2, count: 130 },
    ]);

    const repo = new GlobalFieldRepository(client);
    const result = await repo.list();

    expect(result).to.have.lengthOf(130);
    expect(paths).to.have.lengthOf(2);
    expect(paths[0]).to.contain("skip=0");
    expect(paths[1]).to.contain("skip=100");
  });

  it("returns empty array when API returns no items", async () => {
    const { client } = createMockClient([{ global_fields: [], count: 0 }]);

    const repo = new GlobalFieldRepository(client);
    const result = await repo.list();

    expect(result).to.have.lengthOf(0);
  });

  it("passes apiVersion 3.2 on each page request", async () => {
    const { client, inits } = createMockClient([{ global_fields: [], count: 0 }]);

    const repo = new GlobalFieldRepository(client);
    await repo.list();

    expect(inits[0]?.apiVersion).to.equal("3.2");
  });
});
