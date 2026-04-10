import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { summonsSchema } from "@/lib/utils/validation";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

// Use service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Send confirmation email via Resend
    try {
      await resend.emails.send({
        from: "The Witness Protocol <noreply@thewprotocol.online>",
        to: email,
        subject: "The Summons Has Been Received",
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
              If you meet the preliminary criteria for participation, you will receive
              a Methodological Humility Statement (MHS) assessment packet. This document
              outlines the Foundation's approach, limitations, and expectations.
            </p>
            
            <p style="font-size: 15px; line-height: 1.7; color: #808080;">
              Please note: this is a <em>Phase 5 Alpha research initiative</em>. The Protocol's
              core instruments are live and capturing testimony. You are not joining a product — you are being
              asked to contribute to an experiment.
            </p>
            
            <hr style="border: none; border-top: 1px solid #1f1f1f; margin: 30px 0;" />
            
            <p style="font-size: 12px; color: #808080; line-height: 1.6;">
              <strong>What happens next:</strong><br />
              · The Foundation reviews incoming registrations<br />
              · Qualified individuals receive the MHS Packet<br />
              · Acceptance of the MHS is required before proceeding to The Gate
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
    } catch (emailError) {
      // Log but don't fail — the summons was registered
      console.error("Email send error:", emailError);
    }

    // Log to audit trail
    await supabase.from("audit_log").insert([
      {
        action: "summons.register",
        target_type: "summons",
        metadata: { email_sent: true },
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
