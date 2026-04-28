import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { summonsSchema } from "@/lib/utils/validation";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

// Use service role for server-side operations
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
    "https://thewprotocol.online"
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = summonsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // Insert into summons table (ignore duplicate)
    const { error: dbError } = await supabase
      .from("summons")
      .insert([{ email }]);

    if (dbError && dbError.code !== "23505") {
      console.error("Database error:", dbError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    const redirectTo = `${getAppUrl()}/auth/callback`;
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });

    const hashedToken = linkData?.properties?.hashed_token;
    const verificationType = linkData?.properties?.verification_type;

    if (linkError || !hashedToken || !verificationType) {
      console.error("Auth link generation error:", linkError);
      return NextResponse.json(
        { error: "Unable to create authentication link" },
        { status: 502 }
      );
    }

    const authUrl = new URL("/auth/callback", getAppUrl());
    authUrl.searchParams.set("token_hash", hashedToken);
    authUrl.searchParams.set("type", verificationType);
    authUrl.searchParams.set("next", "/gate");

    const authLink = authUrl.toString();
    const safeEmail = escapeHtml(email);
    const safeAuthLink = escapeHtml(authLink);

    const emailResult = await resend.emails.send({
      from: "The Witness Protocol <noreply@thewprotocol.online>",
      to: email,
      subject: "Your Witness Protocol Authentication Link",
      text: [
        "Summons Acknowledged",
        "",
        "Use this secure one-time link to verify your identity and proceed to The Gate:",
        authLink,
        "",
        "This link expires in 24 hours.",
        "",
        "Stichting The Witness Protocol Foundation",
      ].join("\n"),
      html: `
          <div style="font-family: 'Georgia', serif; max-width: 560px; margin: 0 auto; color: #e0e0e0; background-color: #050505; padding: 40px 30px;">
            <p style="text-align: center; font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; color: #808080; margin-bottom: 30px;">
              The Witness Protocol Foundation
            </p>
            
            <h1 style="font-family: 'Georgia', serif; font-weight: 300; font-size: 24px; text-align: center; letter-spacing: 0.1em; margin-bottom: 30px; color: #e0e0e0;">
              Summons Acknowledged
            </h1>
            
            <p style="font-size: 15px; line-height: 1.7; color: #808080;">
              Your email has been registered with The Witness Protocol Foundation.
            </p>
            
            <p style="font-size: 15px; line-height: 1.7; color: #808080;">
              Use the secure one-time link below to verify <strong>${safeEmail}</strong>
              and proceed directly to <strong>The Gate</strong>.
            </p>

            <p style="text-align: center; margin: 30px 0;">
              <a href="${safeAuthLink}" style="display: inline-block; border: 1px solid #808080; color: #e0e0e0; text-decoration: none; padding: 12px 22px; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase;">
                Enter The Gate
              </a>
            </p>

            <p style="font-size: 12px; line-height: 1.7; color: #555555; word-break: break-all;">
              If the button does not work, copy and paste this link into your browser:<br />
              <a href="${safeAuthLink}" style="color: #808080;">${safeAuthLink}</a>
            </p>
            
            <p style="font-size: 15px; line-height: 1.7; color: #808080;">
              Please note: this is a <em>Phase 5 Alpha research initiative</em>. The Protocol's
              core instruments are live and capturing testimony. You are not joining a product — you are being
              asked to contribute to an experiment.
            </p>
            
            <hr style="border: none; border-top: 1px solid #1f1f1f; margin: 30px 0;" />
            
            <p style="font-size: 12px; color: #808080; line-height: 1.6;">
              <strong>What happens next:</strong><br />
              · Open the Authentication Link<br />
              · Verify your identity (Session-based, no password)<br />
              · Proceed to The Gate to submit your testimony
            </p>
            
            <hr style="border: none; border-top: 1px solid #1f1f1f; margin: 30px 0;" />
            
            <p style="text-align: center; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #555555;">
              Stichting The Witness Protocol Foundation · Amsterdam, Netherlands
            </p>
            <p style="text-align: center; font-size: 10px; color: #333333;">
              Phase 5 Alpha · Not a product · Published failures at thewprotocol.online/failure-log
            </p>
          </div>
        `,
    });

    if (emailResult.error) {
      console.error("Email send error:", emailResult.error);
      return NextResponse.json(
        { error: "Unable to send authentication link" },
        { status: 502 }
      );
    }

    // Log to audit trail
    await supabase.from("audit_log").insert([
      {
        action: "summons.register",
        target_type: "summons",
        metadata: {
          auth_link_sent: true,
          email_provider: "resend",
        },
      },
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Intake error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
