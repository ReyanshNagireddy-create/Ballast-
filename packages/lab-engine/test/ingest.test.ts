import { describe, expect, it } from "vitest";
import {
  buildProjectModel,
  detectFramework,
  extractAffordances,
  extractForms,
  matchRoute,
  routePathFor,
} from "../src/ingest.js";
import type { SourceFile } from "../src/source.js";
import type { Screen } from "../src/types.js";

const pkg = (deps: Record<string, string>): SourceFile => ({
  path: "package.json",
  text: JSON.stringify({ name: "demo", dependencies: deps }),
});

describe("detectFramework", () => {
  it("recognises the app router", () => {
    const files = [pkg({ next: "^15.0.0" }), { path: "app/page.tsx", text: "export default function P() {}" }];
    expect(detectFramework(files)).toBe("next-app");
  });

  it("recognises the pages router", () => {
    const files = [pkg({ next: "^14.0.0" }), { path: "pages/index.tsx", text: "export default function P() {}" }];
    expect(detectFramework(files)).toBe("next-pages");
  });

  it("falls back to plain react", () => {
    expect(detectFramework([pkg({ react: "^19.0.0" })])).toBe("react");
  });

  it("reports unknown when there is nothing to go on", () => {
    expect(detectFramework([{ path: "readme.md", text: "# hi" }])).toBe("unknown");
  });
});

describe("routePathFor", () => {
  it("maps app-router files to URLs", () => {
    expect(routePathFor("app/page.tsx", "next-app")).toBe("/");
    expect(routePathFor("app/dashboard/page.tsx", "next-app")).toBe("/dashboard");
    expect(routePathFor("src/app/blog/[slug]/page.tsx", "next-app")).toBe("/blog/[slug]");
  });

  it("strips route groups and parallel slots", () => {
    expect(routePathFor("app/(marketing)/pricing/page.tsx", "next-app")).toBe("/pricing");
    expect(routePathFor("app/(app)/@modal/settings/page.tsx", "next-app")).toBe("/settings");
  });

  it("ignores non-page files", () => {
    expect(routePathFor("app/layout.tsx", "next-app")).toBeNull();
    expect(routePathFor("app/api/thing/route.ts", "next-app")).toBeNull();
  });

  it("maps pages-router files, skipping api and _app", () => {
    expect(routePathFor("pages/index.tsx", "next-pages")).toBe("/");
    expect(routePathFor("pages/about.tsx", "next-pages")).toBe("/about");
    expect(routePathFor("pages/_app.tsx", "next-pages")).toBeNull();
  });
});

describe("extractAffordances", () => {
  it("finds links, buttons, and their targets", () => {
    const source = `
      <Link href="/pricing">See pricing</Link>
      <button onClick={save}>Save changes</button>
      <a href="https://example.com">External</a>
    `;
    const found = extractAffordances(source, "/", "app/page.tsx");
    const pricing = found.find((a) => a.label === "See pricing");
    expect(pricing?.kind).toBe("link");
    expect(pricing?.target).toBe("/pricing");

    const save = found.find((a) => a.label === "Save changes");
    expect(save?.kind).toBe("button");
    expect(save?.named).toBe(true);

    // External links are affordances, but they are not navigation inside the app.
    expect(found.find((a) => a.label === "External")?.target).toBeUndefined();
  });

  it("marks icon-only controls and reads their aria-label", () => {
    const source = `<button aria-label="Delete"><TrashIcon /></button>`;
    const [button] = extractAffordances(source, "/", "app/page.tsx");
    expect(button?.iconOnly).toBe(true);
    expect(button?.label).toBe("Delete");
    expect(button?.named).toBe(true);
  });

  it("flags a click handler on a div as keyboard-unreachable", () => {
    const source = `<div onClick={go}>Open</div>`;
    const [control] = extractAffordances(source, "/", "app/page.tsx");
    expect(control?.kind).toBe("button");
    expect(control?.keyboardReachable).toBe(false);
  });

  it("accepts a div that implements keyboard support properly", () => {
    const source = `<div onClick={go} onKeyDown={go} tabIndex={0}>Open</div>`;
    const [control] = extractAffordances(source, "/", "app/page.tsx");
    expect(control?.keyboardReachable).toBe(true);
  });
});

