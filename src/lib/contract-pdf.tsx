/**
 * Server-side PDF rendering for the Perjanjian Kemitraan Mentor.
 *
 * Strategy: walk the marked.js AST and emit one `<Text>` per block (heading,
 * paragraph, list item) with proper typography. Bold/italic inline spans get
 * nested `<Text>` with weight overrides. Tables (Lampiran A) use fixed-width
 * Views — no `flex: 1`. Lists indent via `marginLeft` rather than flex rows.
 *
 * Layout pitfalls we deliberately avoid (each one previously triggered
 * PDFKit's "unsupported number: ±1eN" sentinel on this document):
 *  - `flex: 1` inside `flexDirection: "row"` (Yoga negative-width overflow)
 *  - percentage widths inside flex children (`width: "50%"`)
 *  - fixed-position page-number element (renders before final pagination,
 *    which sometimes computes the position via NaN)
 *  - `wrap={false}` on the whole document (we only wrap the signing block)
 *
 * `textAlign: "justify"` was a third pitfall when the whole body was a
 * single multi-page `<Text>` — the advance-width calculation accumulated
 * float error and overflowed. Now that every paragraph is its own short
 * Text, justify renders fine.
 */

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
import { marked, type Tokens } from "marked";
import type { IdentitySnapshot } from "@/lib/contract-template";

// PIHAK PERTAMA's signature is templated onto every contract — loaded
// once at module init. Falls back to a blank placeholder line if the
// asset is missing (fresh checkout, etc).
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
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    lineHeight: 1.5,
    color: "#1f2937",
  },

  // Cover header (rendered once at top of doc).
  docTitle: {
    fontSize: 16,
    fontFamily: "Times-Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  docSubtitle: {
    fontSize: 12,
    fontFamily: "Times-Bold",
    textAlign: "center",
    marginBottom: 8,
  },
  docNumber: {
    fontSize: 10,
    textAlign: "center",
    marginBottom: 22,
    color: "#374151",
  },

  // Body typography
  h1: {
    fontSize: 13,
    fontFamily: "Times-Bold",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 6,
  },
  h2: {
    fontSize: 12,
    fontFamily: "Times-Bold",
    marginTop: 14,
    marginBottom: 4,
  },
  h3: {
    fontSize: 11,
    fontFamily: "Times-Bold",
    marginTop: 10,
    marginBottom: 4,
  },
  h4: {
    fontSize: 10.5,
    fontFamily: "Times-Bold",
    marginTop: 8,
    marginBottom: 3,
  },
  paragraph: {
    marginBottom: 5,
    textAlign: "justify",
  },
  bold: { fontFamily: "Times-Bold" },
  italic: { fontFamily: "Times-Italic" },
  hr: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#d1d5db",
    marginVertical: 12,
  },

  // Lists — margin-based indentation, no flex row. Marker is prefixed
  // inline inside the same Text as the first paragraph.
  listLvl0: { marginLeft: 14, marginBottom: 4 },
  listLvl1: { marginLeft: 28, marginBottom: 3 },
  listLvl2: { marginLeft: 42, marginBottom: 3 },

  // Tables — fixed widths sum to the page content width (A4 595 − 56*2
  // padding = 483pt available; 60 + 423 = 483).
  table: { marginTop: 6, marginBottom: 10 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.4,
    borderBottomColor: "#e5e7eb",
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 0.6,
    borderBottomColor: "#9ca3af",
    backgroundColor: "#f3f4f6",
  },
  tableCellSesi: { width: 60, padding: 5, fontSize: 10 },
  tableCellFokus: { width: 423, padding: 5, fontSize: 10 },
  tableHeader: { fontFamily: "Times-Bold" },

  blockquote: {
    marginLeft: 12,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: "#d1d5db",
    marginVertical: 6,
  },

  // Signing block
  signingBlock: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signingCol: { width: 220 },
  signingHeader: {
    fontFamily: "Times-Bold",
    marginBottom: 4,
    textAlign: "center",
  },
  materai: {
    fontSize: 9,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 26,
  },
  signatureImg: {
    width: 140,
    height: 60,
    marginBottom: 4,
    alignSelf: "center",
  },
  signaturePlaceholder: {
    height: 60,
    borderBottomWidth: 0.5,
    borderBottomColor: "#9ca3af",
    marginBottom: 4,
  },
  signatureName: { textAlign: "center", fontFamily: "Times-Bold" },
  signatureSubtitle: { textAlign: "center", fontSize: 9, color: "#374151" },
});

