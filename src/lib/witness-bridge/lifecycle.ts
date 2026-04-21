import {
  WitnessBridgeConfigError,
  WitnessBridgeHttpError,
} from "@/lib/witness-bridge/client";

export const WITNESS_RUNTIME_ACCESS_STATUS = {
  ACCEPTED: "accepted",
  INVITED: "invited",
  ACTIVE: "active",
  COMPLETED: "completed",
  REVOKED: "revoked",
} as const;

export type WitnessRuntimeAccessStatus =
  (typeof WITNESS_RUNTIME_ACCESS_STATUS)[keyof typeof WITNESS_RUNTIME_ACCESS_STATUS];

export type WitnessRuntimeBridgeStatus =
  | "pending"
  | "ready"
  | "active"
  | "error";

export type WitnessRuntimeConsentStatus =
  | "unknown"
  | "missing_required"
  | "ready";

export type WitnessOperatorLifecycleStatus =
  | WitnessRuntimeAccessStatus
  | "failed";

export interface WitnessLifecycleSnapshot {
  accessStatus?: WitnessRuntimeAccessStatus | null;
  bridgeStatus?: WitnessRuntimeBridgeStatus | null;
  latestTestimonyState?: string | null;
}

export interface WitnessBridgeFailureClassification {
  kind:
    | "config"
    | "bridge_auth"
    | "consent_required"
    | "timeout"
    | "runtime_unavailable"
    | "runtime_failure"
    | "unknown";
  retryable: boolean;
  status?: number;
  code?: string | null;
}

export function isWitnessLifecycleCompleted(
  latestTestimonyState?: string | null
): boolean {
  return latestTestimonyState === "sealed";
}

export function deriveWitnessAccessStatus(input: {
  currentAccessStatus?: WitnessRuntimeAccessStatus | null;
  hasSession?: boolean;
  latestTestimonyState?: string | null;
}): WitnessRuntimeAccessStatus {
  if (input.currentAccessStatus === WITNESS_RUNTIME_ACCESS_STATUS.REVOKED) {
    return WITNESS_RUNTIME_ACCESS_STATUS.REVOKED;
  }

  if (
    input.currentAccessStatus === WITNESS_RUNTIME_ACCESS_STATUS.COMPLETED ||
    isWitnessLifecycleCompleted(input.latestTestimonyState)
  ) {
    return WITNESS_RUNTIME_ACCESS_STATUS.COMPLETED;
  }

  if (input.hasSession) {
    return WITNESS_RUNTIME_ACCESS_STATUS.ACTIVE;
  }

  if (input.currentAccessStatus === WITNESS_RUNTIME_ACCESS_STATUS.INVITED) {
    return WITNESS_RUNTIME_ACCESS_STATUS.INVITED;
  }

  return WITNESS_RUNTIME_ACCESS_STATUS.ACCEPTED;
}

export function deriveWitnessOperatorLifecycleStatus(
  input: WitnessLifecycleSnapshot
): WitnessOperatorLifecycleStatus {
  if (input.accessStatus === WITNESS_RUNTIME_ACCESS_STATUS.REVOKED) {
    return WITNESS_RUNTIME_ACCESS_STATUS.REVOKED;
  }

  if (input.bridgeStatus === "error") {
    return "failed";
  }

  if (
    input.accessStatus === WITNESS_RUNTIME_ACCESS_STATUS.COMPLETED ||
    isWitnessLifecycleCompleted(input.latestTestimonyState)
  ) {
    return WITNESS_RUNTIME_ACCESS_STATUS.COMPLETED;
  }

  if (input.accessStatus === WITNESS_RUNTIME_ACCESS_STATUS.ACTIVE) {
    return WITNESS_RUNTIME_ACCESS_STATUS.ACTIVE;
  }

  if (input.accessStatus === WITNESS_RUNTIME_ACCESS_STATUS.INVITED) {
    return WITNESS_RUNTIME_ACCESS_STATUS.INVITED;
  }

  return WITNESS_RUNTIME_ACCESS_STATUS.ACCEPTED;
}

export function isWitnessRuntimeAccessBlocked(
  accessStatus?: WitnessRuntimeAccessStatus | null
): boolean {
  return accessStatus === WITNESS_RUNTIME_ACCESS_STATUS.REVOKED;
}

export function classifyWitnessBridgeFailure(
  error: unknown
): WitnessBridgeFailureClassification {
  if (error instanceof WitnessBridgeConfigError) {
    return {
      kind: "config",
      retryable: false,
    };
  }

  if (error instanceof WitnessBridgeHttpError) {
    const details =
      error.details && typeof error.details === "object"
        ? (error.details as Record<string, unknown>)
        : null;
    const code = typeof details?.code === "string" ? details.code : null;
    const missingScopes = Array.isArray(details?.missingScopes)
      ? details.missingScopes
      : [];

    if (
      code === "witness_bridge_auth_missing" ||
      code === "witness_bridge_auth_invalid" ||
      code === "witness_bridge_auth_unconfigured" ||
      error.status === 401 ||
      error.status === 403
    ) {
      return {
        kind: "bridge_auth",
        retryable: false,
        status: error.status,
        code,
      };
    }

    if (missingScopes.length > 0 || error.status === 409) {
      return {
        kind: "consent_required",
        retryable: false,
        status: error.status,
        code,
      };
    }

    if (error.status === 504) {
      return {
        kind: "timeout",
        retryable: true,
        status: error.status,
        code,
      };
    }

    if (error.retryable || error.status >= 500) {
      return {
        kind: "runtime_unavailable",
        retryable: true,
        status: error.status,
        code,
      };
    }

    return {
      kind: "runtime_failure",
      retryable: false,
      status: error.status,
      code,
    };
  }

  return {
    kind: "unknown",
    retryable: false,
  };
}
