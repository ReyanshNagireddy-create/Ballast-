import type { DocBlock } from "@/lib/docs-content";

export function DocBlocks({ blocks }: { blocks: DocBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "h2":
            return (
              <h2
                key={i}
                id={block.id}
                className="pt-4 text-xl font-semibold tracking-tight text-ink"
              >
                {block.text}
              </h2>
            );
          case "p":
            return (
              <p key={i} className="text-[15px] leading-relaxed text-muted">
                {block.text}
              </p>
            );
          case "code":
            return (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-line bg-surface"
              >
                {block.title ? (
                  <p className="border-b border-line px-4 py-2 font-mono text-xs text-faint">
                    {block.title}
                  </p>
                ) : null}
                <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-beacon-bright">
                  <code>{block.text}</code>
                </pre>
              </div>
            );
          case "list":
            return (
              <ul key={i} className="space-y-2 pl-1">
                {block.items.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2.5 text-[15px] leading-relaxed text-muted"
                  >
                    <span className="mt-0.5 text-beacon">–</span>
                    {item}
                  </li>
                ))}
              </ul>
            );
          case "table":
            return (
              <div
                key={i}
                className="overflow-x-auto rounded-xl border border-line"
              >
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-surface">
                    <tr>
                      {block.head.map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 font-medium text-ink"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r} className="border-b border-line last:border-0">
                        {row.map((cell, c) => (
                          <td key={c} className="px-4 py-2.5 text-muted">
                            {c === 0 ? (
                              <code className="font-mono text-beacon-bright">
                                {cell}
                              </code>
                            ) : (
                              cell
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