// ─── Inline-token rendering ──────────────────────────────────────────────

type InlineTok = Tokens.Generic;

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&nbsp;/g, " ");
}

function renderInline(tokens: InlineTok[] | undefined, keyPrefix: string): React.ReactNode[] {
  if (!tokens) return [];
  return tokens.map((tok, i) => {
    const k = `${keyPrefix}-${i}`;
    switch (tok.type) {
      case "text": {
        const t = tok as Tokens.Text;
        if (t.tokens && t.tokens.length > 0) {
          return <Text key={k}>{renderInline(t.tokens as InlineTok[], k)}</Text>;
        }
        return decode(t.text);
      }
      case "strong": {
        const t = tok as Tokens.Strong;
        return (
          <Text key={k} style={styles.bold}>
            {renderInline(t.tokens as InlineTok[], k)}
          </Text>
        );
      }
      case "em": {
        const t = tok as Tokens.Em;
        return (
          <Text key={k} style={styles.italic}>
            {renderInline(t.tokens as InlineTok[], k)}
          </Text>
        );
      }
      case "codespan":
        return (
          <Text key={k} style={styles.italic}>
            {decode((tok as Tokens.Codespan).text)}
          </Text>
        );
      case "br":
        return "\n";
      case "del":
        return (
          <Text key={k}>
            {renderInline((tok as Tokens.Del).tokens as InlineTok[], k)}
          </Text>
        );
      case "link":
        return (
          <Text key={k} style={styles.italic}>
            {renderInline((tok as Tokens.Link).tokens as InlineTok[], k)}
          </Text>
        );
      case "escape":
        return decode((tok as Tokens.Escape).text);
      default:
        return null;
    }
  });
}

// ─── List rendering (margin-based, no flex row) ──────────────────────────

function renderList(list: Tokens.List, key: string, depth: number): React.ReactNode {
  const itemStyle =
    depth === 0 ? styles.listLvl0 : depth === 1 ? styles.listLvl1 : styles.listLvl2;
  return (
    <View key={key}>
      {list.items.map((item, i) => {
        const startNum =
          typeof list.start === "number" && list.start > 0 ? list.start : 1;
        const marker = list.ordered
          ? depth === 1
            ? `${String.fromCharCode(97 + (startNum + i - 1))}.` // a. b. c.
            : `${startNum + i}.`
          : "•";
        const childTokens = (item.tokens as Tokens.Generic[]) ?? [];
        return (
          <View key={`${key}-${i}`} style={itemStyle}>
            {childTokens.map((sub, j) => {
              const subKey = `${key}-${i}-${j}`;
              // First paragraph: prepend marker inline so the bullet sits
              // beside the text instead of on its own line.
              if (j === 0 && (sub.type === "paragraph" || sub.type === "text")) {
                const inlineTokens =
                  (sub as Tokens.Paragraph | Tokens.Text).tokens as InlineTok[];
                return (
                  <Text key={subKey} style={styles.paragraph}>
                    <Text style={styles.bold}>{marker} </Text>
                    {renderInline(inlineTokens, subKey)}
                  </Text>
                );
              }
              if (sub.type === "list") {
                return renderList(sub as Tokens.List, subKey, depth + 1);
              }
              if (sub.type === "paragraph") {
                return (
                  <Text key={subKey} style={styles.paragraph}>
                    {renderInline(
                      (sub as Tokens.Paragraph).tokens as InlineTok[],
                      subKey,
                    )}
                  </Text>
                );
              }
              return null;
            })}
          </View>
        );
      })}
    </View>
  );
}

