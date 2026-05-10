/**
 * Server-side PDF rendering for the Perjanjian Kemitraan Mentor.
 *
 * Strategy: keep the layout dead simple. We render the contract body as a
 * single multi-line `<Text>` block (auto page-breaks via @react-pdf/renderer)
 * preceded by a header and followed by a fixed-width signing block that
 * embeds the captured signature image.
 *
 * We deliberately avoid:
 *  - flex rows + nested flex children (Yoga produced layout overflows that
 *    triggered PDFKit's "unsupported number" sentinel),
 *  - percentage widths,
 *  - tables.
 *
 * The trade-off: typography is plainer than a marked-AST → react-pdf
 * walker would give us. The legal substance (every paragraph, every list
 * item, every appendix row) is preserved verbatim in the body text.
 */

// `server-only` directive removed so this module is callable from one-off
// node scripts (see prisma/scripts/regenerate-contract-pdfs.ts). The
// `@react-pdf/renderer` import below is itself node-only — server
// guarantees come from that, not from a directive.
import fs from "fs";
import path from "path";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { IdentitySnapshot } from "@/lib/contract-template";

// PIHAK PERTAMA's signature is templated onto every contract — Razak
// has authorised his image as the standing electronic signature for
// any contract executed under template version `CONTRACT_VERSION` and
// later. We load it once at module init and reuse the buffer across
// renders. If the file is missing (e.g. fresh checkout without the
// asset), we fall back to a blank line so PDF rendering doesn't fail.
function loadRazakSignature(): { data: Buffer; format: "png" } | null {
  try {
    const buf = fs.readFileSync(
      path.join(process.cwd(), "public", "signatures", "razak.png"),
    );
    return { data: buf, format: "png" };
  } catch {
    console.warn(
      "[contract-pdf] Razak signature missing at public/signatures/razak.png — PIHAK PERTAMA signature line will be blank.",
    );
    return null;
  }
}
const RAZAK_SIGNATURE = loadRazakSignature();

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    lineHeight: 1.55,
    color: "#111827",
  },
  title: {
    fontSize: 16,
    fontFamily: "Times-Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Times-Bold",
    textAlign: "center",
    marginBottom: 8,
  },
  contractNumber: {
    fontSize: 10,
    textAlign: "center",
    marginBottom: 18,
    color: "#374151",
  },
  body: {
    fontSize: 10,
    marginBottom: 5,
    // Justify-align caused PDFKit's number formatter to overflow on very
    // long Text blocks (-1.78e+21 from internal advance-width calculations).
    // Plain left-align is layout-safe and reads fine in PDF.
    textAlign: "left",
  },
  signingBlock: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signingCol: { width: 220 },
  signingHeader: { fontFamily: "Times-Bold", marginBottom: 6, textAlign: "center" },
  materai: { fontSize: 9, color: "#6b7280", textAlign: "center", marginBottom: 30 },
  signatureImg: { width: 140, height: 60, marginBottom: 4, alignSelf: "center" },
  signaturePlaceholder: {
    height: 60,
    borderBottomWidth: 0.5,
    borderBottomColor: "#9ca3af",
    marginBottom: 4,
  },
  signatureName: { textAlign: "center", fontFamily: "Times-Bold" },
  signatureSubtitle: { textAlign: "center", fontSize: 9, color: "#374151" },
  pageNumber: {
    position: "absolute",
    bottom: 28,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 9,
    color: "#6b7280",
  },
});

// ─── Markdown → plain text ────────────────────────────────────────────────

/**
 * Convert the interpolated contract markdown into plain text suitable for
 * a single justified `<Text>` block. We preserve paragraphs (blank lines),
 * list markers, and appendix rows verbatim — only inline emphasis markers
 * (`**bold**`, `*italic*`, `` `code` ``), heading hashes, and table pipes
 * are stripped.
 *
 * The trailing comparison-table signing block from the source is dropped:
 * we emit our own SigningBlock with the captured signature image instead.
 */
