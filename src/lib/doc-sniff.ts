/**
 * Sniff an uploaded *document* from its magic bytes — the document-flavored
 * sibling of `image-sniff.ts` (avatar/deposit). Used by the pairing document
 * upload, whose accept list is `.pdf,.doc,.docx,.txt,image/*`.
 *
 * Never trusts the client-supplied `file.type` / `file.name` (both
 * attacker-controlled). Returns the canonical content-type to STORE AND SERVE
 * the file under, or null when the bytes are not an allowed document type.
 *
 * Safety notes:
 * - Office files (legacy OLE .doc and modern ZIP .docx/.xlsx) are served as
 *   application/octet-stream so browsers download instead of rendering.
 * - Plain text is allowed but rejected when it looks like markup
 *   (HTML/SVG/scripts) — text/plain isn't rendered as HTML by modern
 *   browsers, but there's no reason to store markup as a "document" at all.
 * - No branch ever returns text/html, image/svg+xml, or an executable type.
 */

import { sniffImage } from "./image-sniff";

export interface DocSniff {
  contentType: string;
  ext: string;
}

const MARKUP_RX = /^\s*(<!doctype\b|<html\b|<script\b|<svg\b|<\?php|<%)/i;

export function sniffDocument(bytes: Uint8Array): DocSniff | null {
  // Images (JPEG/PNG/WebP) — same set the rest of the app allows.
  const img = sniffImage(bytes);
  if (img) return img;

  // PDF: "%PDF"
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { contentType: "application/pdf", ext: "pdf" };
  }

  // Modern Office (docx/xlsx/pptx) — ZIP container: "PK\x03\x04".
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return { contentType: "application/octet-stream", ext: "docx" };
  }

  // Legacy Office (.doc/.xls/.ppt) — OLE compound file: D0 CF 11 E0 A1 B1 1A E1.
  if (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 && bytes[5] === 0xb1 && bytes[6] === 0x1a && bytes[7] === 0xe1
  ) {
    return { contentType: "application/octet-stream", ext: "doc" };
  }

  // Plain text: no magic bytes — accept only if the first 8KB decodes as
  // text (no NUL bytes) and doesn't open like markup/script.
  const head = bytes.subarray(0, 8192);
  if (head.length > 0 && !head.includes(0)) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(head);
    if (!MARKUP_RX.test(text)) return { contentType: "text/plain; charset=utf-8", ext: "txt" };
  }

  return null;
}

/** Make a client filename safe for a storage key: strip any path, collapse
 *  disallowed characters, and cap the length. Extension comes from the sniff,
 *  not from here. */
export function sanitizeBaseName(name: string): string {
  const base = name.split(/[\\/]/).pop() || "dokumen";
  const noExt = base.replace(/\.[^.]*$/, "");
  const safe = noExt.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^[_.]+|[_.]+$/g, "");
  return (safe || "dokumen").slice(0, 80);
}
