import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildS3Client() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT!,
    region: process.env.S3_REGION ?? "eu-west-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
  });
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const client = buildS3Client();
    const bucket = process.env.S3_BUCKET!;

    const cmd = new GetObjectCommand({
      Bucket: bucket,
      Key: "_meta/engine-index.json",
    });

    const response = await client.send(cmd);
    const body = await response.Body?.transformToString();

    if (!body) {
      return NextResponse.json(
        { error: "Engine index not found. Run sync-engine-index.ts first." },
        { status: 404 }
      );
    }

    const index = JSON.parse(body);
    return NextResponse.json(index, {
      headers: {
        "Cache-Control": "no-store",
        "X-Powered-By": "G_5.2 Sync",
      },
    });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "NoSuchKey") {
      return NextResponse.json(
        { error: "Engine index not found. Run sync-engine-index.ts first." },
        { status: 404 }
      );
    }

    console.error("[/api/admin/engine] S3 error:", err);
    return NextResponse.json({ error: "Failed to fetch engine index" }, { status: 500 });
  }
}
