import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  CHECK_IN_STATUSES,
  CHECK_IN_STATUS_LABELS,
  CHECK_IN_SUMMARY_MIN_WORDS,
  checkInSubmitIssues,
} from "@agds-hr/people/types";
import type { CheckInStatus } from "@agds-hr/people/types";
import { useState } from "react";

import { TwoColumnRoutePending } from "../components/route-pending/shapes.tsx";
import { Button } from "../components/ui/button.tsx";
import { Card, CardContent } from "../components/ui/card.tsx";
import type { CheckInView, MidYearRow, MidYearView } from "../server/people.shared.ts";
import { checkInSaveFn, checkInSubmitFn, midYearFn } from "../server/people.functions.ts";
import { countWords } from "../server/people.shared.ts";

// The mid-year check-in surface (docs/plans/mid-year.md): managers file the
// written output of the January conversation — status, the one-paragraph
// summary, master-record verification, and promotion / underperformance flags.
// Filing is open January 1–31 only (Europe/Paris); filed records stay visible.
export const Route = createFileRoute("/_app/mid-year")({
  loader: () => midYearFn(),
  pendingComponent: () => <TwoColumnRoutePending width="5xl" />,
  component: MidYearPage,
});

type FormState = {
  readonly status: CheckInStatus | undefined;
  readonly summary: string;
  readonly p1Confirmed: boolean;
  readonly p1Note: string;
  readonly promoFlag: boolean;
  readonly promoNote: string;
  readonly underperfFlag: boolean;
  readonly underperfNote: string;
};

const emptyForm: FormState = {
  status: undefined,
  summary: "",
  p1Confirmed: false,
  p1Note: "",
  promoFlag: false,
  promoNote: "",
  underperfFlag: false,
  underperfNote: "",
};

const fromView = (view: CheckInView | undefined): FormState =>
  view === undefined
    ? emptyForm
    : {
        status: view.status,
        summary: view.summary,
        p1Confirmed: view.p1Confirmed,
        p1Note: view.p1Note,
        promoFlag: view.promoFlag,
        promoNote: view.promoNote,
        underperfFlag: view.underperfFlag,
        underperfNote: view.underperfNote,
      };

const fieldCls = "block w-full rounded-[10px] border border-border bg-card px-3 py-2 text-sm";

function FiledRecord({ checkIn }: { checkIn: CheckInView }) {
  return (
    <div className="space-y-3 px-6 pb-5 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {checkIn.status !== undefined && (
          <span
            className={
              checkIn.status === "on_track"
                ? "rounded-full bg-[var(--color-success-surface)] px-2.5 py-0.5 font-bold text-[var(--color-success)]"
                : "rounded-full bg-[var(--color-accent-tint-surface)] px-2.5 py-0.5 font-bold text-[var(--color-accent-tint-text)]"
            }
          >
            {CHECK_IN_STATUS_LABELS[checkIn.status]}
          </span>
        )}
        {checkIn.promoFlag && (
          <span className="rounded-full bg-[var(--color-blush)] px-2.5 py-0.5 font-bold text-[var(--color-accent-tint-text)]">
            Promotion candidate
          </span>
        )}
        {checkIn.underperfFlag && (
          <span className="rounded-full bg-[var(--color-accent-tint-surface)] px-2.5 py-0.5 font-bold text-[var(--color-accent-tint-text)]">
            Underperformance flagged
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          filed{" "}
          {checkIn.submittedAt !== undefined && new Date(checkIn.submittedAt).toLocaleDateString()}
          {checkIn.authorEmail !== undefined && ` by ${checkIn.authorEmail}`}
        </span>
      </div>
      <p className="whitespace-pre-wrap leading-relaxed">{checkIn.summary}</p>
      {!checkIn.p1Confirmed && checkIn.p1Note !== "" && (
        <p className="text-xs text-muted-foreground">
          <span className="font-bold">Role/level/scope changed:</span> {checkIn.p1Note}
        </p>
      )}
      {checkIn.promoFlag && checkIn.promoNote !== "" && (
        <p className="text-xs text-muted-foreground">
          <span className="font-bold">Promotion rationale:</span> {checkIn.promoNote}
        </p>
      )}
      {checkIn.underperfFlag && checkIn.underperfNote !== "" && (
        <p className="text-xs text-muted-foreground">
          <span className="font-bold">Performance gap:</span> {checkIn.underperfNote}
        </p>
      )}
    </div>
  );
}

