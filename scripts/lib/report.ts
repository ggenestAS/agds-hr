// Shared exit/report helper for scripts/ci gates. Scripts may console.log
// freely (the no-console ban covers the gated application layers only).
export function report(gate: string, errors: readonly string[]): void {
  if (errors.length === 0) {
    console.log(`${gate}: ok`);
    return;
  }
  console.error(`${gate}: ${errors.length} problem(s)`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}
