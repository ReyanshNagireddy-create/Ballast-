export function SectionHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow ? (
        <p className="text-sm font-medium uppercase tracking-widest text-beacon">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {lead ? (
        <p className="mt-4 text-base leading-relaxed text-muted">{lead}</p>
      ) : null}
    </div>
  );
}

export function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-6 transition-colors hover:border-beacon/30">
      <h3 className="font-medium text-ink">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}
