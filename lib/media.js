const MAX_INLINE_IMAGE_BYTES = 2_500_000;

export function normalizeMediaUrlInput(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

export async function resolveInlineImageDataUrl(file) {
  if (!file || typeof file.arrayBuffer !== "function" || !file.size) {
    return null;
  }

  if (!String(file.type || "").startsWith("image/")) {
    return null;
  }

  if (file.size > MAX_INLINE_IMAGE_BYTES) {
    return null;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

export function getInlineImageUploadLimitLabel() {
  const megabytes = MAX_INLINE_IMAGE_BYTES / 1_000_000;
  return Number.isInteger(megabytes) ? `${megabytes} MB` : `${megabytes.toFixed(1)} MB`;
}
