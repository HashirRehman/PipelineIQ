import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Inter, JetBrains_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "PipelineIQ",
    template: "%s — PipelineIQ",
  },
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased bg-background`}
    >
      <body className="min-h-full flex flex-col">
        {/* Re-applies the saved palette/pattern before first paint, like
            next-themes does for dark/light mode — prevents the default-theme
            flash on refresh. */}
        <ThemeBootstrapScript />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <PaletteApplier />
          <PatternApplier />
          {children}
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
