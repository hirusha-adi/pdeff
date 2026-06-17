export function supportsFileSystemAccess() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function verifyPermission(handle, mode = "readwrite") {
  const options = { mode };
  if ((await handle.queryPermission(options)) === "granted") return true;
  return (await handle.requestPermission(options)) === "granted";
}

export async function openWritableDirectory() {
  const directoryHandle = await window.showDirectoryPicker();
  const ok = await verifyPermission(directoryHandle, "readwrite");
  if (!ok) throw new Error("Folder read/write permission was not granted.");
  return directoryHandle;
}

export async function listPdfFiles(directoryHandle) {
  const entries = [];
  for await (const [name, handle] of directoryHandle.entries()) {
    if (handle.kind === "file" && name.toLowerCase().endsWith(".pdf")) {
      entries.push({ name, handle });
    }
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export function sidecarNameForPdf(fileName) {
  return fileName.replace(/\.pdf$/i, ".pdfa");
}

export async function getSidecarHandle(directoryHandle, pdfFileName) {
  return directoryHandle.getFileHandle(sidecarNameForPdf(pdfFileName), { create: true });
}
