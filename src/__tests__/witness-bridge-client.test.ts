import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WitnessBridgeClient,
  WitnessBridgeConfigError,
} from "@/lib/witness-bridge/client";

describe("WitnessBridgeClient", () => {
  const originalBaseUrl = process.env.G52_WITNESS_BRIDGE_BASE_URL;
  const originalSecret = process.env.G52_WITNESS_BRIDGE_SHARED_SECRET;
  const originalTimeout = process.env.G52_WITNESS_BRIDGE_TIMEOUT_MS;

  beforeEach(() => {
    process.env.G52_WITNESS_BRIDGE_BASE_URL = "http://127.0.0.1:5100";
    process.env.G52_WITNESS_BRIDGE_SHARED_SECRET = "test-secret";
    process.env.G52_WITNESS_BRIDGE_TIMEOUT_MS = "500";
  });

  afterEach(() => {
    process.env.G52_WITNESS_BRIDGE_BASE_URL = originalBaseUrl;
    process.env.G52_WITNESS_BRIDGE_SHARED_SECRET = originalSecret;
    process.env.G52_WITNESS_BRIDGE_TIMEOUT_MS = originalTimeout;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fails closed when bridge config is missing", () => {
    delete process.env.G52_WITNESS_BRIDGE_SHARED_SECRET;

    expect(() => new WitnessBridgeClient()).toThrow(WitnessBridgeConfigError);
  });

  it("maps non-2xx bridge responses to structured http errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "Witness consent requirements not met.",
            missingScopes: ["conversational", "retention"],
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    );

    const client = new WitnessBridgeClient();

    await expect(client.listConsent("wit-1")).rejects.toMatchObject({
      name: "WitnessBridgeHttpError",
      status: 409,
      retryable: false,
    });
  });

  it("maps abort-style failures to retryable timeout errors", async () => {
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(abortError)
    );

    const client = new WitnessBridgeClient();

    await expect(client.listWitnessTestimony("wit-1")).rejects.toMatchObject({
      name: "WitnessBridgeHttpError",
      status: 504,
      retryable: true,
    });
  });
});
