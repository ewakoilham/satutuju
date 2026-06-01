"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import * as AllFlags from "country-flag-icons/react/3x2";
import Icon from "@/components/ui/Icon";

const COUNTRY_CODES: Record<string, string> = {
  Australia: "AU", Austria: "AT", Belgium: "BE", Canada: "CA",
  China: "CN", Croatia: "HR", Cyprus: "CY", "Czech Republic": "CZ",
  Finland: "FI", France: "FR", Georgia: "GE", Germany: "DE",
  Greece: "GR", Grenada: "GD", "Hong Kong": "HK", Hungary: "HU",
  India: "IN", Indonesia: "ID", Ireland: "IE", Italy: "IT",
  Japan: "JP", Kazakhstan: "KZ", Latvia: "LV", Lithuania: "LT",
  Malaysia: "MY", Malta: "MT", Mauritius: "MU", Monaco: "MC",
  Netherlands: "NL", "New Zealand": "NZ", Philippines: "PH",
  Poland: "PL", Portugal: "PT", Romania: "RO", Russia: "RU",
  Singapore: "SG", "South Korea": "KR", Spain: "ES", "Sri Lanka": "LK",
  Sweden: "SE", Switzerland: "CH", Thailand: "TH", Turkey: "TR",
  UAE: "AE", UK: "GB", USA: "US", Vietnam: "VN",
};

function FlagIcon({ code }: { code: string }) {
  const Flag = (AllFlags as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>)[code];
  if (!Flag) return null;
  return <Flag style={{ width: 28, height: "auto", borderRadius: 3 }} />;
}

const DEGREE_LABEL: Record<string, string> = {
  Undergraduate: "Undergraduate / Bachelor",
  Graduate: "Postgraduate / Master",
  "English Language": "English Language",
  "English Language / Foundation": "English / Foundation",
  "Summer Programs": "Summer Programs",
  All: "Semua jenjang",
};

interface University {
  id: number;
  name: string;
  country: string;
  degreeLevel: string;
  website: string;
  programs?: string;
}

export default function UniversitiesComparePage() {
  const [unis, setUnis] = useState<University[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Pull the comparison set from the previous page. We use sessionStorage so
  // the back-navigation experience is "snap, list still selected" without
  // putting university IDs in the URL (3.5k-row directory has no slugs).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("kampus-compare");
      if (raw) {
        const parsed: University[] = JSON.parse(raw);
        setUnis(parsed.slice(0, 4));
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  // Empty state: user landed here without anything to compare.
  if (unis.length === 0) {
    return (
      <>
        <div className="page-head" style={{ marginBottom: 8 }}>
          <div>
            <div className="sesi-crumb">
              <Link href="/dashboard/universities">Kampus</Link>
              {" › "}
              <span style={{ color: "var(--text-muted)" }}>Bandingkan</span>
            </div>
            <h1 className="sesi-title">
              Bandingkan <span className="lede">— belum ada pilihan.</span>
            </h1>
            <p className="sesi-sub">
              Pilih sampai 4 kampus dari direktori, lalu klik <b>Bandingkan</b> di bilah bawah untuk melihatnya berdampingan di sini.
            </p>
          </div>
        </div>
        <div className="cal-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          <Icon name="search" size={28} />
          <p style={{ marginTop: 12 }}>Belum ada kampus yang dipilih untuk dibandingkan.</p>
          <Link
            href="/dashboard/universities"
            className="db-btn db-btn-primary sm"
            style={{ marginTop: 16 }}
          >
            ← Kembali ke direktori
          </Link>
        </div>
      </>
    );
  }

  // The grid uses 1 label column + N university columns. We pad the columns
  // out to 4 visually if fewer were picked so the table stays balanced.
  const cols = unis.length;
  const fields: Array<{
    label: string;
    render: (u: University) => React.ReactNode;
  }> = [
    {
      label: "Negara",
      render: (u) => {
        const code = COUNTRY_CODES[u.country];
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {code && <FlagIcon code={code} />}
            <span>{u.country}</span>
          </div>
        );
      },
    },
    {
      label: "Jenjang",
      render: (u) => DEGREE_LABEL[u.degreeLevel] || u.degreeLevel || "—",
    },
    {
      label: "Programs",
      render: (u) =>
        u.programs && u.programs.length > 0
          ? <span style={{ fontSize: 13, color: "var(--text-muted-3)", lineHeight: 1.4 }}>{u.programs}</span>
          : <em style={{ color: "var(--text-muted-2)" }}>Lihat website</em>,
    },
    {
      label: "Website",
      render: (u) =>
        u.website ? (
          <a
            href={u.website}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--primary-700)", fontFamily: "var(--font-geist-mono)", fontSize: 12, wordBreak: "break-all" }}
          >
            {u.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </a>
        ) : "—",
    },
  ];

  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="sesi-crumb">
            <Link href="/dashboard/universities">Kampus</Link>
            {" › "}
            <span style={{ color: "var(--text-muted)" }}>Bandingkan</span>
          </div>
          <h1 className="sesi-title">
            Bandingkan <span className="lede">— {cols} kampus side-by-side.</span>
          </h1>
          <p className="sesi-sub">
            Catatan: hanya field yang sudah ada di direktori yang muncul. Biaya, deadline, dan IELTS akan tersedia setelah skema kampus diperluas.
          </p>
        </div>
        <Link href="/dashboard/universities" className="db-btn db-btn-outline sm">
          ← Kembali ke direktori
        </Link>
      </div>

      <div
        className="cal-card"
        style={{
          padding: 0,
          overflowX: "auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `160px repeat(${cols}, minmax(220px, 1fr))`,
            minWidth: 160 + cols * 240,
          }}
        >
          {/* Header row: corner cell + uni names + flags */}
          <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)" }} />
          {unis.map((u) => {
            const code = COUNTRY_CODES[u.country];
            return (
              <div
                key={u.id}
                style={{
                  padding: "18px 20px",
                  borderBottom: "1px solid var(--border)",
                  borderLeft: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div
                    className="uni-flag"
                    style={{ width: 36, height: 36, borderRadius: 8 }}
                    title={u.country}
                  >
                    {code ? <FlagIcon code={code} /> : "🌐"}
                  </div>
                  <span style={{
                    fontFamily: "var(--font-poppins)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-muted-3)",
                  }}>
                    {u.country.toUpperCase()}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-poppins)",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--primary-900)",
                    lineHeight: 1.2,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {u.name}
                </div>
              </div>
            );
          })}

          {/* Field rows */}
          {fields.map((f) => (
            <React.Fragment key={f.label}>
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #ecf1f5",
                  fontFamily: "var(--font-poppins)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-muted-3)",
                  background: "var(--primary-50)",
                }}
              >
                {f.label}
              </div>
              {unis.map((u) => (
                <div
                  key={`${f.label}-${u.id}`}
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid #ecf1f5",
                    borderLeft: "1px solid var(--border)",
                    fontSize: 14,
                    color: "var(--foreground)",
                  }}
                >
                  {f.render(u)}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button
          type="button"
          className="db-btn db-btn-ghost sm"
          onClick={() => {
            try {
              sessionStorage.removeItem("kampus-compare");
            } catch { /* ignore */ }
            setUnis([]);
          }}
        >
          Kosongkan
        </button>
        <Link href="/dashboard/universities" className="db-btn db-btn-outline sm">
          Pilih kampus lain
        </Link>
      </div>
    </>
  );
}
