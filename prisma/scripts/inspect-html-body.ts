/**
 * Diagnostic — render exact HTML that sendLeadEmail() posts to Resend
 * for a given lead, locally (no Resend call, no server-only imports).
 *
 *   npx tsx prisma/scripts/inspect-html-body.ts [leadId]
 *
 * Verifies the HTML is well-formed enough for Resend's open-tracking
 * pixel injection (which happens before `</body>`).
 */

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env" });

import { createClient } from "@supabase/supabase-js";

const TEMPLATE_BUCKET_FOR_LEAD_BUCKET: Record<string, string> = {
  A: "A_B_C", B: "A_B_C", C: "A_B_C",
  D: "D",
  incomplete: "incomplete",
  domestic: "domestic",
};

function fundingPlanLabel(plan: string): string {
  if (plan === "scholarship") return "Full scholarship";
  if (plan === "self_funded") return "Self-funded";
  if (plan === "partial") return "Partial scholarship";
  return plan;
}

function substitute(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => tokens[k] ?? "");
}

function plainTextToHtml(text: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const links: string[] = [];
  const withTokens = text.replace(/https?:\/\/[^\s<>]+/g, (url) => {
    const i = links.push(url) - 1;
    return ` LINK${i} `;
  });
  let escaped = escape(withTokens);
  escaped = escaped.replace(/ LINK(\d+) /g, (_, i) => {
    const url = links[parseInt(i, 10)];
    return `<a href="${url}" style="color:#1e3a5f;text-decoration:underline;">${url}</a>`;
  });
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => `<p style="margin:0 0 1em 0;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  return `<!DOCTYPE html>
<html lang="id">
<body style="margin:0;padding:0;background:#ffffff;">
  <div style="max-width:560px;margin:0 auto;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;">
    ${paragraphs}
  </div>
</body>
</html>`;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key);

  const leadId = process.argv[2] || "ld_demo_a";

  const { data: lead, error } = await supabase
    .from("Lead")
    .select("id, name, email, bucket, targetCampusAndProgram, fundingPlan")
    .eq("id", leadId)
    .single();
  if (error || !lead) {
    console.error("✗ Lead not found:", error?.message);
    process.exit(1);
  }

  const templateBucket = TEMPLATE_BUCKET_FOR_LEAD_BUCKET[lead.bucket];
  if (!templateBucket) {
    console.error("✗ No template for bucket:", lead.bucket);
    process.exit(1);
  }

  const { data: template } = await supabase
    .from("LeadEmailTemplate")
    .select("subject, body")
    .eq("bucket", templateBucket)
    .single();
  if (!template) {
    console.error("✗ Template not found:", templateBucket);
    process.exit(1);
  }

  const tokens: Record<string, string> = {
    name: lead.name,
    campusJurusan: lead.targetCampusAndProgram || "(belum diisi)",
    fundingPlan: fundingPlanLabel(lead.fundingPlan),
  };
  const subject = substitute(template.subject, tokens);
  const body = substitute(template.body, tokens);
  const html = plainTextToHtml(body);

  console.log(`=== Lead: ${lead.name} <${lead.email}> bucket=${lead.bucket} → tpl=${templateBucket} ===\n`);
  console.log("=== SUBJECT ===");
  console.log(subject);
  console.log("\n=== TEXT BODY (first 300 chars) ===");
  console.log(body.slice(0, 300) + "…\n");

  console.log("=== HTML BODY ===\n");
  console.log(html);
  console.log("\n=== HTML BODY END ===\n");

  console.log("=== STRUCTURAL CHECKS ===");
  const hasDoctype = html.toLowerCase().includes("<!doctype");
  const hasHtmlTag = /<html[\s>]/i.test(html);
  const hasBodyOpen = /<body[\s>]/i.test(html);
  const hasBodyClose = /<\/body>/i.test(html);
  const anchorCount = (html.match(/<a href=/gi) ?? []).length;
  const checks: Array<[string, boolean]> = [
    ["DOCTYPE", hasDoctype],
    ["<html>", hasHtmlTag],
    ["<body>", hasBodyOpen],
    ["</body>", hasBodyClose],
  ];
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${name}`);
  }
  console.log(`  ℹ ${anchorCount} clickable links in body`);
  console.log(`  ℹ HTML total length: ${html.length} chars`);
  console.log("");
  console.log("→ If all ✓ but Resend still doesn't fire 'opened', the");
  console.log("  pixel is being injected but blocked at recipient client.");
  console.log("  Verify in Gmail: open email → ⋮ → 'Show original' →");
  console.log("  search for 'r.resend' or '<img src=' near bottom.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
