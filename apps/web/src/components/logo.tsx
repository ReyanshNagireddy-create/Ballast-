export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="#0C1220" />
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="7.5"
        stroke="url(#lg)"
        strokeOpacity="0.5"
      />
      {/* Keel lines: a ship's ballast keeping the hull steady. */}
      <path
        d="M7 12h18"
        stroke="#2DD4BF"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M9.5 17h13"
        stroke="#2DD4BF"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.66"
      />
      <path
        d="M12 22h8"
        stroke="#2DD4BF"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.36"
      />
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#2DD4BF" />
          <stop offset="1" stopColor="#818CF8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="text-lg font-semibold tracking-tight text-ink">
        Ballast
      </span>
    </span>
  );
}