function markdownToPlainText(md: string): string {
  // Strip the source signing block: "DEMIKIAN PERJANJIAN INI…" through the
  // start of "LAMPIRAN A".
  let trimmed = md;
  const demikianIdx = trimmed.indexOf("DEMIKIAN PERJANJIAN INI");
  const lampiranIdx = trimmed.indexOf("# LAMPIRAN A");
  if (demikianIdx !== -1 && lampiranIdx !== -1 && lampiranIdx > demikianIdx) {
    trimmed = trimmed.slice(0, demikianIdx).trimEnd() + "\n\n" + trimmed.slice(lampiranIdx);
  }

  return trimmed
    // Drop raw <hr/> markers (lines of exactly ---).
    .replace(/^\s*---\s*$/gm, "")
    // Headings: keep the text, drop the leading hashes; uppercase H1/H2 for
    // visual hierarchy in plain-text rendering.
    .replace(/^######\s+(.*)$/gm, "$1")
    .replace(/^#####\s+(.*)$/gm, "$1")
    .replace(/^####\s+(.*)$/gm, "$1")
    .replace(/^###\s+(.*)$/gm, "$1")
    .replace(/^##\s+(.*)$/gm, (_m, t: string) => `\n${t}\n`)
    .replace(/^#\s+(.*)$/gm, (_m, t: string) => `\n${t.toUpperCase()}\n`)
    // Inline emphasis.
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    // Tables: Lampiran A is the only one. Convert "| col | col |" rows into
    // tab-separated lines so they read as a list, and drop the "|---|"
    // alignment rows entirely.
    .replace(/^\|\s*[-:]+\s*(\|\s*[-:]+\s*)+\|?\s*$/gm, "")
    .replace(/^\|(.+)\|\s*$/gm, (_m, inner: string) =>
      inner
        .split("|")
        .map((c) => c.trim())
        .join("    "),
    )
    // Collapse 3+ blank lines into 2.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Signing block ───────────────────────────────────────────────────────

function SigningBlock({
  identity,
  signatureDataUrl,
}: {
  identity: IdentitySnapshot;
  signatureDataUrl: string;
}) {
  return (
    <View wrap={false} style={{ marginTop: 18 }}>
      <Text style={[styles.body, { marginBottom: 12 }]}>
        DEMIKIAN PERJANJIAN INI dibuat dan ditandatangani oleh Para Pihak
        dalam keadaan sehat jasmani dan rohani, tanpa adanya paksaan dari
        pihak mana pun, pada hari, tanggal, dan tempat sebagaimana tercantum
        pada bagian awal Perjanjian ini.
      </Text>
      <View style={styles.signingBlock}>
        <View style={styles.signingCol}>
          <Text style={styles.signingHeader}>PIHAK PERTAMA</Text>
          <Text style={styles.signingHeader}>PT SATU TUJU EDUCATION</Text>
          <Text style={styles.materai}>(e-Materai Rp 10.000)</Text>
          {RAZAK_SIGNATURE ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={RAZAK_SIGNATURE} style={styles.signatureImg} />
          ) : (
            <View style={styles.signaturePlaceholder} />
          )}
          <Text style={styles.signatureName}>Muhammad Ilham Razak</Text>
          <Text style={styles.signatureSubtitle}>Direktur Utama</Text>
        </View>
        <View style={styles.signingCol}>
          <Text style={styles.signingHeader}>PIHAK KEDUA</Text>
          <Text style={styles.signingHeader}>MENTOR</Text>
          <Text style={styles.materai}>(e-Materai Rp 10.000)</Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={signatureDataUrl} style={styles.signatureImg} />
          <Text style={styles.signatureName}>{identity.fullName}</Text>
          <Text style={styles.signatureSubtitle}> </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Public entry point ──────────────────────────────────────────────────

export type RenderContractPdfArgs = {
  /** Already-interpolated contract body (markdown). */
  interpolatedBody: string;
  identity: IdentitySnapshot;
  signatureDataUrl: string;
  contractNumber: string;
};

export async function renderContractPdf(args: RenderContractPdfArgs): Promise<Buffer> {
  const plainBody = markdownToPlainText(args.interpolatedBody);

  // Split into paragraphs so each Text block is small enough that the
  // layout engine doesn't accumulate floating-point error across a
  // multi-page Text. Empty splits become a thin spacer.
  const paragraphs = plainBody
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>PERJANJIAN KEMITRAAN MENTOR</Text>
        <Text style={styles.subtitle}>SATU TUJU</Text>
        <Text style={styles.contractNumber}>Nomor: {args.contractNumber}</Text>

        {paragraphs.map((para, i) => (
          <Text key={`p-${i}`} style={styles.body}>
            {para}
          </Text>
        ))}

        <SigningBlock
          identity={args.identity}
          signatureDataUrl={args.signatureDataUrl}
        />
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
