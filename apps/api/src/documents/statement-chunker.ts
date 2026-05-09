export function chunkLines(lines: string[], chunkSize = 80): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < lines.length; index += chunkSize) {
    chunks.push(lines.slice(index, index + chunkSize));
  }
  return chunks;
}
