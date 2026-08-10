// CV text extraction — the step before any AI sees a resume.
//
// Uploads land as PDF, DOCX, or legacy DOC (the three types the upload path
// and the profile_cvs_file_type_check constraint allow). The AI parse takes
// text, so this module turns bytes into text deterministically — no model
// call, no token cost, no network.
//
// Server-only: both libraries are CJS and Node-bound, so this must never be
// imported into a client component or the Edge runtime. `pdf-parse` and
// `mammoth` are listed in next.config.ts's serverExternalPackages so Next
// leaves them as real Node requires instead of bundling pdf.js.
//
// pdf-parse is on the 2.x line for a security reason, not a preference. The
// 1.x line vendors pdf.js 1.9-2.0 (2018) *inside* the package rather than
// declaring it as a dependency, so `npm audit` cannot see it and reports
// clean — while that pdf.js range is affected by CVE-2024-4367, arbitrary
// JS execution triggered by a crafted PDF. CVs arrive from candidates and
// are parsed here, server-side, which is exactly that threat model. 2.x
// depends on a current pdfjs-dist instead.
//
// The cost is a Node floor of >=20.16, which is not a real constraint: Next
// 16 already requires >=20.9, so this project never ran on anything older.
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const PDF_MIME_TYPE = "application/pdf";
export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const DOC_MIME_TYPE = "application/msword";

export type CvExtractionFailureReason =
  // Legacy binary .doc — accepted by the upload path (and by the DB's mime
  // whitelist) but not readable by mammoth, which handles only the
  // Open-XML .docx format. Surfaced as its own reason rather than lumped in
  // with corruption, because the fix is "re-upload as PDF or DOCX", not
  // "the file is broken".
  | "unsupported_type"
  // The file parsed fine but yielded (almost) no text. Overwhelmingly this
  // is a scanned/photographed resume — an image with no text layer. Worth
  // its own reason so the UI can say something actionable instead of
  // showing an empty parse that looks like a bug.
  | "no_text"
  // The bytes aren't a readable document (truncated upload, wrong type,
  // password-protected PDF).
  | "unreadable";

export class CvExtractionError extends Error {
  readonly reason: CvExtractionFailureReason;

  constructor(reason: CvExtractionFailureReason, message: string) {
    super(message);
    this.name = "CvExtractionError";
    this.reason = reason;
  }
}

// A one-page resume runs ~950-1000 characters of extracted text (measured
// against real single-page PDF and DOCX resumes). A successful parse landing
// under this is not a short CV — it's a document with no text layer, where
// pdf-parse still returns page furniture or a stray ligature. Set well below
// a real floor so a genuinely terse CV is never rejected, and treated as a
// signal to fail loudly rather than send near-empty text to the model.
const MIN_USABLE_TEXT_CHARS = 100;

export type CvTextExtraction = {
  text: string;
  charCount: number;
};

// Both extractors emit layout noise that costs tokens and tells the model
// nothing: PDFs produce runs of blank lines where visual spacing was, DOCX
// produces trailing spaces per paragraph. Blank-line runs collapse to a
// single break and per-line padding goes, but single newlines survive —
// section boundaries ("Skills", "Experience") are real signal for the parse
// step, so this deliberately does not flatten everything to one line.
function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    // Zero-width and BOM characters ride along in PDF text layers and can
    // land mid-word, splitting a skill name ("Type​Script").
    .replace(/[​-‍﻿]/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // A PDFParse instance holds an open pdf.js document, so it is destroyed in
  // a finally — this runs inside a long-lived server process, not a one-shot
  // script, and a leak per upload would accumulate.
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text;
  } catch (error) {
    throw new CvExtractionError(
      "unreadable",
      `Could not read the PDF: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await parser.destroy().catch(() => {
      // Cleanup failure must not mask a successful extraction or replace a
      // real parse error with a less useful one.
    });
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    // extractRawText, not convertToHtml — the parse step wants prose, and
    // markup would only inflate the token count.
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    throw new CvExtractionError(
      "unreadable",
      `Could not read the Word document: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Extracts plain text from an uploaded CV.
 *
 * Throws CvExtractionError with a typed `reason` on every failure path, so
 * the caller can record why in profile_cvs.parse_error instead of storing an
 * empty parse that reads as success.
 */
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
      "No readable text found in this file — it's likely a scanned image rather than a text document.",
    );
  }

  return { text, charCount: text.length };
}
