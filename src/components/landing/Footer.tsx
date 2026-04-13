"use client";

import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/ui/Icon";

const FOOTER_LINKS = {
  "Tentang": [
    { label: "Tentang Kami", href: "#" },
    { label: "Tim Kami", href: "#" },
    { label: "Karir", href: "#" },
  ],
  "Program": [
    { label: "Mentorship", href: "/signup" },
    { label: "Komunitas", href: "#" },
    { label: "Events", href: "#" },
  ],
  "Bantuan & Panduan": [
    { label: "FAQ", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Syarat & Ketentuan", href: "#" },
    { label: "Kebijakan Privasi", href: "#" },
  ],
};

export default function Footer() {
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
              Connecting mentors who have studied abroad with those who dream of doing the same.
              Your journey, guided by experience.
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
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-bold text-foreground text-sm font-[family-name:var(--font-heading)] mb-4">
                {title}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
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

        {/* Social icons */}
        <div className="mt-10 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-text-muted-2">
            © 2026 SatuTuju. Hak cipta dilindungi.
          </p>
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

      {/* Brand accent strip */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-primary-400 to-brand-blue-soft" />
    </footer>
  );
}
