import type { ManagementClient } from "./management-client-factory.js";

/**
 * Upper bound on how many pages we'll ever request. A well-behaved stack has
 * hundreds of content types, not hundreds of thousands; if we blow past this
 * something has gone wrong (cycle, buggy pagination, bad sort key) and we'd
 * rather fail loudly than exhaust memory.
 */
const MAX_PAGES = 1000;

export interface PaginateOptions {
  client: ManagementClient;
  /** Relative path, page params appended via `?skip=…&limit=…&include_count=true`. */
  path: string;
  /** Key under which items live in the response body, e.g. "content_types". */
  itemsKey: string;
  /** Page size. CMA list endpoints accept up to 100. */
  pageSize?: number;
  /** Optional extra request options (e.g. apiVersion) forwarded to client.request. */
  requestOptions?: { apiVersion?: string };
}

/**
 * Page through a Contentstack list endpoint and return every item.
 *
 * Termination, in order of preference:
 *   1. `count` returned by the API — once we've collected that many, stop.
 *   2. Partial page — a response smaller than `pageSize` means we're at the end.
 *   3. `MAX_PAGES` hard cap — defensive guard against runaway pagination.
 */
export const paginate = async <T = Record<string, unknown>>(options: PaginateOptions): Promise<T[]> => {
  const { client, path, itemsKey, pageSize = 100, requestOptions } = options;
  const separator = path.includes("?") ? "&" : "?";
  const all: T[] = [];
  let skip = 0;
  let totalCount: number | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${path}${separator}skip=${skip}&limit=${pageSize}&include_count=true&asc=updated_at`;
    const response = await client.request<Record<string, unknown>>(url, requestOptions ?? {});

    const items = (response[itemsKey] as T[] | undefined) ?? [];
    all.push(...items);

    if (typeof response.count === "number") totalCount = response.count;
    if (totalCount !== undefined && all.length >= totalCount) return all;
    if (items.length < pageSize) return all;

    skip += pageSize;
  }

  throw new Error(
    `Pagination of ${path} exceeded the safety cap of ${MAX_PAGES} pages (${MAX_PAGES * pageSize} items). This usually indicates a broken sort key or a buggy API response; aborting to avoid runaway memory growth.`,
  );
};
