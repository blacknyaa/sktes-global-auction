import type { ReactNode } from "react";

export function KumoDivider({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`kumo-divider ${className}`}
      viewBox="0 0 1440 48"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M0 32c80-24 160-24 240 0s160 24 240 0 160-24 240 0 160 24 240 0 160-24 240 0 160 24 240 0V48H0Z"
      />
    </svg>
  );
}

export function CornerMarks({ className = "" }: { className?: string }) {
  return (
    <div className={`wa-corners ${className}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

export function Fuda({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`fuda ${className}`}>{children}</span>;
}

export function KanjiNum({ n }: { n: string }) {
  return (
    <span className="kanji-num" aria-hidden="true">
      {n}
    </span>
  );
}

export function NorenHang({ labels }: { labels?: string[] }) {
  const strips = labels ?? ["封", "印", "入", "札", "公", "正"];
  return (
    <div className="noren-hang" aria-hidden="true">
      {strips.map((s, i) => (
        <span key={`${s}-${i}`} style={{ animationDelay: `${i * 0.14}s` }}>
          {s}
        </span>
      ))}
    </div>
  );
}

export function Crane({ size = 56, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`crane ${className}`}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M32 8 18 28l14 6 14-6Zm0 26L12 30 6 48l26-8 26 8-6-18Zm0 12L22 56h20Z"
      />
    </svg>
  );
}

export function Sensu({ className = "" }: { className?: string }) {
  return (
    <svg className={`sensu ${className}`} viewBox="0 0 120 70" aria-hidden="true">
      <path d="M60 66 8 18a64 64 0 0 1 104 0Z" fill="#fff8f2" stroke="#c9a24a" strokeWidth="1.6" />
      {Array.from({ length: 7 }, (_, i) => (
        <path
          key={i}
          d={`M60 66 L${14 + i * 15.3} ${20 - Math.abs(i - 3) * 1.2}`}
          stroke="#d42b2b"
          strokeWidth="0.7"
          opacity="0.55"
        />
      ))}
    </svg>
  );
}

export function KikuMark({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={`kiku ${className}`}>
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      {Array.from({ length: 8 }, (_, i) => (
        <ellipse
          key={i}
          cx="12"
          cy="5.2"
          rx="1.6"
          ry="3.4"
          fill="currentColor"
          transform={`rotate(${i * 45} 12 12)`}
        />
      ))}
    </svg>
  );
}
