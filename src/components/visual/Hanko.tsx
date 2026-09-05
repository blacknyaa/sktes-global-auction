export function Hanko({
  label = "封印",
  size = 104,
  className = "",
}: {
  label?: string;
  size?: number;
  className?: string;
}) {
  const chars = label.slice(0, 4).split("");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`hanko ${className}`}
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="47" fill="none" stroke="#c23a2b" strokeWidth="3.4" />
      <circle cx="50" cy="50" r="41" fill="none" stroke="#c23a2b" strokeWidth="1.1" />
      {chars.length === 1 && (
        <text
          x="50"
          y="66"
          textAnchor="middle"
          fill="#c23a2b"
          fontFamily='"Shippori Mincho", "Noto Serif JP", serif'
          fontWeight="700"
          fontSize="40"
        >
          {chars[0]}
        </text>
      )}
      {chars.length === 2 && (
        <>
          <text x="50" y="44" textAnchor="middle" fill="#c23a2b" fontFamily='"Shippori Mincho", "Noto Serif JP", serif' fontWeight="700" fontSize="30">
            {chars[0]}
          </text>
          <text x="50" y="76" textAnchor="middle" fill="#c23a2b" fontFamily='"Shippori Mincho", "Noto Serif JP", serif' fontWeight="700" fontSize="30">
            {chars[1]}
          </text>
        </>
      )}
      {chars.length >= 3 &&
        chars.map((c, i) => (
          <text
            key={`${c}-${i}`}
            x={chars.length === 4 ? (i % 2 === 0 ? 35 : 65) : 50}
            y={chars.length === 4 ? (i < 2 ? 42 : 74) : 30 + i * 20}
            textAnchor="middle"
            fill="#c23a2b"
            fontFamily='"Shippori Mincho", "Noto Serif JP", serif'
            fontWeight="700"
            fontSize={chars.length === 4 ? 24 : 20}
          >
            {c}
          </text>
        ))}
    </svg>
  );
}

export function Tategaki({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return (
    <span className={`tategaki ${className}`} aria-hidden="true">
      {children}
    </span>
  );
}
