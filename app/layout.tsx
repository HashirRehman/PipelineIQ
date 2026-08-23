import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { PaletteApplier } from "@/components/theme/palette-applier";
import { PatternApplier } from "@/components/theme/pattern-applier";
import { ThemeBootstrapScript } from "@/components/theme/theme-bootstrap-script";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

// Display face for titles only (top bar page names, page headers, drawer
// and dialog titles, auth heading). Geometric grotesk with an industrial,
// instrument-like voice — deliberately not used for body text.
//
// Variable font (no weight array): one woff2 covers the 400-700 range the
// UI actually uses, instead of four static weight files — the heading face
// drops from ~4 downloads to 1 (font-display: swap stays on via next/font,
// so text renders instantly and the face upgrades when it lands).
const archivo = Archivo({
  variable: "--font-heading",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PipelineIQ",
  description: "Internal profile placement and BD tracking platform",
};

// Browser-chrome colors (static meta tags — cannot use CSS variables).
// These mirror the theme surfaces in `app/globals.css`: light `--background`
// (white) and dark `--background` (#212121). Keep in sync when re-theming.
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#212121" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The proxy generates a fresh CSP nonce per request and forwards it as
  // x-csp-nonce. It nonces the two intentional inline scripts below (the
  // theme bootstrap and next-themes' theme resolver) so the strict
  // Content-Security-Policy can keep script 'unsafe-inline' off. Absent in
  // dev / direct hits — the scripts then simply render without a nonce.
  const nonce = (await headers()).get("x-csp-nonce") ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${archivo.variable} h-full antialiased bg-background`}
    >
      <body className="min-h-full flex flex-col">
        {/* Re-applies the saved palette/pattern before first paint, like
            next-themes does for dark/light mode — prevents the default-theme
            flash on refresh. */}
        <ThemeBootstrapScript nonce={nonce} />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          nonce={nonce}
        >
          <PaletteApplier />
          <PatternApplier />
          {children}
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
