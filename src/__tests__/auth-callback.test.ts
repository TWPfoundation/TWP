import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const verifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession,
      verifyOtp,
    },
  })),
}));

import { GET } from "@/app/auth/callback/route";

describe("auth callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("exchanges a Supabase PKCE auth code and redirects to the requested local path", async () => {
    const response = await GET(
      new Request(
        "https://thewprotocol.online/auth/callback?code=auth-code-123&next=/gate"
      )
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("auth-code-123");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://thewprotocol.online/gate");
  });

  it("verifies a token hash and redirects to the gate", async () => {
    const response = await GET(
      new Request(
        "https://thewprotocol.online/auth/callback?token_hash=token-hash-123&type=magiclink"
      )
    );

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(verifyOtp).toHaveBeenCalledWith({
      type: "magiclink",
      token_hash: "token-hash-123",
    });
    expect(response.headers.get("location")).toBe("https://thewprotocol.online/gate");
  });
});
