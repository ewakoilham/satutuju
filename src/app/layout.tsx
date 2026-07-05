import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Poppins, Instrument_Serif } from "next/font/google";
import { ThemeProvider } from "@/lib/theme";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  // Heading usage in this codebase is exclusively font-semibold (600),
  // font-bold (700), and font-extrabold (800) — verified by grep across
  // every var(--font-heading) site. Weight 400 was unused and dropped
  // to save ~25 KB of font payload.
  weight: ["600", "700", "800"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  applicationName: "Satu Tuju",
  title: "Satu Tuju — Mentorship Platform",
  description: "Connecting mentors who have studied abroad with those who dream of doing the same. Your journey, guided by experience.",
  // PWA: Next auto-links the manifest (app/manifest.ts) + icon/apple-icon.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Satu Tuju",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3958b3",
};

/* Inline script that runs before React to prevent dark-mode flash (FOUC) */
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} ${instrumentSerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
