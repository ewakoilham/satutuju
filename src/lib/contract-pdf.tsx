/**
 * Server-side PDF rendering for the Perjanjian Kemitraan Mentor.
 *
 * Walks the marked.js AST of the (already-interpolated) markdown body and
 * emits a single `<Document>` of `<Page>` content via @react-pdf/renderer.
 * Returns a Buffer ready to upload to Supabase Storage.
 *
 * The signature block is rendered last and embeds the captured base64 PNG
 * directly so the PDF is self-contained.
 */

import "server-only";
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

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    lineHeight: 1.45,
    color: "#111827",
  },
  h1: { fontSize: 16, fontFamily: "Times-Bold", marginTop: 18, marginBottom: 6, textAlign: "center" },
  h2: { fontSize: 13, fontFamily: "Times-Bold", marginTop: 14, marginBottom: 6 },
  h3: { fontSize: 11.5, fontFamily: "Times-Bold", marginTop: 10, marginBottom: 4 },
  h4: { fontSize: 11, fontFamily: "Times-Bold", marginTop: 8, marginBottom: 4 },
  p: { marginBottom: 6, textAlign: "justify" },
  listItem: { flexDirection: "row", marginBottom: 4 },
  listMarker: { width: 22 },
  listBody: { flex: 1, textAlign: "justify" },
  hr: { borderBottomWidth: 0.5, borderBottomColor: "#9ca3af", marginVertical: 10 },
  bold: { fontFamily: "Times-Bold" },
  italic: { fontFamily: "Times-Italic" },
  pageNumber: {
    position: "absolute",
    bottom: 28,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 9,
    color: "#6b7280",
  },
  signingBlock: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signingCol: { width: "47%" },
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
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#d1d5db" },
  tableCell: { padding: 4, flex: 1, fontSize: 10 },
  tableCellNum: { padding: 4, width: 50, fontSize: 10, fontFamily: "Times-Bold" },
});

// ─── Inline-token rendering ──────────────────────────────────────────────

type InlineTok = Tokens.Generic;