// ─── Block-token rendering ──────────────────────────────────────────────

function renderBlock(tok: Tokens.Generic, key: string): React.ReactNode {
  switch (tok.type) {
    case "heading": {
      const t = tok as Tokens.Heading;
      const style =
        t.depth === 1
          ? styles.h1
          : t.depth === 2
          ? styles.h2
          : t.depth === 3
          ? styles.h3
          : styles.h4;
      return (
        <Text key={key} style={style}>
          {renderInline(t.tokens as InlineTok[], key)}
        </Text>
      );
    }
    case "paragraph": {
      const t = tok as Tokens.Paragraph;
      return (
        <Text key={key} style={styles.paragraph}>
          {renderInline(t.tokens as InlineTok[], key)}
        </Text>
      );
    }
    case "list":
      return renderList(tok as Tokens.List, key, 0);
    case "hr":
      return <View key={key} style={styles.hr} />;
    case "table":
      return renderTable(tok as Tokens.Table, key);
    case "blockquote": {
      const t = tok as Tokens.Blockquote;
      return (
        <View key={key} style={styles.blockquote}>
          {(t.tokens as Tokens.Generic[]).map((sub, j) =>
            renderBlock(sub, `${key}-${j}`),
          )}
        </View>
      );
    }
    case "space":
      return null;
    default:
      return null;
  }
}