function CheckInForm({ row, onDone }: { row: MidYearRow; onDone: () => Promise<void> }) {
  const [form, setForm] = useState<FormState>(fromView(row.checkIn));
  const [busy, setBusy] = useState(false);
  const issues = checkInSubmitIssues(form);
  const words = countWords(form.summary);

  const payload = { subjectEmail: row.email, ...form };
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 border-t border-border bg-cream/40 px-6 py-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Priorities
        </span>
        {CHECK_IN_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, status }))}
            className={
              form.status === status
                ? "rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-bold text-white"
                : "rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground hover:border-[var(--color-accent)]"
            }
          >
            {CHECK_IN_STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Written summary — status, gaps & blockers, agreed actions
          </label>
          <span
            className={
              words >= CHECK_IN_SUMMARY_MIN_WORDS
                ? "text-xs text-[var(--color-success)]"
                : "text-xs text-muted-foreground"
            }
          >
            {words} / {CHECK_IN_SUMMARY_MIN_WORDS}+ words
          </span>
        </div>
        <textarea
          value={form.summary}
          onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
          rows={5}
          maxLength={8000}
          placeholder="One paragraph per person: priorities on/off track, gaps and blockers, feedback both ways, support needed, agreed actions…"
          className={`${fieldCls} mt-1.5`}
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={form.p1Confirmed}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, p1Confirmed: event.target.checked }))
            }
            className="mt-0.5"
          />
          <span>
            <span className="font-semibold">Role, level, scope, and reporting line verified</span>
            <span className="block text-xs text-muted-foreground">
              Uncheck and describe what changed — update the person record separately on People.
            </span>
          </span>
        </label>
        {!form.p1Confirmed && (
          <input
            value={form.p1Note}
            onChange={(event) => setForm((prev) => ({ ...prev, p1Note: event.target.value }))}
            maxLength={2000}
            placeholder="What changed — new scope, new manager, title mismatch…"
            className={fieldCls}
          />
        )}
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={form.promoFlag}
            onChange={(event) => setForm((prev) => ({ ...prev, promoFlag: event.target.checked }))}
            className="mt-0.5"
          />
          <span>
            <span className="font-semibold">Promotion candidacy flag</span>
            <span className="block text-xs text-muted-foreground">
              May meet promotion conditions 1–2 by July — flag it now, not in August.
            </span>
          </span>
        </label>
        {form.promoFlag && (
          <input
            value={form.promoNote}
            onChange={(event) => setForm((prev) => ({ ...prev, promoNote: event.target.value }))}
            maxLength={2000}
            placeholder="Why: sustained performance, already operating at next level…"
            className={fieldCls}
          />
        )}
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={form.underperfFlag}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, underperfFlag: event.target.checked }))
            }
            className="mt-0.5"
          />
          <span>
            <span className="font-semibold">Underperformance flag</span>
            <span className="block text-xs text-muted-foreground">
              Delivery, ownership, or judgment materially below level. Raise it now — holding a
              known problem until the annual review is a management failure.
            </span>
          </span>
        </label>
        {form.underperfFlag && (
          <input
            value={form.underperfNote}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, underperfNote: event.target.value }))
            }
            maxLength={2000}
            placeholder="The gap vs. the expected standard…"
            className={fieldCls}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2.5">
        {issues.length > 0 && (
          <span className="mr-auto text-xs text-muted-foreground">
            To file: {issues.join(" · ")}
          </span>
        )}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => void run(() => checkInSaveFn({ data: payload }))}
        >
          Save draft
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={busy || issues.length > 0}
          onClick={() => void run(() => checkInSubmitFn({ data: payload }))}
        >
          File check-in
        </Button>
      </div>
    </div>
  );
}

