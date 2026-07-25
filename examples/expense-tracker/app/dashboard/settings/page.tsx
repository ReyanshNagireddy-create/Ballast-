import { getServerSession } from "../../../lib/auth";

export default async function SettingsPage() {
  await getServerSession();

  return (
    <main>
      <h1>Settings</h1>
      <form action="/api/settings" method="post">
        <input name="displayName" type="text" placeholder="Display name" />
        <input name="currency" type="text" placeholder="Currency" />
        <button type="submit">Save</button>
      </form>
    </main>
  );
}
