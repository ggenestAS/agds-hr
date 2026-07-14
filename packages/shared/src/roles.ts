// Closed role tuple — single source of truth for the TS union, the pg enum
// (identity domain, bootstrap step 5), and Zod schemas at route boundaries.
// `developer` is the platform/ops role, distinct from ordinary staff — see
// docs/new-project-directives.md §6.3. The people domain adds the HR product
// roles (docs/CHARTER.md, deferred table): `manager` runs the assessment,
// `founder` (CEO/COO) signs off decisions, `admin` sets compensation amounts.
// `lt_member` classifies leadership-team subjects (mandatory peer-input path,
// calibration/comp visibility) — not a substitute for `manager` or `founder`.
export const USER_ROLES = [
  "staff",
  "developer",
  "manager",
  "founder",
  "admin",
  "lt_member",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const isUserRole = (value: string): value is UserRole =>
  (USER_ROLES as readonly string[]).includes(value);

export const hasLtMemberRole = (roles: readonly UserRole[]): boolean => roles.includes("lt_member");

// Canonical LT roster (Jul 2026). Grants are stored in identity.user_role;
// this tuple is the ops seed source of truth until a self-serve LT registry
// ships. Founders also carry `founder`; most LT managers also carry `manager`.
export const LT_MEMBER_EMAILS = [
  "aantinoro@albertschool.com",
  "alopezestela@albertschool.com",
  "awalus@albertschool.com",
  "eneuville@albertschool.com",
  "ggenest@albertschool.com",
  "lwillems@albertschool.com",
  "mschimpl@albertschool.com",
  "svelasquez@eugeniaschool.com",
  "fbollettini@albertschool.com",
  "mlegoff@albertschool.com",
  "mbianchi@albertschool.com",
  "mmccort@albertschool.com",
] as const;