function MidYearPage() {
  const data: MidYearView = Route.useLoaderData();
  const router = useRouter();
  const [openEmail, setOpenEmail] = useState<string | undefined>(undefined);

  const done = async () => {
    await router.invalidate();
    setOpenEmail(undefined);
  };

  const direct = data.rows.filter((row) => row.direct);
  const indirect = data.rows.filter((row) => !row.direct);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Review cycle
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">
        Mid-year check-in · {data.period}
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground">
        Course-correct in January so the annual review holds no surprises. Not a rating — no
        compensation. Each conversation ends in a filed one-paragraph summary plus optional flags
        for promotion candidacy or underperformance.
      </p>

      {!data.windowOpen && (
        <div className="mt-4 rounded-[14px] border border-border bg-cream px-4 py-3.5 text-sm">
          <p className="font-semibold">Filing is closed</p>
          <p className="mt-1 text-xs text-muted-foreground">
            New check-ins and edits open January 1 and close January 31 (Europe/Paris). Filed
            records from this period stay visible below.
          </p>
        </div>
      )}

      {(
        [
          { rows: direct, label: "Direct reports", note: "local or functional line" },
          {
            rows: indirect,
            label: "Indirect reports",
            note: "check-ins here are normally filed by the direct manager",
          },
        ] as const
      ).map((group) =>
        group.rows.length === 0 ? null : (
          <Card key={group.label} className="mt-5 overflow-hidden">
            <div className="flex items-baseline justify-between border-b border-border bg-cream px-6 py-3">
              <span className="font-display text-base font-semibold">{group.label}</span>
              <span className="text-xs text-muted-foreground">{group.note}</span>
            </div>
            <div className="divide-y divide-border">
              {group.rows.map((row) => {
                const filed = row.checkIn?.submittedAt !== undefined;
                const hasDraft = row.checkIn !== undefined && !filed;
                return (
                  <div key={row.email}>
                    <div className="flex flex-wrap items-center gap-3 px-6 py-3">
                      <span className="min-w-0 flex-1">
                        {row.userId !== undefined ? (
                          <Link
                            to="/people/$userId"
                            params={{ userId: row.userId }}
                            className="block truncate text-[13.5px] font-semibold hover:text-[var(--color-accent)]"
                          >
                            {row.name}
                          </Link>
                        ) : (
                          <span className="block truncate text-[13.5px] font-semibold">
                            {row.name}
                          </span>
                        )}
                        <span className="block truncate text-xs text-muted-foreground">
                          {row.title ?? row.email}
                        </span>
                      </span>

                      {filed ? (
                        <span className="rounded-full bg-[var(--color-success-surface)] px-2.5 py-0.5 text-[10.5px] font-bold text-[var(--color-success)]">
                          filed ✓
                        </span>
                      ) : data.windowOpen ? (
                        <>
                          {hasDraft && (
                            <span className="rounded-full bg-bone px-2.5 py-0.5 text-[10.5px] font-bold text-ink-500">
                              draft
                            </span>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant={openEmail === row.email ? "secondary" : "primary"}
                            onClick={() =>
                              setOpenEmail((prev) => (prev === row.email ? undefined : row.email))
                            }
                          >
                            {openEmail === row.email
                              ? "Close"
                              : hasDraft
                                ? "Continue check-in"
                                : "Start check-in"}
                          </Button>
                        </>
                      ) : hasDraft ? (
                        <span className="text-xs text-muted-foreground">draft saved</span>
                      ) : null}
                    </div>
                    {filed && row.checkIn !== undefined && <FiledRecord checkIn={row.checkIn} />}
                    {data.windowOpen && !filed && openEmail === row.email && (
                      <CheckInForm row={row} onDone={done} />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ),
      )}

      {data.rows.length === 0 && (
        <Card className="mt-5">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No reports found on either reporting line.
          </CardContent>
        </Card>
      )}

      <div className="mt-4 flex items-start gap-3 rounded-[14px] border border-[rgba(233,75,60,0.28)] bg-[var(--color-accent-tint-surface)] px-4 py-3.5">
        <span className="flex size-5.5 shrink-0 items-center justify-center rounded-md bg-[var(--color-accent)] text-sm font-bold text-white">
          !
        </span>
        <div>
          <p className="text-[13.5px] font-bold text-[var(--color-accent-tint-text)]">
            A filed check-in is final.
          </p>
          <p className="text-xs text-muted-foreground">
            Verify role and scope in the conversation, and raise flags while you can file (January
            1–31): promotion candidacy feeds July planning; underperformance should be addressed
            early with a documented follow-up.
          </p>
        </div>
      </div>
    </div>
  );
}
