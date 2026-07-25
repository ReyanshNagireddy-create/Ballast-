export async function getServerSession(): Promise<{ userId: string } | null> {
  return { userId: "demo-user" };
}
