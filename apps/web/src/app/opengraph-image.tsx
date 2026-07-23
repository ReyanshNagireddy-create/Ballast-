import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Ballast — Ship schema changes without sinking production";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#060A12",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#0C1220",
              border: "1px solid rgba(45,212,191,0.5)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <div style={{ width: 30, height: 4, background: "#2DD4BF", borderRadius: 2 }} />
            <div style={{ width: 22, height: 4, background: "rgba(45,212,191,0.66)", borderRadius: 2 }} />
            <div style={{ width: 14, height: 4, background: "rgba(45,212,191,0.36)", borderRadius: 2 }} />
          </div>
          <span style={{ color: "#E6EBF4", fontSize: 40, fontWeight: 700 }}>
            Ballast
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <span
            style={{
              color: "#E6EBF4",
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -2,
            }}
          >
            Ship schema changes without sinking production
          </span>
          <span style={{ color: "#8A99B0", fontSize: 32 }}>
            The open-source safety layer for Postgres migrations
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              color: "#2DD4BF",
              fontSize: 26,
              fontFamily: "monospace",
              background: "#0C1220",
              padding: "12px 24px",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.2)",
            }}
          >
            npx @ballast/cli check
          </span>
          <span style={{ color: "#5B6B84", fontSize: 24 }}>ballast.dev</span>
        </div>
      </div>
    ),
    size,
  );
}
