import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI Product Lab — simulate your users before you ship",
    template: "%s · AI Product Lab",
  },
  description:
    "Upload your React or Next.js app and simulate a cohort of AI users with different devices, connections, patience, and accessibility needs. Get the drop-off points, the ranked fixes, and the roadmap — before launch day finds them for you.",
  metadataBase: new URL("https://productlab.local"),
  openGraph: {
    title: "AI Product Lab",
    description: "Simulate a thousand users before a single real one arrives.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-elevated focus:px-4 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
