function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example.`,
    );
  }
  return value;
}

export const env = {
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },
  /** Disposable database used for migration rehearsals. Optional — rehearsals fail cleanly without it. */
  get rehearsalDatabaseUrl(): string | null {
    return process.env.REHEARSAL_DATABASE_URL ?? null;
  },
  /** GitHub App credentials. Optional — check ingestion skips GitHub annotations without them. */
  get githubApp(): { appId: string; privateKey: string } | null {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
    if (!appId || !privateKey) return null;
    return { appId, privateKey: privateKey.replace(/\\n/g, "\n") };
  },
};
