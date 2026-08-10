import { LOGO_MAX_EDGE, LOGO_WEBP_QUALITY, MAX_LOGO_BYTES, MAX_LOGO_SOURCE_BYTES } from "@/shared/constants";

export type EncodedLogo = {
  blob: Blob;
  fileName: string;
  contentType: "image/webp" | "image/png";
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

/** Resize to max edge and encode WebP (PNG fallback). */
export async function encodeLogoFile(file: File): Promise<EncodedLogo> {
  if (file.size > MAX_LOGO_SOURCE_BYTES) {
    throw new Error("Image is too large (max 4 MB before processing)");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("File must be an image");
  }

  const img = await loadImage(file);
  const scale = Math.min(1, LOGO_MAX_EDGE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, width, height);

  const webp = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/webp", LOGO_WEBP_QUALITY);
  });
  if (webp && webp.size > 0) {
    if (webp.size > MAX_LOGO_BYTES) {
      throw new Error("Encoded logo exceeds 1 MB. Try a simpler image.");
    }
    return { blob: webp, fileName: "logo.webp", contentType: "image/webp" };
  }

  const png = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png");
  });
  if (!png) throw new Error("Could not encode logo");
  if (png.size > MAX_LOGO_BYTES) {
    throw new Error("Encoded logo exceeds 1 MB. Try a simpler image.");
  }
  return { blob: png, fileName: "logo.png", contentType: "image/png" };
}

export async function uploadBusinessLogo(input: {
  businessId: string;
  file: File;
}): Promise<{ publicUrl: string; storageKey: string }> {
  const encoded = await encodeLogoFile(input.file);
  const presign = await fetch("/api/uploads/logo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessId: input.businessId,
      fileName: encoded.fileName,
      contentType: encoded.contentType,
      contentLength: encoded.blob.size,
    }),
  });
  if (!presign.ok) {
    const err = (await presign.json().catch(() => null)) as { error?: string } | null;
    throw new Error(err?.error ?? "Could not start logo upload");
  }
  const { uploadUrl, storageKey, publicUrl } = (await presign.json()) as {
    uploadUrl: string;
    storageKey: string;
    publicUrl: string;
  };

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": encoded.contentType },
    body: encoded.blob,
  });
  if (!put.ok) throw new Error("Logo upload to storage failed");

  const complete = await fetch("/api/uploads/logo/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessId: input.businessId,
      storageKey,
      publicUrl,
    }),
  });
  if (!complete.ok) {
    const err = (await complete.json().catch(() => null)) as { error?: string } | null;
    throw new Error(err?.error ?? "Could not finalize logo upload");
  }
  return (await complete.json()) as { publicUrl: string; storageKey: string };
}
