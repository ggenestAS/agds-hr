// The only client-safe barrel in the workspace (docs/new-project-directives.md
// §9.5): nothing in this package may import DB, IO, or server-only code.
export type { Brand } from "./brand.ts";
// Each id constructor is declaration-merged with its type; one export carries both.
export { UserId, RequestId, AuditEventId, UserRelationshipId, Email } from "./brand.ts";
export { ForbiddenError, NotFoundError, ConflictError, UniqueViolationError } from "./errors.ts";
export type { PolicyDecision } from "./policy.ts";
export { ALLOW, DENY } from "./policy.ts";
export type { UserRole } from "./roles.ts";
export { USER_ROLES, isUserRole } from "./roles.ts";
