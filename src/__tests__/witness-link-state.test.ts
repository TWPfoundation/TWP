import { describe, expect, it, vi } from "vitest";
import { upsertWitnessRuntimeLink } from "@/lib/witness-bridge/link-state";

function createSupabaseMock(existing: Record<string, unknown> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: existing, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const from = vi.fn().mockReturnValue({ select, upsert });

  return {
    client: { from } as unknown,
    from,
    select,
    eq,
    maybeSingle,
    upsert,
  };
}

describe("upsertWitnessRuntimeLink", () => {
  it("preserves existing values for omitted fields", async () => {
    const mock = createSupabaseMock({
      access_status: "active",
      bridge_status: "error",
      runtime_consent_status: "ready",
      last_bridge_error: "bridge down",
    });

    await upsertWitnessRuntimeLink(mock.client as never, {
      witnessId: "wit-1",
      bridgeStatus: "active",
    });

    expect(mock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        witness_id: "wit-1",
        access_status: "active",
        bridge_status: "active",
        runtime_consent_status: "ready",
        last_bridge_error: "bridge down",
      }),
      { onConflict: "witness_id" }
    );
  });

  it("uses defaults only when there is no existing linkage row", async () => {
    const mock = createSupabaseMock(null);

    await upsertWitnessRuntimeLink(mock.client as never, {
      witnessId: "wit-2",
    });

    expect(mock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        witness_id: "wit-2",
        access_status: "accepted",
        bridge_status: "pending",
        runtime_consent_status: "unknown",
        last_bridge_error: null,
      }),
      { onConflict: "witness_id" }
    );
  });
});
