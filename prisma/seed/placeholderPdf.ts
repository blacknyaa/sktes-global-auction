/**
 * Builds a small, valid single-page PDF so that every seeded member document
 * can actually be opened from the review screen.
 *
 * Without this the reviewer clicks "書類を開く" and gets nothing, which makes
 * the document-review step impossible to demonstrate. The cross-reference
 * table is written with real byte offsets so the file opens in any viewer.
 */
export function placeholderPdf(lines: string[]): Buffer {
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const text = lines
    .map((line, i) => {
      const size = i === 0 ? 20 : 11;
      const y = 760 - i * 28;
      return `BT /F1 ${size} Tf 60 ${y} Td (${esc(line)}) Tj ET`;
    })
    .join("\n");

  const stream = `${text}\n0.75 w\n60 700 m 535 700 l S\n`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}
