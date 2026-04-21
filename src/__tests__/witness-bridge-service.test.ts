import { describe, expect, it, vi } from "vitest";
import {
  bootstrapWitnessRuntime,
  grantWitnessEntryConsent,
  type WitnessBridgeClient,
  type WitnessConsentRecord,
} from "@/lib/witness-bridge/client";

function makeConsentRecord(
  witnessId: string,
  scope: "conversational" | "retention",
  status: "granted" | "denied" | "revoked" | "unknown"
): WitnessConsentRecord {
  return {
    id: `${witnessId}-${scope}`,
    witnessId,
    createdAt: "2026-04-21T10:00:00.000Z",
    updatedAt: "2026-04-21T10:00:00.000Z",
    decisions: [
      {
        scope,
        status,
        actor: "witness",
        decidedAt: "2026-04-21T10:00:00.000Z",
      },
    ],
  };
}

describe("witness bridge bootstrap helpers", () => {
  it("marks bootstrap missing_required when entry consent is incomplete", async () => {
    const client = {
      listConsent: vi.fn().mockResolvedValue([
        makeConsentRecord("wit-1", "conversational", "granted"),
      ]),
      listWitnessTestimony: vi.fn().mockResolvedValue([]),
      getWitnessSession: vi.fn(),
    } as unknown as WitnessBridgeClient;

    const result = await bootstrapWitnessRuntime(client, "wit-1");

    expect(result.consentStatus).toBe("missing_required");
    expect(result.missingScopes).toEqual(["retention"]);
    expect(result.session).toBeNull();
  });

  it("hydrates latest testimony and session when bridge data exists", async () => {
    const client = {
      listConsent: vi.fn().mockResolvedValue([
        makeConsentRecord("wit-1", "conversational", "granted"),
        makeConsentRecord("wit-1", "retention", "granted"),
      ]),
      listWitnessTestimony: vi.fn().mockResolvedValue([
        {
          id: "test-older",
          witnessId: "wit-1",
          sessionId: "sess-older",
          state: "retained",
          createdAt: "2026-04-20T10:00:00.000Z",
          updatedAt: "2026-04-20T10:00:00.000Z",
          segments: [],
        },
        {
          id: "test-latest",
          witnessId: "wit-1",
          sessionId: "sess-latest",
          state: "retained",
          createdAt: "2026-04-21T10:00:00.000Z",
          updatedAt: "2026-04-21T12:00:00.000Z",
          segments: [{ id: "seg-1", role: "witness", text: "truth", createdAt: "2026-04-21T12:00:00.000Z" }],
        },
      ]),
      getWitnessSession: vi.fn().mockResolvedValue({
        id: "sess-latest",
        createdAt: "2026-04-21T12:00:00.000Z",
        updatedAt: "2026-04-21T12:01:00.000Z",
        summary: null,
        turns: [
          {
            id: "turn-1",
            createdAt: "2026-04-21T12:01:00.000Z",
            mode: "dialogic",
            userMessage: "I stayed.",
            assistantMessage: "Why did you stay?",
          },
        ],
      }),
    } as unknown as WitnessBridgeClient;

    const result = await bootstrapWitnessRuntime(client, "wit-1");

    expect(result.consentStatus).toBe("ready");
    expect(result.latestTestimony?.id).toBe("test-latest");
    expect(result.session?.id).toBe("sess-latest");
    expect(result.bridgeStatus).toBe("active");
  });

  it("grants both required entry scopes before reloading bootstrap", async () => {
    const client = {
      appendConsent: vi.fn().mockResolvedValue({}),
      listConsent: vi.fn().mockResolvedValue([
        makeConsentRecord("wit-1", "conversational", "granted"),
        makeConsentRecord("wit-1", "retention", "granted"),
      ]),
      listWitnessTestimony: vi.fn().mockResolvedValue([]),
      getWitnessSession: vi.fn(),
    } as unknown as WitnessBridgeClient;

    const result = await grantWitnessEntryConsent(client, { witnessId: "wit-1" });

    expect(client.appendConsent).toHaveBeenCalledTimes(0);
    expect(result.consentStatus).toBe("ready");
    expect(result.missingScopes).toEqual([]);
  });

  it("appends only the missing entry consent scopes", async () => {
    const client = {
      appendConsent: vi.fn().mockResolvedValue({}),
      listConsent: vi
        .fn()
        .mockResolvedValueOnce([
          makeConsentRecord("wit-1", "conversational", "granted"),
        ])
        .mockResolvedValueOnce([
          makeConsentRecord("wit-1", "conversational", "granted"),
          makeConsentRecord("wit-1", "retention", "granted"),
        ]),
      listWitnessTestimony: vi.fn().mockResolvedValue([]),
      getWitnessSession: vi.fn(),
    } as unknown as WitnessBridgeClient;

    const result = await grantWitnessEntryConsent(client, { witnessId: "wit-1" });

    expect(client.appendConsent).toHaveBeenCalledTimes(1);
    expect(client.appendConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        witnessId: "wit-1",
        scope: "retention",
      })
    );
    expect(result.consentStatus).toBe("ready");
  });
});
