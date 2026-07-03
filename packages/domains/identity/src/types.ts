import type { UserId, UserRole } from "@agds-hr/shared";

// `kind` on user_relationship is an open vocabulary (dotted/underscored edge
// labels). Inside maintains two reporting lines — both are synced from org-tree.
export const REPORTS_TO = "reports_to";
export const LOCAL_REPORTS_TO = "local_reports_to";

export type DirectoryUser = {
  readonly id: UserId;
  readonly email: string;
  readonly displayName: string | undefined;
  readonly roles: readonly UserRole[];
  readonly deactivatedAt: Date | undefined;
};
