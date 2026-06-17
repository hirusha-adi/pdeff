export async function sha256ArrayBuffer(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function getPdfSourceInfo(file, buffer) {
  const bytes = buffer ?? (await file.arrayBuffer());
  return {
    fileName: file.name,
    sha256: await sha256ArrayBuffer(bytes.slice(0)),
    size: file.size,
    lastModified: file.lastModified
  };
}

export function sourceMatchesPdf(source, sourceInfo) {
  if (!source || !sourceInfo) return false;
  return source.sha256 === sourceInfo.sha256 && source.size === sourceInfo.size;
}
