"use client";

/**
 * Document Templates library (/dashboard/templates).
 *
 * Surfaces the program templates from `doc-template-library.ts` (files in
 * public/templates/) for download + preview, with a short explainer of what
 * program templates are and how they fit the session flow. Reachable from the
 * Materi "Document Templates" card.
 */

import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { TEMPLATE_GROUPS, FORMAT_META, TEMPLATE_COUNT, type TemplateItem } from "@/data/doc-template-library";

/** Microsoft Office Online viewer — renders xlsx/docx inline from a public URL.
 *  Needs a publicly reachable file, so preview works on the deployed site (not
 *  localhost, where the viewer can't fetch the file). */
function previewUrl(file: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(origin + file)}`;
}

function TemplateCard({ item }: { item: TemplateItem }) {
  const fmt = FORMAT_META[item.format];
  return (
    <div className="tpl-card" id={item.id}>
      <span className={`tpl-tile fmt-${item.format}`}>
        <Icon name={item.icon} size={22} />
      </span>
      <div className="tpl-body">
        <div className="tpl-head">
          <h3 className="tpl-title">{item.title}</h3>
          <span className={`tpl-fmt fmt-${item.format}`}>{fmt.ext}</span>
        </div>
        <div className="tpl-meta">{fmt.label} · Sesi {item.sessionN}</div>
        <p className="tpl-desc">{item.description}</p>
        <div className="tpl-actions">
          <a className="db-btn db-btn-primary sm" href={item.file} download>
            <Icon name="download" size={14} /> Unduh
          </a>
          <a className="db-btn db-btn-outline sm" href={previewUrl(item.file)} target="_blank" rel="noopener noreferrer">
            <Icon name="eye" size={14} /> Pratinjau
          </a>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <div className="tpl-page">
      <Link className="kc-back" href="/dashboard/resources">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        Materi
      </Link>

      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="sesi-crumb">Materi · Template</div>
          <h1 className="sesi-title">Document <span className="lede">Templates.</span></h1>
          <p className="sesi-sub">
            {TEMPLATE_COUNT} template program SatuTuju — tracker, kalender deadline, shortlist kampus, dan kerangka esai. Siap diunduh dan diedit.
          </p>
        </div>
      </div>

      {/* Explainer — why templates are a thing */}
      <div className="tpl-why">
        <div className="tpl-why-ic"><Icon name="lightbulb" size={22} /></div>
        <div className="tpl-why-txt">
          <h4>Kenapa pakai template?</h4>
          <p>
            Template program adalah kerangka siap pakai — biar kamu nggak mulai dari halaman kosong.
            Alurnya simpel: <b>unduh</b> templatenya, <b>isi</b> sesuai kondisimu, lalu <b>unggah lagi</b> di
            sesi terkait biar bisa dibahas bareng mentor. Semua sudah dipakai mentee SatuTuju sebelumnya.
          </p>
          <div className="tpl-steps">
            <span className="tpl-step"><span className="n">1</span> Unduh</span>
            <Icon name="arrow-right" size={13} className="tpl-step-arrow" />
            <span className="tpl-step"><span className="n">2</span> Isi sendiri</span>
            <Icon name="arrow-right" size={13} className="tpl-step-arrow" />
            <span className="tpl-step"><span className="n">3</span> Unggah di sesi</span>
          </div>
        </div>
      </div>

      {/* Template groups */}
      {TEMPLATE_GROUPS.map((g) => (
        <section key={g.id} className="tpl-group">
          <div className="tpl-group-head">
            <h2>{g.title}</h2>
            <span className="tpl-group-blurb">{g.blurb}</span>
          </div>
          <div className="tpl-grid">
            {g.items.map((item) => <TemplateCard key={item.id} item={item} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
