// Pre-production wipe: delete ALL review-cycle data from the people schema.
// Child rows (self-reviews, peer requests, assessments, comp recs, signoffs,
// appeals) cascade from review_case. Mid-year check-ins are separate rows.
//
//   bun --env-file=.env scripts/ops/purge-review-data.ts
//   bun --env-file=.env scripts/ops/purge-review-data.ts --confirm
//   bun --env-file=.env scripts/ops/purge-review-data.ts --confirm --include-audit
//
// --include-audit removes review-related people-domain audit events via
// DATABASE_URL_MIGRATE (project owner) and the append-only sentinel — employee
// attribute and band-update events are kept.
import { createRequire } from "node:module";

import { sql } from "drizzle-orm";

import { getDbAs } from "@agds-hr/db";
import { readRequired } from "@agds-hr/env";
import { checkIn, reviewCase } from "@agds-hr/people/db/schema";

const confirm = process.argv.includes("--confirm");
const includeAudit = process.argv.includes("--include-audit");
const adminDb = getDbAs("admin");

const AUDIT_PRESERVED = ["people.employee.attributes_set", "people.band.updated"] as const;

async function countReviewTables(): Promise<Record<string, number>> {
  const rows = await adminDb.execute<{ tbl: string; n: string }>(sql`
    SELECT 'review_case' AS tbl, count(*)::int AS n FROM people.review_case
    UNION ALL SELECT 'self_review', count(*) FROM people.self_review
    UNION ALL SELECT 'peer_request', count(*) FROM people.peer_request
    UNION ALL SELECT 'assessment', count(*) FROM people.assessment
    UNION ALL SELECT 'comp_recommendation', count(*) FROM people.comp_recommendation
    UNION ALL SELECT 'appeal', count(*) FROM people.appeal
    UNION ALL SELECT 'review_signoff', count(*) FROM people.review_signoff
    UNION ALL SELECT 'check_in', count(*) FROM people.check_in
  `);
  return Object.fromEntries(rows.map((row) => [row.tbl, Number(row.n)]));
}

async function countReviewAudit(): Promise<number> {
  const rows = await adminDb.execute<{ n: string }>(sql`
    SELECT count(*)::int AS n
    FROM audit.events
    WHERE domain = 'people'
      AND event_type NOT IN (${sql.join(
        AUDIT_PRESERVED.map((eventType) => sql`${eventType}`),
        sql`, `,
      )})
  `);
  return Number(rows[0]?.n ?? 0);
}

async function listCases(): Promise<
  ReadonlyArray<{ id: string; subject: string; cycle: string; state: string }>
> {
  return adminDb
    .select({
      id: reviewCase.id,
      subject: reviewCase.subjectEmail,
      cycle: reviewCase.cyclePeriod,
      state: reviewCase.state,
    })
    .from(reviewCase)
    .orderBy(reviewCase.cyclePeriod, reviewCase.subjectEmail);
}

async function purgeAuditEvents(): Promise<number> {
  const require = createRequire(import.meta.url);
  const postgres = require("../../packages/db/node_modules/postgres/cjs/src/index.js") as (
    url: string,
    options: { max: number },
  ) => {
    begin: <T>(fn: (tx: SqlClient) => Promise<T>) => Promise<T>;
    end: (options: { timeout: number }) => Promise<void>;
  };
  type SqlClient = {
    (strings: TemplateStringsArray, ...values: unknown[]): Promise<{ count: number }>;
    (values: readonly string[]): unknown;
  };
  const url = readRequired("DATABASE_URL_MIGRATE");
  const client = postgres(url, { max: 1 });
  try {
    return await client.begin(async (tx: SqlClient) => {
      await tx`SELECT set_config('agds_hr.allow_audit_reset', '1', true)`;
      const deleted = await tx`
        DELETE FROM audit.events
        WHERE domain = 'people'
          AND event_type NOT IN ${tx(AUDIT_PRESERVED)}
      `;
      return deleted.count;
    });
  } finally {
    await client.end({ timeout: 5 });
  }
}

const before = {
  tables: await countReviewTables(),
  cases: await listCases(),
  auditReviewEvents: includeAudit || !confirm ? await countReviewAudit() : undefined,
};

if (!confirm) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "dry-run",
        before,
        hint: "Re-run with --confirm to delete. Add --include-audit to purge review audit events too.",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const removedCases = await adminDb.delete(reviewCase).returning({
  id: reviewCase.id,
  subject: reviewCase.subjectEmail,
  cycle: reviewCase.cyclePeriod,
});

const removedCheckIns = await adminDb.delete(checkIn).returning({
  id: checkIn.id,
  subject: checkIn.subjectEmail,
  period: checkIn.period,
});

const after = { tables: await countReviewTables() };

let auditRemoved: number | undefined;
if (includeAudit) {
  auditRemoved = await purgeAuditEvents();
}

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: "purged",
      before,
      removed: {
        reviewCases: removedCases,
        checkIns: removedCheckIns,
        auditEvents: auditRemoved,
      },
      after,
    },
    null,
    2,
  ),
);
process.exit(0);
