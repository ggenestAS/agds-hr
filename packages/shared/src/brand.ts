export type Brand<T, B> = T & { readonly __brand: B };

// One type + same-named constructor per id, declaration-merged. Constructors
// are plain casts (no validation) except Email, which validates and throws —
// see docs/new-project-directives.md §7. IDs for planned-but-unbuilt domains
// are defined here so policies compile today; domains re-export, never
// redefine.
export type UserId = Brand<string, "UserId">;
export const UserId = (s: string): UserId => s as UserId;

export type RequestId = Brand<string, "RequestId">;
export const RequestId = (s: string): RequestId => s as RequestId;

export type AuditEventId = Brand<string, "AuditEventId">;
export const AuditEventId = (s: string): AuditEventId => s as AuditEventId;

export type Email = Brand<string, "Email">;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const Email = (s: string): Email => {
  if (!EMAIL_PATTERN.test(s)) {
    throw new Error(`invalid_email: ${s}`);
  }
  return s as Email;
};
