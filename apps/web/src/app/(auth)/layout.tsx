import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-5">
        <Link href="/" aria-label="Ballast home">
          <Logo size={32} />
        </Link>
        {children}
      </div>
    </ClerkProvider>
  );
}
