"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { HomeIcon, ListIcon, CogIcon, UsersIcon } from "../icons";

export default function DashboardPage() {
  const session = useSession();

  return (
    <div className="shell">
      {/* Icon-only sidebar. Everyone on the team knows what these mean. */}
      <nav className="sidebar">
        <Link href="/dashboard">
          <HomeIcon />
        </Link>
        <Link href="/dashboard/expenses">
          <ListIcon />
        </Link>
        <Link href="/split">
          <UsersIcon />
        </Link>
        <Link href="/dashboard/settings">
          <CogIcon />
        </Link>
      </nav>

      <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="tile" onClick={() => window.location.assign("/dashboard/expenses")}>
          <span className="amount">£1,284.40</span>
          <span className="label">this month</span>
        </div>

        <button>
          <ListIcon />
        </button>

        <Link href="/dashboard/expenses">See all transactions</Link>
      </motion.main>
    </div>
  );
}

function useSession() {
  return { user: null };
}