describe("extractForms", () => {
  it("collects fields and notices missing labels", () => {
    const source = `
      <form>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />
        <input name="password" type="password" placeholder="Password" required />
        <input name="csrf" type="hidden" />
        <button type="submit">Sign up</button>
      </form>
    `;
    const [form] = extractForms(source, "/sign-up", "app/sign-up/page.tsx");
    expect(form?.submitLabel).toBe("Sign up");
    expect(form?.fields.map((f) => f.name)).toEqual(["email", "password"]);
    expect(form?.fields.find((f) => f.name === "email")?.labelled).toBe(true);
    expect(form?.fields.find((f) => f.name === "password")?.labelled).toBe(false);
  });
});

describe("matchRoute", () => {
  const screens = new Map<string, Screen>(
    ["/", "/posts/[id]", "/dashboard"].map((path) => [path, { path } as Screen]),
  );

  it("matches exact paths and strips query strings", () => {
    expect(matchRoute("/dashboard", screens)).toBe("/dashboard");
    expect(matchRoute("/dashboard?tab=1", screens)).toBe("/dashboard");
  });

  it("matches concrete hrefs against dynamic segments", () => {
    expect(matchRoute("/posts/42", screens)).toBe("/posts/[id]");
  });

  it("returns undefined for unknown routes", () => {
    expect(matchRoute("/nope", screens)).toBeUndefined();
  });
});

describe("buildProjectModel", () => {
  const files: SourceFile[] = [
    pkg({ next: "^15.0.0", react: "^19.0.0" }),
    {
      path: "app/page.tsx",
      text: `<main><h1>Home</h1><Link href="/sign-up">Get started</Link></main>`,
    },
    {
      path: "app/sign-up/page.tsx",
      text: `
        import { redirect } from "next/navigation";
        export default function P() {
          return <form><label htmlFor="email">Email</label><input id="email" name="email" required /><button type="submit">Join</button></form>;
        }
        async function submit() { redirect("/dashboard"); }
      `,
    },
    {
      path: "app/dashboard/page.tsx",
      text: `import { getServerSession } from "@/lib/auth";\n<h1>Dashboard</h1><img src="/chart.png" />`,
    },
  ];

  it("maps every page to a screen", () => {
    const model = buildProjectModel(files, "Demo");
    expect(model.framework).toBe("next-app");
    expect(model.screens.map((s) => s.path)).toEqual(["/", "/dashboard", "/sign-up"]);
    expect(model.stats.screens).toBe(3);
  });

  it("treats the root as an entry point", () => {
    const model = buildProjectModel(files, "Demo");
    expect(model.screens.find((s) => s.path === "/")?.isEntry).toBe(true);
  });

  it("resolves a redirect into a post-submit target and an edge", () => {
    const model = buildProjectModel(files, "Demo");
    const signUp = model.screens.find((s) => s.path === "/sign-up");
    expect(signUp?.postSubmitTarget).toBe("/dashboard");
    expect(model.edges).toContainEqual(
      expect.objectContaining({ from: "/sign-up", to: "/dashboard", via: "submit" }),
    );
  });

  it("marks an auth-gated screen", () => {
    const model = buildProjectModel(files, "Demo");
    expect(model.screens.find((s) => s.path === "/dashboard")?.authGated).toBe(true);
  });

  it("raises an accessibility signal for an image with no alt", () => {
    const model = buildProjectModel(files, "Demo");
    const signal = model.signals.find((s) => s.id.startsWith("a11y-alt-"));
    expect(signal?.category).toBe("accessibility");
    expect(signal?.file).toBe("app/dashboard/page.tsx");
  });

  it("warns rather than throwing when there are no routes", () => {
    const model = buildProjectModel([pkg({ react: "^19.0.0" })], "Empty");
    expect(model.screens).toEqual([]);
    expect(model.warnings.join(" ")).toMatch(/No page or route files/);
  });

  it("flags a secret-shaped public env var as a security blocker", () => {
    const model = buildProjectModel(
      [...files, { path: "app/lib/client.ts", text: `const k = process.env.NEXT_PUBLIC_API_SECRET;` }],
      "Demo",
    );
    const signal = model.signals.find((s) => s.id.startsWith("sec-env-"));
    expect(signal?.severity).toBe("blocker");
  });
});

