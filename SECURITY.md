# Security Policy

## Reporting a vulnerability

Email **security@ballast.dev**. Please do not open public issues for
vulnerabilities.

You can expect:

- **Acknowledgment within 48 hours**, an assessment within 5 business days.
- Credit in the release notes (unless you prefer anonymity).
- No legal action for good-faith research that respects the scope below.

## Scope

In scope:

- The `@ballast/core` engine and `@ballast/cli` (e.g. malicious SQL input
  causing code execution, path traversal via config/discovery).
- Ballast Cloud: authentication/authorization flaws, tenant isolation, API key
  handling, the rehearsal sandbox.
- The GitHub Action and its input handling.

Out of scope:

- Denial of service via oversized inputs already bounded by documented limits.
- Vulnerabilities exclusively in third-party dependencies (report upstream —
  but tell us too so we can pin/patch).
- Social engineering, physical attacks.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.4.x | ✅ |
| < 0.4 | Critical fixes only |

## Design notes for researchers

- The CLI makes **no network calls** except with the explicit `--upload` flag.
- API keys are stored as SHA-256 hashes; plaintext is shown once at creation.
- Stripe and GitHub webhooks verify signatures before any processing.
- Rehearsals execute user SQL by design — isolation comes from pointing them
  at disposable databases; the docs are explicit that this must never be a
  production connection string. Reports on strengthening this boundary are
  especially welcome.
