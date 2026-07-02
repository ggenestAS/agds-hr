// Update events carry a per-field diff as their payload:
// { field: { before, after } } — docs/new-project-directives.md §8.2.
export type FieldDiff = Record<string, { readonly before: unknown; readonly after: unknown }>;

const sameValue = (a: unknown, b: unknown): boolean =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

export function fieldDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldDiff {
  const diff: FieldDiff = {};
  for (const key of Object.keys(after)) {
    if (!sameValue(before[key], after[key])) {
      diff[key] = { before: before[key], after: after[key] };
    }
  }
  return diff;
}
