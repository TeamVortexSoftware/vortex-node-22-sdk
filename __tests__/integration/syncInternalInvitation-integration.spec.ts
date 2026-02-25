/**
 * Integration test for syncInternalInvitation
 * Validates that the SDK correctly calls /invitations/sync-internal-invitation (DEV-1778)
 */

import { describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import { Vortex } from "../../src/vortex";

describe("Vortex Node SDK - syncInternalInvitation", () => {
  let vortex: Vortex;
  let publicApiUrl: string;
  let savedBaseUrl: string | undefined;

  beforeAll(() => {
    const apiKey = process.env.TEST_INTEGRATION_SDKS_VORTEX_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing required environment variable: TEST_INTEGRATION_SDKS_VORTEX_API_KEY",
      );
    }

    const publicUrl = process.env.TEST_INTEGRATION_SDKS_VORTEX_PUBLIC_API_URL;
    if (!publicUrl) {
      throw new Error(
        "Missing required environment variable: TEST_INTEGRATION_SDKS_VORTEX_PUBLIC_API_URL",
      );
    }
    publicApiUrl = publicUrl;

    savedBaseUrl = process.env.VORTEX_API_BASE_URL;
    process.env.VORTEX_API_BASE_URL = publicApiUrl;
    vortex = new Vortex(apiKey);
  });

  afterAll(() => {
    if (savedBaseUrl !== undefined) {
      process.env.VORTEX_API_BASE_URL = savedBaseUrl;
    } else {
      delete process.env.VORTEX_API_BASE_URL;
    }
  });

  test("syncInternalInvitation uses correct API path", async () => {
    if (!vortex) {
      console.log("⚠️  Test skipped - environment not configured");
      return;
    }

    console.log("\n--- syncInternalInvitation Integration Test ---");

    const componentId =
      process.env.TEST_INTEGRATION_SDKS_VORTEX_COMPONENT_ID;
    if (!componentId) {
      throw new Error(
        "Missing required environment variable: TEST_INTEGRATION_SDKS_VORTEX_COMPONENT_ID",
      );
    }

    // Call syncInternalInvitation - even if the invitation doesn't exist,
    // a successful API response (not 404 on the route) confirms the path is correct
    try {
      const result = await vortex.syncInternalInvitation({
        creatorId: "test-creator-integration",
        targetValue: "test-target-integration",
        action: "accepted",
        componentId,
      });

      console.log(
        `✓ syncInternalInvitation responded successfully: processed=${result?.processed}`,
      );
      expect(result).toBeDefined();
    } catch (error: any) {
      // Normalize error into a message string for robust status detection
      const message =
        typeof error === "string"
          ? error
          : (error?.message as string | undefined) ?? "";
      const lowerMessage = message.toLowerCase();

      // Distinguish between "route not found" (wrong path) and "resource not found" (business logic 404).
      // A route-level 404 typically says "Cannot GET/POST ..." or has no domain-specific message.
      // A business-logic 404 like "No pending internal invitation found" means the route exists
      // but there's no matching data — that's a success for route validation.
      const isRouteMissing =
        lowerMessage.includes("cannot post") ||
        lowerMessage.includes("cannot get") ||
        lowerMessage.includes("route not found");

      if (isRouteMissing) {
        throw new Error(
          `syncInternalInvitation route not found - API path may be incorrect: ${message || error}`,
        );
      }

      // Any other error (including business-logic 404s, 400, 422, etc.) means
      // the route exists and responded, which is what we're validating.
      console.log(
        `✓ syncInternalInvitation route exists (got ${error?.status || "error"}: ${message || error})`,
      );
    }

    console.log("--- syncInternalInvitation Integration Test Complete ---\n");
  }, 15000);
});
