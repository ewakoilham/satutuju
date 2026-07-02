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
 * - Office files carry their REAL types (application/msword, …openxml…) —
 *   browsers always download those, never render them as markup, and the
 *   storage bucket's MIME whitelist requires the real types (it rejects
 *   application/octet-stream with a 415 — learned in production).
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

  // Modern Office (docx/xlsx/pptx) — ZIP container: "PK\x03\x04". Checked
  // before the PDF scan because these are exact position-0 signatures, while
  // the PDF check scans a window (compressed zip bytes could contain "%PDF").
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ext: "docx",
    };
  }

  // Legacy Office (.doc/.xls/.ppt) — OLE compound file: D0 CF 11 E0 A1 B1 1A E1.
  if (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 && bytes[5] === 0xb1 && bytes[6] === 0x1a && bytes[7] === 0xe1
  ) {
    return { contentType: "application/msword", ext: "doc" };
  }

  // PDF: "%PDF" — per spec the header may sit up to 1024 bytes in (some
  // generators prepend junk/BOM), so scan the first 1KB instead of byte 0.
  const kb = bytes.subarray(0, 1024);
  for (let i = 0; i + 3 < kb.length; i++) {
    if (kb[i] === 0x25 && kb[i + 1] === 0x50 && kb[i + 2] === 0x44 && kb[i + 3] === 0x46) {
      return { contentType: "application/pdf", ext: "pdf" };
    }
  }

  // Plain text: no magic bytes — accept only if the first 8KB decodes as
  // text (no NUL bytes) and doesn't open like markup/script. Bare
  // "text/plain" (no charset suffix) so exact-match MIME whitelists pass.
  const head = bytes.subarray(0, 8192);
  if (head.length > 0 && !head.includes(0)) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(head);
    if (!MARKUP_RX.test(text)) return { contentType: "text/plain", ext: "txt" };
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
