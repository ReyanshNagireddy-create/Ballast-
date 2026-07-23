import { ALL_RULES } from "@ballast/core";
import pc from "picocolors";

export function runRules(color: boolean): string {
  const out: string[] = [];
  out.push(color ? pc.bold("Ballast rules") : "Ballast rules");
  out.push("");
  const idWidth = Math.max(...ALL_RULES.map((r) => r.meta.id.length));
  for (const rule of ALL_RULES) {
    const id = rule.meta.id.padEnd(idWidth);
    const sev = rule.meta.defaultSeverity.padEnd(7);
    const line = `${id}  ${sev}  ${rule.meta.title}`;
    out.push(color ? `${pc.cyan(id)}  ${pc.dim(sev)}  ${rule.meta.title}` : line);
  }
  out.push("");
  out.push(`Docs: https://ballast.dev/docs/rules`);
  return out.join("\n");
}
