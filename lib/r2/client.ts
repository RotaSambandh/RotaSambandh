import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  ALLOWED_LOGO_MIME,
  ALLOWED_RESUME_MIME,
  MAX_LOGO_BYTES,
  MAX_RESUME_BYTES,
} from "@/shared/constants";

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 is not configured. Set R2_* environment variables.");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function resumeBucket(): string {
  const b = process.env.R2_BUCKET;
  if (!b) throw new Error("R2_BUCKET is not set");
  return b;
}

function logosBucket(): string {
  return process.env.R2_LOGOS_BUCKET || "rotasambandhassets";
}

export function logosPublicBaseUrl(): string {
  const base = process.env.R2_PUBLIC_BASE_URL || "https://assets.rotasambandh.com";
  return base.replace(/\/$/, "");
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

export function isR2LogosConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY,
  );
}

export function buildResumeKey(userId: string, documentId: string, fileName: string) {
  const safe = fileName.replace(/[^\w.\-]+/g, "_");
  return `resumes/${userId}/${documentId}/${safe}`;
}

export function buildLogoKey(businessId: string, fileName: string) {
  const safe = fileName.replace(/[^\w.\-]+/g, "_");
  return `logos/${businessId}/${Date.now()}_${safe}`;
}

export function publicLogoUrl(storageKey: string): string {
  return `${logosPublicBaseUrl()}/${storageKey.replace(/^\//, "")}`;
}

export async function createUploadUrl(input: {
  key: string;
  contentType: string;
  contentLength: number;
  expiresIn?: number;
}) {
  if (!ALLOWED_RESUME_MIME.includes(input.contentType as (typeof ALLOWED_RESUME_MIME)[number])) {
    throw new Error("Unsupported file type");
  }
  if (input.contentLength > MAX_RESUME_BYTES) {
    throw new Error("File exceeds maximum size");
  }

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: resumeBucket(),
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.contentLength,
  });

  return getSignedUrl(client, command, { expiresIn: input.expiresIn ?? 300 });
}

export async function createLogoUploadUrl(input: {
  key: string;
  contentType: string;
  contentLength: number;
  expiresIn?: number;
}) {
  if (!ALLOWED_LOGO_MIME.includes(input.contentType as (typeof ALLOWED_LOGO_MIME)[number])) {
    throw new Error("Unsupported file type");
  }
  if (input.contentLength > MAX_LOGO_BYTES) {
    throw new Error("File exceeds maximum size");
  }

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: logosBucket(),
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.contentLength,
  });

  return getSignedUrl(client, command, { expiresIn: input.expiresIn ?? 300 });
}

export async function createDownloadUrl(key: string, expiresIn = 120) {
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: resumeBucket(),
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn });
}

/** Delete all logo objects under logos/{businessId}/ (permanent company purge). */
export async function deleteBusinessLogoPrefix(businessId: string): Promise<number> {
  if (!isR2LogosConfigured()) return 0;
  const client = getR2Client();
  const bucket = logosBucket();
  const prefix = `logos/${businessId}/`;
  let deleted = 0;
  let continuationToken: string | undefined;

  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    const keys = (listed.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => Boolean(k));
    if (keys.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      deleted += keys.length;
    }
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);

  return deleted;
}
