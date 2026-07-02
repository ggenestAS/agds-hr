// Closed role tuple — single source of truth for the TS union, the pg enum
// (identity domain, bootstrap step 5), and Zod schemas at route boundaries.
// `developer` is the platform/ops role, distinct from ordinary staff — see
// docs/new-project-directives.md §6.3. The people domain adds the HR product
// roles (docs/CHARTER.md, deferred table): `manager` runs the assessment,
// `founder` (CEO/COO) signs off decisions, `admin` sets compensation amounts.
// `lt_member` is deferred until the LT peer-input quota lands (it classifies a
// subject rather than granting a permission; pg enum values do not drop cleanly).
export const USER_ROLES = ["staff", "developer", "manager", "founder", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const isUserRole = (value: string): value is UserRole =>
  (USER_ROLES as readonly string[]).includes(value);
