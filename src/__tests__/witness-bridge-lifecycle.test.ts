import { describe, expect, it } from "vitest";
import {
  WitnessBridgeConfigError,
  WitnessBridgeHttpError,
} from "@/lib/witness-bridge/client";
import {
  classifyWitnessBridgeFailure,
  deriveWitnessAccessStatus,
  deriveWitnessOperatorLifecycleStatus,
  WITNESS_RUNTIME_ACCESS_STATUS,
} from "@/lib/witness-bridge/lifecycle";

describe("witness bridge lifecycle helpers", () => {
  it("preserves invited status until a governed session exists", () => {
    expect(
      deriveWitnessAccessStatus({
        currentAccessStatus: WITNESS_RUNTIME_ACCESS_STATUS.INVITED,
        hasSession: false,
        latestTestimonyState: null,
      })
    ).toBe(WITNESS_RUNTIME_ACCESS_STATUS.INVITED);
  });

  it("marks completed when governed testimony is sealed", () => {
    expect(
      deriveWitnessAccessStatus({
        currentAccessStatus: WITNESS_RUNTIME_ACCESS_STATUS.ACTIVE,
        hasSession: true,
        latestTestimonyState: "sealed",
      })
    ).toBe(WITNESS_RUNTIME_ACCESS_STATUS.COMPLETED);
  });

  it("surfaces failed as an operator state when bridge status is error", () => {
    expect(
      deriveWitnessOperatorLifecycleStatus({
        accessStatus: WITNESS_RUNTIME_ACCESS_STATUS.ACTIVE,
        bridgeStatus: "error",
        latestTestimonyState: "retained",
      })
    ).toBe("failed");
  });

  it("classifies bridge auth failures from stable G_5.2 auth errors", () => {
    const error = new WitnessBridgeHttpError("Invalid Witness bridge auth.", {
      status: 403,
      retryable: false,
      details: { code: "witness_bridge_auth_invalid" },
    });

    expect(classifyWitnessBridgeFailure(error)).toEqual({
      kind: "bridge_auth",
      retryable: false,
      status: 403,
      code: "witness_bridge_auth_invalid",
    });
  });

  it("classifies consent-required failures from missing runtime scopes", () => {
    const error = new WitnessBridgeHttpError(
      "Witness consent requirements not met.",
      {
        status: 409,
        retryable: false,
        details: { missingScopes: ["retention"] },
      }
    );

    expect(classifyWitnessBridgeFailure(error)).toEqual({
      kind: "consent_required",
      retryable: false,
      status: 409,
      code: null,
    });
  });

  it("classifies timeout failures as retryable", () => {
    const error = new WitnessBridgeHttpError("Witness bridge request timed out.", {
      status: 504,
      retryable: true,
    });

    expect(classifyWitnessBridgeFailure(error)).toEqual({
      kind: "timeout",
      retryable: true,
      status: 504,
      code: null,
    });
  });

  it("classifies missing bridge config as non-retryable config failure", () => {
    expect(
      classifyWitnessBridgeFailure(
        new WitnessBridgeConfigError("Witness bridge is disabled until configured.")
      )
    ).toEqual({
      kind: "config",
      retryable: false,
    });
  });
});
