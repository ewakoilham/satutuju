import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { landingCopy } from "@/lib/landing-copy";

export default function Footer() {
  const t = landingCopy.id.footer;

  const columns: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
    {
      title: t.columns.about,
      links: [
        { label: t.links.aboutUs, href: "/about" },
      ],
    },
    {
      title: t.columns.program,
      links: [
        { label: t.links.mentorship, href: "/signup" },
        { label: "Daftar Universitas", href: "/universities" },
        { label: t.links.community, href: "#" },
      ],
    },
    {
      title: t.columns.help,
      links: [
        { label: t.links.faq, href: "/#faq" },
        { label: t.links.terms, href: "/terms" },
        { label: t.links.privacy, href: "/privacy" },
      ],
    },
  ];

  return (
    <footer className="bg-white border-t border-border relative overflow-hidden">
      {/* Organic gradient blobs */}
      <div
        className="absolute -bottom-20 -right-20 w-[400px] h-[400px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#c6ddef", filter: "blur(120px)", opacity: 0.4 }}
      />
      <div
        className="absolute -top-20 -left-20 w-[350px] h-[350px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#fef3d0", filter: "blur(100px)", opacity: 0.35, animationDelay: "4s", animationDirection: "reverse" }}
      />

      {/* Brand illustrations */}
      <Image
        src="/illustrations/puzzle-group.png"
        alt=""
        width={100}
        height={100}
        className="absolute bottom-16 right-8 opacity-[0.04] pointer-events-none animate-float hidden lg:block"
      />
      <Image
        src="/illustrations/globe.png"
        alt=""
        width={70}
        height={70}
        className="absolute top-12 right-1/3 opacity-[0.04] pointer-events-none animate-float hidden lg:block"
        style={{ animationDelay: "1.5s" }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Image src="/logo-main.png" alt="SatuTuju" width={100} height={67} />
            <p className="mt-4 text-text-muted text-sm leading-relaxed max-w-sm">
              {t.supporting}
            </p>

            {/* Contact */}
            <div className="mt-6 space-y-3">
              <a
                href="#"
                className="flex items-center gap-3 text-sm text-text-muted hover:text-primary transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                  <Icon name="globe" size={16} className="text-primary" />
                </div>
                satutuju.id
              </a>
              <a
                href="#"
                className="flex items-center gap-3 text-sm text-text-muted hover:text-primary transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                  <Icon name="edit" size={16} className="text-primary" />
                </div>
                hello@satutuju.id
              </a>
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="font-bold text-foreground text-sm font-[family-name:var(--font-heading)] mb-4">
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-text-muted hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Tagline + copyright */}
        <div className="mt-10 pt-8 border-t border-border">
          {t.tagline && (
            <p className="text-sm text-foreground font-medium max-w-2xl mb-6">
              {t.tagline}
            </p>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-text-muted-2">{t.copyright}</p>
            <div className="flex items-center gap-3">
              {["globe", "book", "link"].map((icon) => (
                <a
                  key={icon}
                  href="#"
                  className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center text-primary hover:bg-primary-100 transition-colors"
                >
                  <Icon name={icon} size={16} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Brand accent strip */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-primary-400 to-brand-blue-soft" />
    </footer>
  );
}
