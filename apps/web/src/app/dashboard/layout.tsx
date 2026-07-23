import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata = { title: "Dashboard" };

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <div className="min-h-screen">
        <header className="border-b border-line bg-surface/50">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
            <div className="flex items-center gap-6">
              <Link href="/" aria-label="Ballast home">
                <Logo size={24} />
              </Link>
              <nav className="flex items-center gap-4 text-sm text-muted">
                <Link href="/dashboard" className="transition-colors hover:text-ink">
                  Projects
                </Link>
                <Link
                  href="/dashboard/billing"
                  className="transition-colors hover:text-ink"
                >
                  Billing
                </Link>
                <Link href="/docs" className="transition-colors hover:text-ink">
                  Docs
                </Link>
              </nav>
            </div>
            <UserButton />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>
      </div>
    </ClerkProvider>
  );
}
