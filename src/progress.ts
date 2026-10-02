/** Terminal progress bar helpers (TTY in-place update vs line logging in pipes). */

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }
  return `${text.slice(0, maxLen - 1)}…`;
}

export function showProgress(current: number, total: number, label: string): void {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const barWidth = 20;
  const filled = total > 0 ? Math.round((current / total) * barWidth) : 0;
  const bar = `${'█'.repeat(filled)}${'░'.repeat(barWidth - filled)}`;
  const line = `[${bar}] ${current}/${total} (${pct}%) ${truncate(label, 40)}`;

  if (process.stdout.isTTY) {
    process.stdout.write(`\r${line.padEnd(Math.max(line.length, 60))}`);
  } else {
    console.log(line);
  }
}

export function finishProgress(message: string): void {
  if (process.stdout.isTTY) {
    process.stdout.write('\r\x1b[K');
  }
  console.log(message);
}
