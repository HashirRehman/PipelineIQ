// Turns an uploaded CV into plain text. Server-only.
//
// Don't swap unpdf for pdf-parse: pdf-parse needs @napi-rs/canvas (a native
// binary) to supply DOMMatrix, which resolves locally but not on deploy.
import mammoth from "mammoth";

export const PDF_MIME_TYPE = "application/pdf";
export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const DOC_MIME_TYPE = "application/msword";

export type CvExtractionFailureReason =
  // legacy .doc is allowed on upload but mammoth only reads .docx
  | "unsupported_type"
  // parsed fine, no text layer — almost always a scan
  | "no_text"
  // corrupt, truncated, or password-protected
  | "unreadable";

export class CvExtractionError extends Error {
  readonly reason: CvExtractionFailureReason;

  constructor(reason: CvExtractionFailureReason, message: string) {
    super(message);
    this.name = "CvExtractionError";
    this.reason = reason;
  }
}

// A real one-page resume measures ~1000 chars, so anything under this has no
// text layer rather than being a short CV.
const MIN_USABLE_TEXT_CHARS = 100;

export type CvTextExtraction = {
  text: string;
  charCount: number;
};

// Strips layout noise but keeps single newlines — section breaks are signal
// for the parse step.
function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    // zero-width chars in PDF text layers can split a skill name mid-word
    .replace(/[​-‍﻿]/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Lazy: every /api/profiles route reaches this module via the parse
  // scheduler, and listing profiles shouldn't load a PDF engine.
  const { extractText, getDocumentProxy } = await import("unpdf");

  try {
    // pdfjs takes ownership of the array, so hand it a copy
    const doc = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(doc, { mergePages: true });
    return text;
  } catch (error) {
    throw new CvExtractionError(
      "unreadable",
      `Could not read the PDF: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    // raw text, not HTML — markup would just cost tokens
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    throw new CvExtractionError(
      "unreadable",
      `Could not read the Word document: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Throws CvExtractionError with a typed reason on every failure path. */
export async function extractCvText(
  buffer: Buffer,
  fileType: string,
): Promise<CvTextExtraction> {
  let raw: string;

  switch (fileType) {
    case PDF_MIME_TYPE:
      raw = await extractPdfText(buffer);
      break;
    case DOCX_MIME_TYPE:
      raw = await extractDocxText(buffer);
      break;
    case DOC_MIME_TYPE:
      throw new CvExtractionError(
        "unsupported_type",
        "Legacy .doc files can't be read automatically. Re-upload the CV as a PDF or .docx.",
      );
    default:
      throw new CvExtractionError(
        "unsupported_type",
        `Unsupported file type for text extraction: ${fileType}`,
      );
  }

  const text = normalizeExtractedText(raw);

  if (text.length < MIN_USABLE_TEXT_CHARS) {
    throw new CvExtractionError(
      "no_text",
      "No readable text found in this file. It's likely a scanned image rather than a text document.",
    );
  }

  return { text, charCount: text.length };
}
