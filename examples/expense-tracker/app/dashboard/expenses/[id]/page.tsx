import Link from "next/link";

export default function ExpenseDetailPage() {
  return (
    <main>
      <h1>Transaction</h1>
      <dl>
        <dt>Merchant</dt>
        <dd>Sainsbury's</dd>
        <dt>Amount</dt>
        <dd>£42.10</dd>
      </dl>
      <Link href="/dashboard/expenses">Back to transactions</Link>
    </main>
  );
}
