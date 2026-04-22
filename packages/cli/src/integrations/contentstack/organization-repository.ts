import type { ManagementClient } from "./management-client-factory.js";

export interface StackOrgInfo {
  organization_uid?: string;
  uid?: string;
  name?: string;
}

export class OrganizationRepository {
  constructor(private readonly client: ManagementClient) {}

  async fetchWithPlan(organizationUid: string): Promise<unknown> {
    return this.client.request<unknown>(`/v3/organizations/${organizationUid}?include_plan=true`);
  }

  async fetchStackOrg(stackApiKey: string): Promise<StackOrgInfo> {
    const response = await this.client.request<{ stack?: StackOrgInfo }>(`/v3/stacks/${stackApiKey}`);
    return response.stack ?? {};
  }
}
