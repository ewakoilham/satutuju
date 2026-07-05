import type { MetadataRoute } from "next";

/**
 * Web App Manifest (PWA). Next.js auto-links this at <link rel="manifest">
 * and serves it at /manifest.webmanifest. Icons live in public/icons and are
 * generated from public/logo-circle.png. theme_color matches the brand
 * primary (--primary: #3958b3).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Satu Tuju — Mentorship Platform",
    short_name: "Satu Tuju",
    description:
      "Terhubung dengan mentor yang telah menempuh studi di luar negeri. Perjalananmu, dibimbing pengalaman.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#3958b3",
    lang: "id",
    dir: "ltr",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
