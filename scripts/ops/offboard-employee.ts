// Offboard a departed employee: deactivate auth (fail-closed sessions), revoke
// every product role, soft-delete people.employee. Comp and review history stay
// queryable on the retained row. Idempotent — safe to re-run.
//
//   bun --env-file=.env scripts/ops/offboard-employee.ts <email> <last-day-iso>
//   bun --env-file=.env scripts/ops/offboard-employee.ts eneuville@albertschool.com 2026-07-13
import { getDbAs } from "@agds-hr/db";
import { deactivateUser, ensureUserByEmail, listUsers, revokeRole } from "@agds-hr/identity";
import { offboardEmployee } from "@agds-hr/people";
import { RequestId } from "@agds-hr/shared";

const ACTOR_EMAIL = "ggenest@albertschool.com";

const emailArg = process.argv[2]?.toLowerCase();
const lastDay = process.argv[3];

if (emailArg === undefined || lastDay === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(lastDay)) {
  console.error(
    "usage: bun --env-file=.env scripts/ops/offboard-employee.ts <email> <last-day-iso>",
  );
  process.exit(1);
}

const adminDb = getDbAs("admin");
const actorUserId = await ensureUserByEmail(adminDb, ACTOR_EMAIL, "Gregoire Genest");

const users = await listUsers(adminDb, { includeDeactivated: true, limit: 500 });
const target = users.find((user) => user.email.toLowerCase() === emailArg);
if (target === undefined) {
  console.error(JSON.stringify({ ok: false, error: "user_not_found", email: emailArg }, null, 2));
  process.exit(1);
}

const auditContext = (subjectUserId = target.id) => ({
  actorUserId,
  subjectUserId,
  requestId: RequestId(crypto.randomUUID()),
});

const revokedRoles: string[] = [];
for (const role of target.roles) {
  await revokeRole(adminDb, target.id, role, auditContext());
  revokedRoles.push(role);
}

const deactivated =
  target.deactivatedAt === undefined
    ? (await deactivateUser(adminDb, target.id, auditContext()), true)
    : false;

const employeeStatus = await offboardEmployee(adminDb, emailArg, lastDay, auditContext());

console.log(
  JSON.stringify(
    {
      ok: true,
      email: emailArg,
      lastDay,
      userId: target.id,
      deactivated,
      revokedRoles,
      employee: employeeStatus,
      note: "Comp records and review cases are retained; directory roster drops them when Inside marks inactive.",
    },
    null,
    2,
  ),
);
process.exit(0);
