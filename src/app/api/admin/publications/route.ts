import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNED_URL_EXPIRES_SECONDS = 300; // 5 min

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

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get("prefix") ?? "witnesses/";
  const maxKeys = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);
  const continuationToken = searchParams.get("cursor") ?? undefined;

  const client = buildS3Client();
  const bucket = process.env.S3_BUCKET!;

  try {
    const listCmd = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken,
    });

    const listResult = await client.send(listCmd);

    const objects = await Promise.all(
      (listResult.Contents ?? []).map(async (obj) => {
        const downloadUrl = await getSignedUrl(
          client,
          new GetObjectCommand({ Bucket: bucket, Key: obj.Key }),
          { expiresIn: SIGNED_URL_EXPIRES_SECONDS }
        );
        return {
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified?.toISOString(),
          downloadUrl,
        };
      })
    );

    return NextResponse.json(
      {
        objects,
        count: objects.length,
        truncated: listResult.IsTruncated ?? false,
        nextCursor: listResult.NextContinuationToken ?? null,
        prefix,
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (err) {
    console.error("[/api/admin/publications] S3 error:", err);
    return NextResponse.json({ error: "Failed to list publications" }, { status: 500 });
  }
}