function renderInline(tokens: InlineTok[] | undefined, key: string): React.ReactNode[] {
  if (!tokens) return [];
  return tokens.map((tok, i) => {
    const k = `${key}-${i}`;
    switch (tok.type) {
      case "text": {
        const t = tok as Tokens.Text;
        // Nested tokens (e.g. text containing **bold**) come through here.
        if (t.tokens && t.tokens.length > 0) {
          return <Text key={k}>{renderInline(t.tokens as InlineTok[], k)}</Text>;
        }
        return <Text key={k}>{decode(t.text)}</Text>;
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
      case "codespan": {
        const t = tok as Tokens.Codespan;
        return (
          <Text key={k} style={styles.italic}>
            {decode(t.text)}
          </Text>
        );
      }
      case "br":
        return <Text key={k}>{"\n"}</Text>;
      case "del": {
        const t = tok as Tokens.Del;
        return <Text key={k}>{renderInline(t.tokens as InlineTok[], k)}</Text>;
      }
      case "link": {
        const t = tok as Tokens.Link;
        return <Text key={k}>{renderInline(t.tokens as InlineTok[], k)}</Text>;
      }
      case "escape": {
        const t = tok as Tokens.Escape;
        return <Text key={k}>{decode(t.text)}</Text>;
      }
      default:
        return null;
    }
  });
}

function decode(s: string): string {
  // marked HTML-encodes inline text (e.g. `&amp;`, `&quot;`) — undo for PDF.
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// ─── Block-token rendering ───────────────────────────────────────────────

function renderBlock(tok: Tokens.Generic, key: string): React.ReactNode {
  switch (tok.type) {
    case "heading": {
      const t = tok as Tokens.Heading;
      const style =
        t.depth === 1 ? styles.h1 :
        t.depth === 2 ? styles.h2 :
        t.depth === 3 ? styles.h3 :
        styles.h4;
      return (
        <Text key={key} style={style}>
          {renderInline(t.tokens as InlineTok[], key)}
        </Text>
      );
    }
    case "paragraph": {
      const t = tok as Tokens.Paragraph;
      return (
        <Text key={key} style={styles.p}>
          {renderInline(t.tokens as InlineTok[], key)}
        </Text>
      );
    }
    case "list": {
      const t = tok as Tokens.List;
      return (
        <View key={key}>
          {t.items.map((item, i) => {
            const marker = t.ordered
              ? `${(t.start as number | "" || 1) + i}.`
              : "•";
            return (
              <View key={`${key}-i${i}`} style={styles.listItem}>
                <Text style={styles.listMarker}>{marker}</Text>
                <View style={styles.listBody}>
                  {(item.tokens as Tokens.Generic[]).map((sub, j) =>
                    renderBlock(sub, `${key}-i${i}-${j}`),
                  )}
                </View>
              </View>
            );
          })}
        </View>
      );
    }
    case "hr":
      return <View key={key} style={styles.hr} />;
    case "table": {
      const t = tok as Tokens.Table;
      // Render header + rows; flexible-width cells. Used for Lampiran A
      // (Sesi | Fokus) and the comparisi block. The comparisi block
      // ("PIHAK PERTAMA / PIHAK KEDUA" final-page table) is replaced by the
      // SigningBlock component, so any remaining table here is curriculum.
      return (
        <View key={key} wrap={false} style={{ marginVertical: 8 }}>
          <View style={[styles.tableRow, { backgroundColor: "#f3f4f6" }]}>
            {t.header.map((cell, i) => (
              <Text
                key={`${key}-h${i}`}
                style={i === 0 ? styles.tableCellNum : styles.tableCell}
              >
                {renderInline(cell.tokens as InlineTok[], `${key}-h${i}`)}
              </Text>
            ))}
          </View>
          {t.rows.map((row, ri) => (
            <View key={`${key}-r${ri}`} style={styles.tableRow}>
              {row.map((cell, ci) => (
                <Text
                  key={`${key}-r${ri}-c${ci}`}
                  style={ci === 0 ? styles.tableCellNum : styles.tableCell}
                >
                  {renderInline(cell.tokens as InlineTok[], `${key}-r${ri}-c${ci}`)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    }
    case "blockquote": {
      const t = tok as Tokens.Blockquote;
      return (
        <View key={key} style={{ marginVertical: 6, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: "#d1d5db" }}>
          {(t.tokens as Tokens.Generic[]).map((sub, j) =>
            renderBlock(sub, `${key}-q${j}`),
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

// ─── Filtering: drop the source-document signing artefacts ───────────────

/**
 * The source markdown ends with a comparison-table-style signing block plus
 * "DEMIKIAN PERJANJIAN INI…" prose. We strip that from the parsed body and
 * emit our own SigningBlock instead so the captured signature image lands
 * in the correct cell.
 */
function dropSourceSigningBlock(tokens: Tokens.Generic[]): Tokens.Generic[] {
  // Find the "DEMIKIAN PERJANJIAN INI" paragraph; everything from there
  // through the end of the comparison table is replaced by our own block.
  // Also strip the final hr that appears just before "DEMIKIAN".
  const idx = tokens.findIndex((tok) => {
    if (tok.type !== "paragraph") return false;
    const p = tok as Tokens.Paragraph;
    return p.raw?.includes("DEMIKIAN PERJANJIAN INI");
  });
  if (idx === -1) return tokens;
  // Walk back over leading hr/space.
  let end = idx;
  while (end > 0 && (tokens[end - 1].type === "hr" || tokens[end - 1].type === "space")) {
    end -= 1;
  }
  // After "DEMIKIAN" we want to keep Lampiran A and Lampiran B (the
  // appendices) but drop the signing comparison table that lives between
  // "DEMIKIAN" and "LAMPIRAN A". Find the next h1 ("LAMPIRAN A").
  let resume = idx + 1;
  while (
    resume < tokens.length &&
    !(tokens[resume].type === "heading" && (tokens[resume] as Tokens.Heading).depth === 1)
  ) {
    resume += 1;
  }
  return [...tokens.slice(0, end), ...tokens.slice(resume)];
}

// ─── Signing block ───────────────────────────────────────────────────────

type SigningBlockProps = {
  identity: IdentitySnapshot;
  signatureDataUrl: string;
};

function SigningBlock({ identity, signatureDataUrl }: SigningBlockProps) {
  return (
    <View wrap={false} style={{ marginTop: 18 }}>
      <Text style={styles.p}>
        <Text style={styles.bold}>DEMIKIAN PERJANJIAN INI </Text>
        dibuat dan ditandatangani oleh Para Pihak dalam keadaan sehat jasmani
        dan rohani, tanpa adanya paksaan dari pihak mana pun, pada hari,
        tanggal, dan tempat sebagaimana tercantum pada bagian awal Perjanjian
        ini.
      </Text>
      <View style={styles.signingBlock}>
        <View style={styles.signingCol}>
          <Text style={styles.signingHeader}>PIHAK PERTAMA</Text>
          <Text style={styles.signingHeader}>PT SATU TUJU EDUCATION</Text>
          <Text style={styles.materai}>(e-Materai Rp 10.000)</Text>
          <View style={styles.signaturePlaceholder} />
          <Text style={styles.signatureName}>Razak [Nama Lengkap]</Text>
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
};

export async function renderContractPdf(args: RenderContractPdfArgs): Promise<Buffer> {
  const tokens = marked.lexer(args.interpolatedBody) as Tokens.Generic[];
  const filtered = dropSourceSigningBlock(tokens);

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        {filtered.map((tok, i) => renderBlock(tok, `b-${i}`))}
        <SigningBlock identity={args.identity} signatureDataUrl={args.signatureDataUrl} />
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );

  // renderToBuffer is the Node-friendly entry point; pdf().toBlob() is
  // browser-oriented and would require extra polyfills on the server.
  return renderToBuffer(doc);
}
