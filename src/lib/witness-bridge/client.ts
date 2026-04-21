const REQUIRED_ENTRY_SCOPES = ["conversational", "retention"] as const;

export type WitnessConsentScope = (typeof REQUIRED_ENTRY_SCOPES)[number];
export type WitnessConsentStatus = "granted" | "denied" | "revoked" | "unknown";
export type WitnessConsentActor = "witness" | "operator" | "system_import";
export type WitnessRuntimeConsentMirrorStatus =
  | "unknown"
  | "missing_required"
  | "ready";

export interface WitnessConsentDecision {
  scope: string;
  status: WitnessConsentStatus;
  actor: WitnessConsentActor;
  decidedAt: string;
  note?: string;
}

export interface WitnessConsentRecord {
  id: string;
  witnessId: string;
  testimonyId?: string;
  createdAt: string;
  updatedAt: string;
  decisions: WitnessConsentDecision[];
}

export interface WitnessBridgeTurnRecord {
  id: string;
  createdAt: string;
  mode: string;
  userMessage: string;
  assistantMessage: string;
  error?: {
    message: string;
    failedAt: string;
  };
}

export interface WitnessBridgeSession {
  id: string;
  productId?: "witness";
  witnessId?: string;
  createdAt: string;
  updatedAt: string;
  summary: {
    text: string;
    generatedAt: string;
  } | null;
  turns: WitnessBridgeTurnRecord[];
}

export interface WitnessBridgeTestimonyRecord {
  id: string;
  witnessId: string;
  sessionId: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  segments: Array<{
    id: string;
    role: "witness" | "inquisitor";
    text: string;
    createdAt: string;
  }>;
}

export interface WitnessBridgeTurnResponse {
  product: "witness";
  session: WitnessBridgeSession;
  persistedTurn: WitnessBridgeTurnRecord;
  provider?: string;
  testimonyId?: string;
}

export interface WitnessRuntimeBootstrap {
  witnessId: string;
  consentStatus: WitnessRuntimeConsentMirrorStatus;
  missingScopes: WitnessConsentScope[];
  consentRecords: WitnessConsentRecord[];
  latestTestimony: WitnessBridgeTestimonyRecord | null;
  session: WitnessBridgeSession | null;
  bridgeStatus: "ready" | "active";
}

export class WitnessBridgeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WitnessBridgeConfigError";
  }
}

export class WitnessBridgeHttpError extends Error {
  status: number;
  retryable: boolean;
  details?: unknown;

  constructor(
    message: string,
    options: { status: number; retryable: boolean; details?: unknown }
  ) {
    super(message);
    this.name = "WitnessBridgeHttpError";
    this.status = options.status;
    this.retryable = options.retryable;
    this.details = options.details;
  }
}

function getBridgeConfig() {
  const baseUrl = process.env.G52_WITNESS_BRIDGE_BASE_URL?.trim();
  const sharedSecret = process.env.G52_WITNESS_BRIDGE_SHARED_SECRET?.trim();
  const timeoutMs = Number(process.env.G52_WITNESS_BRIDGE_TIMEOUT_MS ?? "8000");

  if (!baseUrl) {
    throw new WitnessBridgeConfigError(
      "Missing G52_WITNESS_BRIDGE_BASE_URL. Witness bridge is disabled until configured."
    );
  }

  if (!sharedSecret) {
    throw new WitnessBridgeConfigError(
      "Missing G52_WITNESS_BRIDGE_SHARED_SECRET. Witness bridge fails closed without shared-secret config."
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    sharedSecret,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000,
  };
}

async function parseBridgeResponse(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json();
  }

  const text = await res.text();
  return text ? { error: text } : null;
}

function latestDecisionForScope(
  records: WitnessConsentRecord[],
  scope: WitnessConsentScope,
  testimonyId?: string
): WitnessConsentDecision | null {
  const readLatest = (targetTestimonyId?: string) => {
    const filtered = records
      .filter((record) =>
        targetTestimonyId === undefined
          ? record.testimonyId === undefined
          : record.testimonyId === targetTestimonyId
      )
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

    for (let recordIndex = filtered.length - 1; recordIndex >= 0; recordIndex -= 1) {
      const record = filtered[recordIndex];
      for (
        let decisionIndex = record.decisions.length - 1;
        decisionIndex >= 0;
        decisionIndex -= 1
      ) {
        const decision = record.decisions[decisionIndex];
        if (decision.scope === scope) {
          return decision;
        }
      }
    }

    return null;
  };

  if (testimonyId) {
    return readLatest(testimonyId) ?? readLatest(undefined);
  }

  return readLatest(undefined);
}

export function getMissingRequiredConsentScopes(
  records: WitnessConsentRecord[],
  testimonyId?: string
): WitnessConsentScope[] {
  return REQUIRED_ENTRY_SCOPES.filter(
    (scope) => latestDecisionForScope(records, scope, testimonyId)?.status !== "granted"
  );
}

export function getConsentMirrorStatus(
  records: WitnessConsentRecord[],
  testimonyId?: string
): WitnessRuntimeConsentMirrorStatus {
  return getMissingRequiredConsentScopes(records, testimonyId).length === 0
    ? "ready"
    : "missing_required";
}