describe("screen composition", () => {
  /**
   * The bug these cover: a screen used to see only its own page file, so a form
   * inside <LoginForm /> and a nav bar inside a layout were both invisible —
   * which made every component-driven page look like a dead end.
   */
  const files: SourceFile[] = [
    pkg({ next: "^15.0.0" }),
    { path: "app/layout.tsx", text: `<nav><Link href="/pricing">Pricing</Link></nav>` },
    { path: "app/dashboard/layout.tsx", text: `<aside><Link href="/dashboard/settings">Settings</Link></aside>` },
    { path: "app/dashboard/page.tsx", text: `import { Chart } from "@/app/ui/chart";\n<h1>Dashboard</h1><Chart />` },
    { path: "app/ui/chart.tsx", text: `<button aria-label="Refresh"><Icon /></button>` },
    { path: "app/dashboard/settings/page.tsx", text: `<h1>Settings</h1><Link href="/dashboard">Back</Link>` },
    { path: "app/pricing/page.tsx", text: `<h1>Pricing</h1><Link href="/">Home</Link>` },
    {
      path: "app/login/page.tsx",
      text: `import LoginForm from "@/app/ui/login-form";\n<LoginForm />`,
    },
    {
      path: "app/ui/login-form.tsx",
      text: `import { redirect } from "next/navigation";
        <form><label htmlFor="email">Email</label><input id="email" name="email" required /><button type="submit">Log in</button></form>
        async function go() { redirect("/dashboard"); }`,
    },
  ];

  const model = buildProjectModel(files, "Composed");
  const dashboard = model.screens.find((s) => s.path === "/dashboard")!;
  const login = model.screens.find((s) => s.path === "/login")!;

  it("pulls in the layouts wrapping a page", () => {
    expect(dashboard.sources.map((s) => s.path)).toEqual(
      expect.arrayContaining(["app/layout.tsx", "app/dashboard/layout.tsx"]),
    );
    const labels = dashboard.affordances.map((a) => a.label);
    expect(labels).toContain("Pricing");
    expect(labels).toContain("Settings");
  });

  it("resolves @/ aliases that are not rooted at src/", () => {
    expect(dashboard.sources.map((s) => s.path)).toContain("app/ui/chart.tsx");
    expect(dashboard.affordances.some((a) => a.label === "Refresh")).toBe(true);
  });

  it("attributes each control to the file it is written in, not the page", () => {
    const refresh = dashboard.affordances.find((a) => a.label === "Refresh");
    expect(refresh?.file).toBe("app/ui/chart.tsx");
    const settings = dashboard.affordances.find((a) => a.label === "Settings");
    expect(settings?.file).toBe("app/dashboard/layout.tsx");
  });

  it("finds a form that lives in a rendered component", () => {
    expect(login.forms).toHaveLength(1);
    expect(login.forms[0]?.file).toBe("app/ui/login-form.tsx");
  });

  it("resolves a redirect declared in that component into a post-submit target", () => {
    expect(login.postSubmitTarget).toBe("/dashboard");
  });

  it("does not let one screen pull in an unbounded number of files", () => {
    for (const screen of model.screens) {
      expect(screen.sources.length).toBeLessThanOrEqual(24);
    }
  });
});

describe("multi-app uploads", () => {
  const twoApps: SourceFile[] = [
    pkg({ next: "^15.0.0" }),
    { path: "examples/full/app/page.tsx", text: `<h1>Full</h1><Link href="/about">About</Link>` },
    { path: "examples/full/app/about/page.tsx", text: `<h1>About</h1>` },
    { path: "examples/full/app/contact/page.tsx", text: `<h1>Contact</h1>` },
    { path: "examples/starter/app/page.tsx", text: `<h1>Starter</h1>` },
  ];

  it("analyses the largest app rather than merging routes that never connect", () => {
    const model = buildProjectModel(twoApps, "Two apps");
    expect(model.screens.map((s) => s.file).sort()).toEqual([
      "examples/full/app/about/page.tsx",
      "examples/full/app/contact/page.tsx",
      "examples/full/app/page.tsx",
    ]);
  });

  it("says so in the warnings rather than silently dropping the others", () => {
    const model = buildProjectModel(twoApps, "Two apps");
    expect(model.warnings.join(" ")).toMatch(/2 separate apps/);
    expect(model.warnings.join(" ")).toMatch(/examples\/starter/);
  });

  it("stays quiet for a single-app upload", () => {
    const model = buildProjectModel(
      [pkg({ next: "^15.0.0" }), { path: "app/page.tsx", text: `<h1>Only</h1>` }],
      "One app",
    );
    expect(model.warnings).toEqual([]);
  });
});
