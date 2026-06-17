export function serializePdfa(pdfa) {
  return `${JSON.stringify(pdfa, null, 2)}\n`;
}

export async function writePdfaHandle(fileHandle, pdfa) {
  const writable = await fileHandle.createWritable();
  await writable.write(serializePdfa(pdfa));
  await writable.close();
}

export function downloadPdfa(pdfa, fileName) {
  const blob = new Blob([serializePdfa(pdfa)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
