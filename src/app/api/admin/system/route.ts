import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HealthCheck {
  name: string;
  status: "ok" | "degraded" | "error";
  latencyMs?: number;
  detail?: string;
}

async function checkSupabase(): Promise<HealthCheck> {
  const t0 = performance.now();
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("admin_roles").select("id").limit(1);
    const latencyMs = Math.round(performance.now() - t0);
    if (error) return { name: "supabase", status: "degraded", latencyMs, detail: error.message };
    return { name: "supabase", status: "ok", latencyMs };
  } catch (err) {
    return {
      name: "supabase",
      status: "error",
      latencyMs: Math.round(performance.now() - t0),
      detail: String(err),
    };
  }
}

async function checkS3(): Promise<HealthCheck> {
  const t0 = performance.now();
  try {
    const client = new S3Client({
      endpoint: process.env.S3_ENDPOINT!,
      region: process.env.S3_REGION ?? "eu-west-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
    });
    await client.send(new ListBucketsCommand({}));
    const latencyMs = Math.round(performance.now() - t0);
    return { name: "s3_storage", status: "ok", latencyMs };
  } catch (err) {
    return {
      name: "s3_storage",
      status: "error",
      latencyMs: Math.round(performance.now() - t0),
      detail: String(err),
    };
  }
}

async function checkOpenAI(): Promise<HealthCheck> {
  const t0 = performance.now();
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return { name: "openai", status: "degraded", detail: "OPENAI_API_KEY not set" };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Math.round(performance.now() - t0);
    if (!res.ok) {
      return { name: "openai", status: "degraded", latencyMs, detail: `HTTP ${res.status}` };
    }
    return { name: "openai", status: "ok", latencyMs };
  } catch (err) {
    return {
      name: "openai",
      status: "error",
      latencyMs: Math.round(performance.now() - t0),
      detail: String(err),
    };
  }
}

function checkEnvVars(): HealthCheck {
  const required = [
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    return {
      name: "env_config",
      status: "error",
      detail: `Missing: ${missing.join(", ")}`,
    };
  }
  return { name: "env_config", status: "ok" };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const [supabase, s3, openai] = await Promise.all([
    checkSupabase(),
    checkS3(),
    checkOpenAI(),
  ]);
  const envCheck = checkEnvVars();

  const checks: HealthCheck[] = [envCheck, supabase, s3, openai];
  const overallStatus = checks.some((c) => c.status === "error")
    ? "error"
    : checks.some((c) => c.status === "degraded")
    ? "degraded"
    : "ok";

  return NextResponse.json(
    {
      status: overallStatus,
      checkedAt: new Date().toISOString(),
      checks,
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
