/**
 * Integration test for Vortex Node 22 SDK
 * Tests the full flow: Create -> Get -> Accept invitation.
 */

import { describe, test, expect, beforeAll } from "@jest/globals";
import { Vortex } from "../../src/vortex";

describe("Vortex Node SDK Integration", () => {
  let vortex: Vortex;
  let clientApiUrl: string;
  let publicApiUrl: string;
  let sessionId: string;
  let invitationId: string;

  const timestamp = Date.now().toString();
  let testUserEmail: string;
  let testUserId: string;
  let testGroupType: string;
  let testGroupId: string;
  let testGroupName: string;

  beforeAll(() => {
    // Validate required environment variables
    const apiKey = process.env.TEST_INTEGRATION_SDKS_VORTEX_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing required environment variable: TEST_INTEGRATION_SDKS_VORTEX_API_KEY",
      );
    }

    const clientUrl = process.env.TEST_INTEGRATION_SDKS_VORTEX_CLIENT_API_URL;
    if (!clientUrl) {
      throw new Error(
        "Missing required environment variable: TEST_INTEGRATION_SDKS_VORTEX_CLIENT_API_URL",
      );
    }
    clientApiUrl = clientUrl;

    const publicUrl = process.env.TEST_INTEGRATION_SDKS_VORTEX_PUBLIC_API_URL;
    if (!publicUrl) {
      throw new Error(
        "Missing required environment variable: TEST_INTEGRATION_SDKS_VORTEX_PUBLIC_API_URL",
      );
    }
    publicApiUrl = publicUrl;

    const session = process.env.TEST_INTEGRATION_SDKS_VORTEX_SESSION_ID;
    if (!session) {
      throw new Error(
        "Missing required environment variable: TEST_INTEGRATION_SDKS_VORTEX_SESSION_ID",
      );
    }
    sessionId = session;

    const userEmail = process.env.TEST_INTEGRATION_SDKS_USER_EMAIL;
    if (!userEmail) {
      throw new Error(
        "Missing required environment variable: TEST_INTEGRATION_SDKS_USER_EMAIL",
      );
    }
    testUserEmail = userEmail.replace("{timestamp}", timestamp);

    const userId = process.env.TEST_INTEGRATION_SDKS_USER_ID;
    if (!userId) {
      throw new Error(
        "Missing required environment variable: TEST_INTEGRATION_SDKS_USER_ID",
      );
    }
    testUserId = userId.replace("{timestamp}", timestamp);

    const groupType = process.env.TEST_INTEGRATION_SDKS_GROUP_TYPE;
    if (!groupType) {
      throw new Error(
        "Missing required environment variable: TEST_INTEGRATION_SDKS_GROUP_TYPE",
      );
    }
    testGroupType = groupType;

    const groupName = process.env.TEST_INTEGRATION_SDKS_GROUP_NAME;
    if (!groupName) {
      throw new Error(
        "Missing required environment variable: TEST_INTEGRATION_SDKS_GROUP_NAME",
      );
    }
    testGroupName = groupName;

    // TEST_INTEGRATION_SDKS_GROUP_ID is dynamic - generated from timestamp
    testGroupId = `test-group-${Date.now()}`;

    vortex = new Vortex(apiKey);
  });

  test("Full invitation flow", async () => {
    if (!vortex) {
      console.log("⚠️  Test skipped - environment not configured");
      return;
    }

    console.log("\n--- Starting Node SDK Integration Test ---");

    // Step 1: Create invitation
    console.log("Step 1: Creating invitation...");
    invitationId = await createInvitation();
    expect(invitationId).toBeTruthy();
    console.log(`✓ Created invitation: ${invitationId}`);

    // Step 2: Get invitation by ID
    console.log("Step 2a: Getting invitation by ID...");
    const invitation = await getInvitationById();
    expect(invitation).toBeDefined();
    expect(invitation.id).toBe(invitationId);
    console.log("✓ Retrieved invitation by ID successfully");

    // Step 2b: Get invitations by target
    console.log("Step 2b: Getting invitations by target...");
    const invitations = await getInvitations();
    expect(invitations).toBeDefined();
    expect(invitations.length).toBeGreaterThan(0);
    // Verify the single invitation is in the list
    const foundInList = invitations.some((inv: any) => inv.id === invitationId);
    expect(foundInList).toBe(true);
    console.log(
      "✓ Retrieved invitations by target successfully and verified invitation is in list",
    );

    // Step 3: Accept invitation
    console.log("Step 3: Accepting invitation...");
    const result = await acceptInvitation();
    expect(result).toBeDefined();
    console.log("✓ Accepted invitation successfully");

    console.log("--- Node SDK Integration Test Complete ---\n");
  }, 30000); // 30 second timeout

  async function createInvitation(): Promise<string> {
    // Generate JWT for authentication
    const jwt = vortex.generateJwt({
      user: {
        id: testUserId,
        email: testUserEmail,
      },
    });

    // Step 1: Fetch widget configuration to get the widget configuration ID and sessionAttestation
    const componentId = process.env.TEST_INTEGRATION_SDKS_VORTEX_COMPONENT_ID;
    if (!componentId) {
      throw new Error(
        "Missing required environment variable: TEST_INTEGRATION_SDKS_VORTEX_COMPONENT_ID",
      );
    }
    const widgetResponse = await fetch(
      `${clientApiUrl}/api/v1/widgets/${componentId}?templateVariables=lzstr:N4Ig5gTg9grgDgfQHYEMC2BTEAuEBlAEQGkACAFQwGcAXEgcWnhABoQBLJANzeowmXRZcBCCQBqUCLwAeLcI0SY0AIz4IAxrCTUcIAMxzNaOCiQBPAZl0SpGaSQCSSdQDoQAXyA`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
          "x-session-id": sessionId,
        },
      },
    );

    if (!widgetResponse.ok) {
      throw new Error(
        `Failed to fetch widget configuration: ${widgetResponse.status} ${await widgetResponse.text()}`,
      );
    }

    const widgetData: any = await widgetResponse.json();
    const widgetConfigId = widgetData?.data?.widgetConfiguration?.id;
    const sessionAttestation = widgetData?.data?.sessionAttestation;

    if (!widgetConfigId) {
      throw new Error("Widget configuration ID not found in response");
    }

    if (!sessionAttestation) {
      throw new Error("Session attestation not found in widget response");
    }

    console.log(`Using widget configuration ID: ${widgetConfigId}`);

    // Now use the session attestation for subsequent requests
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
      "x-session-id": sessionId,
      "x-session-attestation": sessionAttestation,
    };

    // Step 2: Create invitation with the widget configuration ID
    const response = await fetch(`${clientApiUrl}/api/v1/invitations`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        payload: {
          emails: {
            value: testUserEmail,
            type: "email",
            role: "member",
          },
        },
        group: {
          type: testGroupType,
          groupId: testGroupId,
          name: testGroupName,
        },
        source: "email",
        widgetConfigurationId: widgetConfigId,
        templateVariables: {
          group_name: "SDK Test Group",
          inviter_name: "Dr Vortex",
          group_member_count: "3",
          company_name: "Vortex Inc.",
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Create invitation failed: ${response.status} ${await response.text()}`,
      );
    }

    const result: any = await response.json();
    // The API returns the full widget configuration with invitation entries
    const invitationId = result?.data?.invitationEntries?.[0]?.id || result.id;

    if (invitationId) {
      console.log(`Successfully extracted invitation ID: ${invitationId}`);
    }

    return invitationId;
  }

  async function getInvitationById(): Promise<any> {
    const apiKey = process.env.TEST_INTEGRATION_SDKS_VORTEX_API_KEY!;
    const savedBaseUrl = process.env.VORTEX_API_BASE_URL;
    process.env.VORTEX_API_BASE_URL = publicApiUrl;
    const publicVortex = new Vortex(apiKey);
    const result = await publicVortex.getInvitation(invitationId);
    process.env.VORTEX_API_BASE_URL = savedBaseUrl;
    return result;
  }

  async function getInvitations(): Promise<any[]> {
    const apiKey = process.env.TEST_INTEGRATION_SDKS_VORTEX_API_KEY!;
    const savedBaseUrl = process.env.VORTEX_API_BASE_URL;
    process.env.VORTEX_API_BASE_URL = publicApiUrl;
    const publicVortex = new Vortex(apiKey);
    const result = await publicVortex.getInvitationsByTarget(
      "email",
      testUserEmail,
    );
    process.env.VORTEX_API_BASE_URL = savedBaseUrl;
    return result;
  }

  async function acceptInvitation(): Promise<any> {
    const apiKey = process.env.TEST_INTEGRATION_SDKS_VORTEX_API_KEY!;
    const savedBaseUrl = process.env.VORTEX_API_BASE_URL;
    process.env.VORTEX_API_BASE_URL = publicApiUrl;
    const publicVortex = new Vortex(apiKey);
    const result = await publicVortex.acceptInvitations([invitationId], {
      type: "email",
      value: testUserEmail,
    });
    process.env.VORTEX_API_BASE_URL = savedBaseUrl;
    return result;
  }
});
