// Grant the canonical LT roster the `lt_member` product role. Idempotent —
// skips emails that already carry the grant. Provisions auth.user rows via
// ensureUserByEmail when needed (eneuville may not be in Inside's active roster).
//
//   bun --env-file=.env scripts/ops/grant-lt-members.ts
import { getDbAs } from "@agds-hr/db";
import { ensureUserByEmail, grantRole, listUsers } from "@agds-hr/identity";
import { isInsideConfigured, listAdminDirectory } from "@agds-hr/inside";
import { LT_MEMBER_EMAILS, RequestId } from "@agds-hr/shared";

const ACTOR_EMAIL = "ggenest@albertschool.com";

const adminDb = getDbAs("admin");
const actorUserId = await ensureUserByEmail(adminDb, ACTOR_EMAIL, "Gregoire Genest");
const auditContext = () => ({
  actorUserId,
  subjectUserId: actorUserId,
  requestId: RequestId(crypto.randomUUID()),
});

const admins = isInsideConfigured() ? await listAdminDirectory({ limit: 1000 }) : [];
const nameByEmail = new Map(
  admins.map((admin) => [admin.email.toLowerCase(), `${admin.firstName} ${admin.lastName}`.trim()]),
);

const existing = await listUsers(adminDb, { limit: 500 });
const rolesByEmail = new Map(existing.map((user) => [user.email.toLowerCase(), user.roles]));

const granted: string[] = [];
const skipped: string[] = [];

for (const email of LT_MEMBER_EMAILS) {
  const normalized = email.toLowerCase();
  if (rolesByEmail.get(normalized)?.includes("lt_member")) {
    skipped.push(normalized);
    continue;
  }
  const displayName = nameByEmail.get(normalized) ?? normalized.split("@")[0] ?? normalized;
  const userId = await ensureUserByEmail(adminDb, normalized, displayName);
  await grantRole(adminDb, userId, "lt_member", {
    ...auditContext(),
    subjectUserId: userId,
  });
  granted.push(normalized);
}

console.log(JSON.stringify({ ok: true, granted, skipped }, null, 2));