function renderTable(table: Tokens.Table, key: string): React.ReactNode {
  return (
    <View key={key} style={styles.table}>
      <View style={styles.tableHeaderRow}>
        {table.header.map((cell, i) => (
          <Text
            key={`${key}-h${i}`}
            style={[
              i === 0 ? styles.tableCellSesi : styles.tableCellFokus,
              styles.tableHeader,
            ]}
          >
            {renderInline(cell.tokens as InlineTok[], `${key}-h${i}`)}
          </Text>
        ))}
      </View>
      {table.rows.map((row, r) => (
        <View key={`${key}-r${r}`} style={styles.tableRow}>
          {row.map((cell, c) => (
            <Text
              key={`${key}-r${r}-c${c}`}
              style={c === 0 ? styles.tableCellSesi : styles.tableCellFokus}
            >
              {renderInline(cell.tokens as InlineTok[], `${key}-r${r}-c${c}`)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Trim cover + source signing block from the AST ─────────────────────

/**
 * The source markdown opens with H1 "PERJANJIAN KEMITRAAN MENTOR", H2
 * "SATU TUJU", and a number heading we render ourselves as the doc
 * header. It also ends with a "DEMIKIAN PERJANJIAN INI…" prose + a
 * comparison-table signing block which we replace with SigningBlock.
 * Strip both ranges so we don't render them twice.
 */
function stripCoverAndSigning(tokens: Tokens.Generic[]): Tokens.Generic[] {
  let out = tokens.slice();

  // Drop leading H1 + H2 + the "Nomor: …" heading + the first hr/space.
  let leadingEnd = 0;
  let droppedH1 = false;
  let droppedH2 = false;
  let droppedNomor = false;
  while (leadingEnd < out.length) {
    const t = out[leadingEnd];
    if (t.type === "space") {
      leadingEnd += 1;
      continue;
    }
    if (t.type === "heading") {
      const h = t as Tokens.Heading;
      if (h.depth === 1 && !droppedH1) {
        droppedH1 = true;
        leadingEnd += 1;
        continue;
      }
      if (h.depth === 2 && droppedH1 && !droppedH2) {
        droppedH2 = true;
        leadingEnd += 1;
        continue;
      }
    }
    if (t.type === "paragraph") {
      const p = t as Tokens.Paragraph;
      if (
        !droppedNomor &&
        droppedH1 &&
        droppedH2 &&
        /Nomor:\s*[^\n]*ST-MTR/i.test(p.raw ?? "")
      ) {
        droppedNomor = true;
        leadingEnd += 1;
        continue;
      }
    }
    if (t.type === "hr" && (droppedH1 || droppedH2 || droppedNomor)) {
      leadingEnd += 1;
      continue;
    }
    break;
  }
  out = out.slice(leadingEnd);

  // Find "DEMIKIAN PERJANJIAN INI…" → start of LAMPIRAN A header.
  const demikianIdx = out.findIndex((t) => {
    if (t.type !== "paragraph") return false;
    return (t as Tokens.Paragraph).raw?.includes("DEMIKIAN PERJANJIAN INI");
  });
  if (demikianIdx === -1) return out;

  // Walk back over leading hr/space immediately before "DEMIKIAN".
  let cutStart = demikianIdx;
  while (cutStart > 0 && (out[cutStart - 1].type === "hr" || out[cutStart - 1].type === "space")) {
    cutStart -= 1;
  }

  // Resume at the next h1 (LAMPIRAN A) so the appendices are preserved.
  let resume = demikianIdx + 1;
  while (
    resume < out.length &&
    !(out[resume].type === "heading" && (out[resume] as Tokens.Heading).depth === 1)
  ) {
    resume += 1;
  }
  return [...out.slice(0, cutStart), ...out.slice(resume)];
}

// ─── Signing block ───────────────────────────────────────────────────────

function SigningBlock({
  fullName,
  signatureDataUrl,
  pihakKeduaLabel,
}: {
  fullName: string;
  signatureDataUrl: string;
  pihakKeduaLabel: string; // "MENTOR" or "MENTEE"
}) {
  return (
    <View wrap={false} style={{ marginTop: 18 }}>
      <Text style={[styles.paragraph, { marginBottom: 14 }]}>
        <Text style={styles.bold}>DEMIKIAN PERJANJIAN INI</Text> dibuat dan
        ditandatangani oleh Para Pihak dalam keadaan sehat jasmani dan rohani,
        tanpa adanya paksaan dari pihak mana pun, pada hari, tanggal, dan
        tempat sebagaimana tercantum pada bagian awal Perjanjian ini.
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
          <Text style={styles.signingHeader}>{pihakKeduaLabel}</Text>
          <Text style={styles.materai}>(e-Materai Rp 10.000)</Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={signatureDataUrl} style={styles.signatureImg} />
          <Text style={styles.signatureName}>{fullName}</Text>
          <Text style={styles.signatureSubtitle}> </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Public entry point ──────────────────────────────────────────────────

/**
 * Distinguishes the two contract templates that share this renderer.
 * Drives the cover header text and the "PIHAK KEDUA" column label.
 */
export type ContractKind = "mentor" | "mentee";

export type RenderContractPdfArgs = {
  /** Already-interpolated contract body (markdown). */
  interpolatedBody: string;
  identity: IdentitySnapshot | { fullName: string };
  signatureDataUrl: string;
  contractNumber: string;
  /** Phase 18 — defaults to "mentor" for backward compatibility. */
  kind?: ContractKind;
};

const COVER_TITLES: Record<ContractKind, { title: string; pihakKedua: string }> = {
  mentor: { title: "PERJANJIAN KEMITRAAN MENTOR", pihakKedua: "MENTOR" },
  mentee: { title: "PERJANJIAN LAYANAN MENTORING", pihakKedua: "MENTEE" },
};

export async function renderContractPdf(
  args: RenderContractPdfArgs,
): Promise<Buffer> {
  const tokens = marked.lexer(args.interpolatedBody) as Tokens.Generic[];
  const trimmed = stripCoverAndSigning(tokens);
  const kind = args.kind ?? "mentor";
  const { title, pihakKedua } = COVER_TITLES[kind];

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.docTitle}>{title}</Text>
        <Text style={styles.docSubtitle}>SATU TUJU</Text>
        <Text style={styles.docNumber}>Nomor: {args.contractNumber}</Text>

        {trimmed.map((tok, i) => renderBlock(tok, `b-${i}`))}

        <SigningBlock
          fullName={args.identity.fullName}
          signatureDataUrl={args.signatureDataUrl}
          pihakKeduaLabel={pihakKedua}
        />
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
