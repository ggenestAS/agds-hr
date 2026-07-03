export { REPORTS_TO, LOCAL_REPORTS_TO } from "./types.ts";
export type { DirectoryUser } from "./types.ts";
export type { ListUsersFilter, ReportingLineEdge } from "./dal.ts";
export {
  deactivateUser,
  ensureUserByEmail,
  grantRole,
  hydrateUser,
  listReportingEdges,
  listUsers,
  reactivateUser,
  readActiveImpersonation,
  revokeRole,
  startImpersonation,
  stopImpersonation,
  syncReportingLines,
} from "./dal.ts";
export type { ManagedSets, ManagerEdge } from "./graph.ts";
export { managedUserIds } from "./graph.ts";
export {
  canDeactivateUser,
  canGrantRole,
  canStartImpersonation,
  canUpdateProfile,
} from "./policies.ts";
