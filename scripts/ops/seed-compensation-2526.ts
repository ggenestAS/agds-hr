// Load FY 2025-26 master compensation (fixed gross + variable target) from the
// HR spreadsheet. Values in the script are whole EUR (spreadsheet figures are
// in thousands). Requires an existing people.employee row per email — run
// sync-inside-directory first if needed.
//
//   bun --env-file=.env scripts/ops/seed-compensation-2526.ts
import { getDbAs } from "@agds-hr/db";
import { ensureUserByEmail } from "@agds-hr/identity";
import { getEmployeeByEmail, recordCompensation } from "@agds-hr/people";
import { RequestId } from "@agds-hr/shared";

const ACTOR_EMAIL = "ggenest@albertschool.com";
const COMP_PERIOD = "2025-26";
// The FY 2025-26 packages take effect at the school-year start.
const EFFECTIVE_DATE = "2025-09-01";

// Spreadsheet source (Jul 2026). `baseK` / `variableK` are thousands of EUR.
const ROWS = [
  { email: "lbartoluci@albertschool.com", baseK: 40, variableK: 5 },
  { email: "lbeaulieu@albertschool.com", baseK: 48, variableK: 0 },
  { email: "bapra@albertschool.com", baseK: 63, variableK: 0 },
  { email: "aarno@albertschool.com", baseK: 34, variableK: 2 },
  { email: "mlegoff@albertschool.com", baseK: 44, variableK: 4 },
  { email: "btiberghien@albertschool.com", baseK: 40, variableK: 3 },
  { email: "sterzoli@albertschool.com", baseK: 35, variableK: 0 },
  { email: "fbollettini@albertschool.com", baseK: 80, variableK: 10 },
  { email: "alopezestela@albertschool.com", baseK: 80, variableK: 10 },
  { email: "mbianchi@albertschool.com", baseK: 110, variableK: 10 },
  { email: "hkoopman@albertschool.com", baseK: 52, variableK: 15 },
  { email: "atremblay@albertschool.com", baseK: 90, variableK: 15 },
  { email: "mmccort@albertschool.com", baseK: 80, variableK: 0 },
  { email: "awalus@albertschool.com", baseK: 70, variableK: 10 },
  { email: "bbernard@albertschool.com", baseK: 39, variableK: 4 },
  { email: "eneuville@albertschool.com", baseK: 84, variableK: 7 },
  { email: "svelasquez@eugeniaschool.com", baseK: 48, variableK: 2 },
  { email: "ggenest@albertschool.com", baseK: 100, variableK: 0 },
  { email: "mschimpl@albertschool.com", baseK: 100, variableK: 0 },
  { email: "aantinoro@albertschool.com", baseK: 90, variableK: 20 },
  { email: "lwillems@albertschool.com", baseK: 80, variableK: 0 },
] as const;

const adminDb = getDbAs("admin");
const actorUserId = await ensureUserByEmail(adminDb, ACTOR_EMAIL, "Gregoire Genest");

const updated: string[] = [];
const skipped: { readonly email: string; readonly reason: string }[] = [];

for (const row of ROWS) {
  const email = row.email.toLowerCase();
  const employee = await getEmployeeByEmail(adminDb, email);
  if (employee === undefined) {
    skipped.push({ email, reason: "no_employee_row" });
    continue;
  }
  await recordCompensation(
    adminDb,
    email,
    {
      effectiveDate: EFFECTIVE_DATE,
      compPeriod: COMP_PERIOD,
      baseSalaryEur: row.baseK * 1000,
      variableTargetEur: row.variableK * 1000,
    },
    {
      actorUserId,
      subjectUserId: actorUserId,
      requestId: RequestId(crypto.randomUUID()),
    },
  );
  updated.push(email);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      compPeriod: COMP_PERIOD,
      updated,
      skipped,
      note: "Spreadsheet rows without emails or empty amounts (Berthou, Malagammana, Chedozeau) were not loaded. Eneuville left 2026-07-13; comp is the pre-departure FY 2025-26 package.",
    },
    null,
    2,
  ),
);
// The admin pool keeps the process alive after the work is done — exit explicitly.
process.exit(0);