export class WitnessBridgeClient {
  private readonly config = getBridgeConfig();

  private async request<T>(pathname: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const headers = new Headers(init?.headers);
      headers.set("Accept", "application/json");
      headers.set("X-TWP-Bridge-Key", this.config.sharedSecret);
      headers.set("X-TWP-Bridge-Caller", "twp-control-plane");

      const hasBody = init?.body !== undefined;
      if (hasBody && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      const res = await fetch(`${this.config.baseUrl}${pathname}`, {
        ...init,
        headers,
        cache: "no-store",
        signal: controller.signal,
      });

      const parsed = await parseBridgeResponse(res);
      if (!res.ok) {
        const message =
          parsed &&
          typeof parsed === "object" &&
          "error" in parsed &&
          typeof parsed.error === "string"
            ? parsed.error
            : `Witness bridge request failed with status ${res.status}.`;

        throw new WitnessBridgeHttpError(message, {
          status: res.status,
          retryable: res.status >= 500,
          details: parsed,
        });
      }

      return parsed as T;
    } catch (error) {
      if (error instanceof WitnessBridgeHttpError) {
        throw error;
      }

      if (error instanceof WitnessBridgeConfigError) {
        throw error;
      }

      if (
        error instanceof Error &&
        (error.name === "AbortError" || /abort/i.test(error.message))
      ) {
        throw new WitnessBridgeHttpError("Witness bridge request timed out.", {
          status: 504,
          retryable: true,
        });
      }

      throw new WitnessBridgeHttpError(
        error instanceof Error ? error.message : "Witness bridge request failed.",
        {
          status: 502,
          retryable: true,
        }
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  listConsent(witnessId: string) {
    return this.request<WitnessConsentRecord[]>(
      `/api/witness/consent?witnessId=${encodeURIComponent(witnessId)}`
    );
  }

  appendConsent(input: {
    witnessId: string;
    testimonyId?: string;
    scope: WitnessConsentScope;
    status: WitnessConsentStatus;
    actor: WitnessConsentActor;
    note?: string;
  }) {
    return this.request<WitnessConsentRecord>("/api/witness/consent", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  listWitnessTestimony(witnessId: string) {
    return this.request<WitnessBridgeTestimonyRecord[]>(
      `/api/witness/testimony?witnessId=${encodeURIComponent(witnessId)}`
    );
  }

  getWitnessSession(sessionId: string) {
    return this.request<WitnessBridgeSession>(
      `/api/inquiry/sessions/${encodeURIComponent(sessionId)}?product=witness`
    );
  }

  submitWitnessTurn(input: {
    witnessId: string;
    sessionId?: string;
    userMessage: string;
    mode?: string;
  }) {
    return this.request<WitnessBridgeTurnResponse>("/api/inquiry/turn", {
      method: "POST",
      body: JSON.stringify({
        product: "witness",
        witnessId: input.witnessId,
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        mode: input.mode ?? "dialogic",
        userMessage: input.userMessage,
      }),
    });
  }
}

export async function bootstrapWitnessRuntime(
  client: WitnessBridgeClient,
  witnessId: string
): Promise<WitnessRuntimeBootstrap> {
  const [consentRecords, testimonyRecords] = await Promise.all([
    client.listConsent(witnessId),
    client.listWitnessTestimony(witnessId),
  ]);

  const latestTestimony =
    [...testimonyRecords].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;

  let session: WitnessBridgeSession | null = null;
  if (latestTestimony?.sessionId) {
    try {
      session = await client.getWitnessSession(latestTestimony.sessionId);
    } catch (error) {
      if (
        error instanceof WitnessBridgeHttpError &&
        error.status === 404
      ) {
        session = null;
      } else {
        throw error;
      }
    }
  }

  const consentStatus = getConsentMirrorStatus(
    consentRecords,
    latestTestimony?.id
  );
  const missingScopes = getMissingRequiredConsentScopes(
    consentRecords,
    latestTestimony?.id
  );

  return {
    witnessId,
    consentStatus,
    missingScopes,
    consentRecords,
    latestTestimony,
    session,
    bridgeStatus: session ? "active" : "ready",
  };
}

export async function grantWitnessEntryConsent(
  client: WitnessBridgeClient,
  input: { witnessId: string; testimonyId?: string }
) {
  const initialRuntime = await bootstrapWitnessRuntime(client, input.witnessId);
  const resolvedTestimonyId = input.testimonyId ?? initialRuntime.latestTestimony?.id;
  const missingScopes = getMissingRequiredConsentScopes(
    initialRuntime.consentRecords,
    resolvedTestimonyId
  );

  if (missingScopes.length === 0) {
    return initialRuntime;
  }

  await Promise.all(
    missingScopes.map((scope) =>
      client.appendConsent({
        witnessId: input.witnessId,
        testimonyId: resolvedTestimonyId,
        scope,
        status: "granted",
        actor: "witness",
        note: "Granted from TWP accepted-witness bridge entry.",
      })
    )
  );

  return bootstrapWitnessRuntime(client, input.witnessId);
}
