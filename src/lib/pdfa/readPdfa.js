import { explainValidationError, migratePdfa } from "./schema.js";

export async function readPdfaFile(file) {
  const text = await file.text();
  if (!text.trim()) return null;

  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }

  try {
    return migratePdfa(raw);
  } catch (error) {
    throw new Error(explainValidationError(error));
  }
}
