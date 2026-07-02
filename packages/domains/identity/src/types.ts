import type { UserId, UserRole } from "@agds-hr/shared";

// `kind` on user_relationship is an open vocabulary (dotted/underscored edge
// labels); this is the manager-graph edge the session hydration reads.
export const REPORTS_TO = "reports_to";

export type DirectoryUser = {
  readonly id: UserId;
  readonly email: string;
  readonly displayName: string | undefined;
  readonly roles: readonly UserRole[];
  readonly deactivatedAt: Date | undefined;
};
