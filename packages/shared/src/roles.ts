// Closed role tuple — single source of truth for the TS union, the pg enum
// (identity domain, bootstrap step 5), and Zod schemas at route boundaries.
// `developer` is the platform/ops role, distinct from ordinary staff — see
// docs/new-project-directives.md §6.3. Product roles are added by the domain
// that needs them (docs/CHARTER.md, deferred table).
export const USER_ROLES = ["staff", "developer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const isUserRole = (value: string): value is UserRole =>
  (USER_ROLES as readonly string[]).includes(value);
