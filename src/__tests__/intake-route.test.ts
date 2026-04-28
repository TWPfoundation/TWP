import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn();
const generateLink = vi.fn();
const insertSummons = vi.fn();
const insertAuditLog = vi.fn();
const from = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn(function Resend() {
    return {
      emails: {
        send: sendEmail,
      },
    };
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      admin: {
        generateLink,
      },
    },
    from,
  })),
}));

describe("POST /api/intake", () => {
  let POST: typeof import("@/app/api/intake/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.RESEND_API_KEY = "resend-key";
    process.env.NEXT_PUBLIC_APP_URL = "https://thewprotocol.online";

    insertSummons.mockResolvedValue({ error: null });
    insertAuditLog.mockResolvedValue({ error: null });
    generateLink.mockResolvedValue({
      data: {
        properties: {
          action_link: "https://project.supabase.co/auth/v1/verify?token=test-token&type=magiclink",
          hashed_token: "test-token-hash",
          verification_type: "magiclink",
        },
      },
      error: null,
    });
    sendEmail.mockResolvedValue({ data: { id: "email-1" }, error: null });
    from.mockImplementation((table: string) => ({
      insert: table === "summons" ? insertSummons : insertAuditLog,
    }));

    ({ POST } = await import("@/app/api/intake/route"));
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.RESEND_API_KEY;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("generates a Supabase token hash server-side and sends an app callback link through Resend", async () => {
    const response = await POST(
      new Request("https://thewprotocol.online/api/intake", {
        method: "POST",
        body: JSON.stringify({ email: "witness@example.com" }),
      })
    );

    expect(generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "witness@example.com",
      options: {
        redirectTo: "https://thewprotocol.online/auth/callback",
      },
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "witness@example.com",
        html: expect.stringContaining(
          "https://thewprotocol.online/auth/callback?token_hash=test-token-hash&amp;type=magiclink&amp;next=%2Fgate"
        ),
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
