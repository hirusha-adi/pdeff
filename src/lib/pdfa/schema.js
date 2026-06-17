import { z } from "zod";

const pointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1)
});

const rectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1)
});

const sourceSchema = z.object({
  fileName: z.string(),
  sha256: z.string(),
  size: z.number().nonnegative(),
  lastModified: z.number().nonnegative()
});

const documentStateSchema = z.object({
  lastOpenedPage: z.number().int().positive().default(1),
  zoom: z.number().positive().default(1),
  scrollTop: z.number().nonnegative().default(0)
});

const baseAnnotationSchema = z.object({
  id: z.string(),
  page: z.number().int().positive(),
  color: z.string(),
  opacity: z.number().min(0).max(1),
  createdAt: z.string(),
  updatedAt: z.string()
});

const inkAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal("ink"),
  width: z.number().positive(),
  points: z.array(pointSchema).min(1)
});

const highlightAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal("highlight"),
  rects: z.array(rectSchema).min(1)
});

const commentSchema = z.object({
  id: z.string(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const commentThreadSchema = z.object({
  id: z.string(),
  page: z.number().int().positive(),
  anchor: pointSchema,
  comments: z.array(commentSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const pdfaSchemaV1 = z.object({
  format: z.literal("offline-pdf-annotator-pdfa"),
  version: z.literal(1),
  source: sourceSchema,
  documentState: documentStateSchema,
  annotations: z.array(z.discriminatedUnion("type", [inkAnnotationSchema, highlightAnnotationSchema])),
  commentThreads: z.array(commentThreadSchema),
  updatedAt: z.string()
});

export function migratePdfa(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("PDFA data must be a JSON object.");
  }

  if (raw.version === 1) {
    return pdfaSchemaV1.parse(raw);
  }

  throw new Error(`Unsupported .pdfa version: ${raw.version ?? "missing"}`);
}

export function explainValidationError(error) {
  if (!error?.issues) return error?.message ?? "Unknown .pdfa validation error.";
  return error.issues
    .slice(0, 6)
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");
}
