import type { Metadata } from "next";
import { Geist, Geist_Mono, Poppins, Instrument_Serif } from "next/font/google";
import { ThemeProvider } from "@/lib/theme";
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
  // 500 italic is the signature "lede" line in dashboard greetings + headings;
  // 600/700/800 cover semibold/bold/extrabold. Both styles must be loaded.
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Satu Tuju — Mentorship Platform",
  description: "Connecting mentors who have studied abroad with those who dream of doing the same. Your journey, guided by experience.",
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
      </body>
    </html>
  );
}
