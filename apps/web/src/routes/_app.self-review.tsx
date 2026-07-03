import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { FormRoutePending } from "../components/route-pending/shapes.tsx";
import { Button } from "../components/ui/button.tsx";
import type { SelfReviewKey, SelfReviewView } from "../server/people.shared.ts";
import {
  SELF_REVIEW_KEYS,
  SELF_REVIEW_KPI_ROWS,
  SELF_REVIEW_KPIS_MAX,
  SELF_REVIEW_OBJECTIVE_ROWS,
  SELF_REVIEW_OBJECTIVES_MAX,
  SELF_REVIEW_OBJECTIVES_MIN,
  SELF_REVIEW_STAMPED_KEYS,
  SELF_REVIEW_WORD_BOUNDS,
  countWords,
  kpiRowsInUse,
  objectiveRowsInUse,
  selfReviewSubmitIssues,
} from "../server/people.shared.ts";
import {
  selfReviewGetFn,
  selfReviewReopenFn,
  selfReviewSaveFn,
  selfReviewSubmitFn,
} from "../server/people.functions.ts";

// The self-review form (design): sections A–F. "This is an input, not a
// self-rating" — the manager assigns the rating. Drafts autosave locally;
// Save draft / Send to manager write the audited server copy. Objectives
// (2–6) and KPIs (0–5) are dynamic rows; the submit gate is the shared pure
// helper, re-enforced server-side.
export const Route = createFileRoute("/_app/self-review")({
  loader: () => selfReviewGetFn(),
  pendingComponent: () => <FormRoutePending width="3xl" />,
  component: SelfReviewPage,
});

const STORAGE_KEY = "agds_selfreview_2026";

type FormState = Partial<Record<SelfReviewKey, string>>;

// Per-field help: what is expected AND why it is expected — the why is what
// turns a form into a shared understanding of how the review is read.
const REFLECTION = [
  {
    key: "d_proud",
    label: "1 · What are you most proud of — and why does it matter beyond your own output?",
    ph: "One thing, concretely",
    help: "Pick one thing and explain its effect beyond your own desk. Impact on others and on the school is what distinguishes levels — output alone doesn't.",
  },
  {
    key: "d_short",
    label: "2 · Where did you fall short — and what would you do differently?",
    ph: "Be specific about the miss",
    help: "A specific, owned miss builds more trust with calibration than a polished story. Everyone falls short somewhere; pretending otherwise reads as low self-awareness.",
  },
  {
    key: "d_feedback",
    label: "3 · What feedback did you receive, and what did you actually do with it?",
    ph: "If you received none, say so — that is itself useful",
    help: 'This shows how you metabolise feedback — a core expectation at every level. "I received none" is a legitimate answer and a useful signal about your environment.',
  },
  {
    key: "d_others",
    label:
      "4 · Beyond your objectives, where did you make others or the organisation more effective?",
    ph: "A process improved, a problem solved that wasn't strictly yours, knowledge shared, friction reduced",
    help: "Glue work — unblocking others, fixing shared friction, spreading knowledge — often goes unseen. This is the one place it is explicitly counted.",
  },
] as const;

const FORWARD = [
  {
    key: "e_skills",
    label: "Skills you want to build",
    ph: "Concrete skills, not aspirations",
    help: "Feeds your development plan for next year — name skills specific enough to act on.",
  },
  {
    key: "e_scope",
    label: "Scope or responsibility you'd like to take on",
    ph: "…",
    help: "Growth is planned around stated ambitions, not guessed ones. Say what you want to own next.",
  },
  {
    key: "e_direction",
    label: "Role direction over the next 1–2 years",
    ph: "…",
    help: "IC or management path, deepening or broadening — so the conversation can be honest about fit.",
  },
  {
    key: "e_support",
    label: "Support you need to get there",
    ph: "From your manager or the school",
    help: "Unstated needs can't be planned for. Name what you need — training, time, exposure, air cover.",
  },
] as const;

const inputCls =
  "block w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[rgba(233,75,60,0.12)]";
const labelCls = "mb-1 block text-[12.5px] font-semibold text-foreground";
const helpCls = "mb-1.5 text-xs leading-relaxed text-muted-foreground";
const sectionCls =
  "mt-4 rounded-[14px] border border-border bg-card p-6 shadow-[var(--shadow-soft)]";
const eyebrowCls =
  "mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]";
const rowTitleCls = "text-[11px] font-bold uppercase tracking-[0.09em] text-muted-foreground";
const removeBtnCls =
  "text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-[var(--color-accent)] hover:underline";
const addBtnCls =
  "mt-4 rounded-xl border border-dashed border-border px-3.5 py-2 text-xs font-semibold text-foreground hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]";
const contextLabelCls = "text-[11px] font-bold uppercase tracking-[0.09em] text-muted-foreground";
const contextValueCls = "text-sm font-medium text-foreground";

const stampedKeySet = new Set<string>(SELF_REVIEW_STAMPED_KEYS);

// Live word counter for bounded fields: amber below the minimum, red above the
// maximum, quiet when in range or empty.
function WordCounter({ value, fieldKey }: { value: string; fieldKey: SelfReviewKey }) {
  const bounds = SELF_REVIEW_WORD_BOUNDS[fieldKey];
  if (bounds === undefined) {
    return null;
  }
  const words = countWords(value);
  const tone =
    words === 0
      ? "text-muted-foreground"
      : words < bounds.min
        ? "text-[var(--color-warning)]"
        : words > bounds.max
          ? "text-[var(--color-accent)]"
          : "text-[var(--color-success)]";
  return (
    <p className={`mt-1 text-[11px] tabular-nums ${tone}`}>
      {words} {words === 1 ? "word" : "words"} · aim for {bounds.min}–{bounds.max}
    </p>
  );
}

function SelfReviewPage() {
  const view: SelfReviewView = Route.useLoaderData();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => ({ ...view.payload }));
  const [objectiveCount, setObjectiveCount] = useState(() =>
    Math.max(SELF_REVIEW_OBJECTIVES_MIN, objectiveRowsInUse(view.payload)),
  );
  const [kpiCount, setKpiCount] = useState(() => kpiRowsInUse(view.payload));
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const submitted = view.submittedAt !== undefined;
  const readOnly = submitted || view.locked;

  // Draft autosave: localStorage, merged under any server copy on first load.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const local = JSON.parse(raw) as FormState;
        setForm((prev) => ({ ...local, ...prev }));
        const merged = { ...local, ...view.payload };
        setObjectiveCount((count) => Math.max(count, objectiveRowsInUse(merged)));
        setKpiCount((count) => Math.max(count, kpiRowsInUse(merged)));
      }
    } catch {
      // ignore unreadable local drafts
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (next: FormState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage full/unavailable — the explicit save still works
    }
  };

  const setField = (key: SelfReviewKey, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      persist(next);
      return next;
    });
  };

  // Removing a row shifts later rows up so the payload stays dense (o1..oN)
  // and clears the freed slot — cleared keys persist as "" so the server copy
  // is overwritten on the next save.
  const removeObjective = (index: number) => {
    setForm((prev) => {
      const next = { ...prev };
      for (let i = index; i < objectiveCount - 1; i += 1) {
        const from = SELF_REVIEW_OBJECTIVE_ROWS[i + 1]!;
        const to = SELF_REVIEW_OBJECTIVE_ROWS[i]!;
        next[to.obj] = prev[from.obj] ?? "";
        next[to.target] = prev[from.target] ?? "";
        next[to.result] = prev[from.result] ?? "";
      }
      const last = SELF_REVIEW_OBJECTIVE_ROWS[objectiveCount - 1]!;
      next[last.obj] = "";
      next[last.target] = "";
      next[last.result] = "";
      persist(next);
      return next;
    });
    setObjectiveCount((count) => Math.max(SELF_REVIEW_OBJECTIVES_MIN, count - 1));
  };

  const removeKpi = (index: number) => {
    setForm((prev) => {
      const next = { ...prev };
      for (let i = index; i < kpiCount - 1; i += 1) {
        const from = SELF_REVIEW_KPI_ROWS[i + 1]!;
        const to = SELF_REVIEW_KPI_ROWS[i]!;
        next[to.name] = prev[from.name] ?? "";
        next[to.target] = prev[from.target] ?? "";
        next[to.actual] = prev[from.actual] ?? "";
        next[to.reading] = prev[from.reading] ?? "";
      }
      const last = SELF_REVIEW_KPI_ROWS[kpiCount - 1]!;
      next[last.name] = "";
      next[last.target] = "";
      next[last.actual] = "";
      next[last.reading] = "";
      persist(next);
      return next;
    });
    setKpiCount((count) => Math.max(0, count - 1));
  };

  // Progress counts only the fields currently in play (visible rows), so
  // adding a row lowers the percentage instead of the denominator lying.
  const activeKeys = useMemo(() => {
    const keys: SelfReviewKey[] = [];
    SELF_REVIEW_OBJECTIVE_ROWS.slice(0, objectiveCount).forEach((row) => {
      keys.push(row.obj, row.target, row.result);
    });
    SELF_REVIEW_KPI_ROWS.slice(0, kpiCount).forEach((row) => {
      keys.push(row.name, row.target, row.actual, row.reading);
    });
    keys.push(
      "c_context",
      "d_proud",
      "d_short",
      "d_feedback",
      "d_others",
      "e_skills",
      "e_scope",
      "e_direction",
      "e_support",
      "f_fair",
    );
    return keys;
  }, [objectiveCount, kpiCount]);

  const filled = useMemo(
    () => activeKeys.filter((key) => (form[key] ?? "").trim().length > 0).length,
    [form, activeKeys],
  );
  const pct = Math.round((filled / activeKeys.length) * 100);

  const issues = useMemo(() => selfReviewSubmitIssues(form), [form]);
  const canSubmit = issues.length === 0;

  const payload = () =>
    Object.fromEntries(
      Object.entries(form).filter(
        ([key, value]) =>
          typeof value === "string" &&
          (SELF_REVIEW_KEYS as readonly string[]).includes(key) &&
          !stampedKeySet.has(key),
      ),
    ) as Record<SelfReviewKey, string>;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = () =>
    run(async () => {
      await selfReviewSaveFn({ data: { payload: payload() } });
      setSavedAt(new Date().toLocaleTimeString());
    });
  const submit = () => run(() => selfReviewSubmitFn({ data: { payload: payload() } }));
  const reopen = () => run(() => selfReviewReopenFn());

  const field = (
    key: SelfReviewKey,
    label: string,
    ph: string,
    options?: { textarea?: boolean; help?: string; rows?: number },
  ) => (
    <div>
      <label className={labelCls}>{label}</label>
      {options?.help !== undefined && <p className={helpCls}>{options.help}</p>}
      {options?.textarea === true ? (
        <textarea
          value={form[key] ?? ""}
          onChange={(event) => setField(key, event.target.value)}
          placeholder={ph}
          disabled={readOnly}
          rows={options.rows ?? 3}
          maxLength={4000}
          className={inputCls}
        />
      ) : (
        <input
          value={form[key] ?? ""}
          onChange={(event) => setField(key, event.target.value)}
          placeholder={ph}
          disabled={readOnly}
          maxLength={4000}
          className={inputCls}
        />
      )}
      <WordCounter value={form[key] ?? ""} fieldKey={key} />
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="relative overflow-hidden rounded-[20px] bg-ink-900 p-8 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
          Annual review · 2026
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white">
          Your annual self-review
        </h1>
        <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-white/80">
          Your own reflection on the year — about 20–30 minutes. Keep answers short and honest; the
          goal is a fair, shared picture, not a perfect score. Your manager adds their assessment
          before the review conversation. Word targets next to each field show the depth expected —
          hitting the range matters more than polish.
        </p>
        <div className="mt-4 rounded-[14px] border-l-2 border-[var(--color-accent)] bg-white/5 px-4 py-3 text-[13.5px] leading-relaxed text-white/85">
          <strong className="text-white">This is an input, not a self-rating.</strong> Your manager
          assigns the performance rating. Your role here is to provide evidence and honest
          reflection.
        </div>
      </div>

      <div className="sticky top-2 z-10 mt-4 flex items-center gap-4 rounded-[14px] border border-border bg-card px-5 py-3.5 shadow-[var(--shadow-soft)]">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex justify-between gap-3 whitespace-nowrap text-xs">
            <span className="font-semibold tabular-nums">
              {filled}/{activeKeys.length} answered · {pct}%
            </span>
            <span className="text-muted-foreground">
              {savedAt !== null ? `Draft saved ${savedAt}` : "Drafts autosave locally"}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-bone">
            <div
              className="h-full rounded-full bg-[var(--color-accent)]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {submitted ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy || view.locked}
            onClick={() => void reopen()}
          >
            Sent · reopen
          </Button>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void saveDraft()}
            >
              Save draft
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || !canSubmit}
              onClick={() => void submit()}
            >
              Send to manager →
            </Button>
          </>
        )}
      </div>

      {submitted && (
        <div className="mt-4 flex items-center gap-3 rounded-[14px] border border-border bg-cream px-5 py-4 text-sm">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-white">
            ✓
          </span>
          <span>
            Sent
            {view.context.manager !== "—" && (
              <>
                {" "}
                to <strong>{view.context.manager}</strong>
              </>
            )}
            . They'll add their assessment and share it before your review conversation.
            {!view.locked && " You can still reopen and edit."}
          </span>
        </div>
      )}

      <div className={sectionCls}>
        <p className={contextLabelCls}>Your review context</p>
        <p className="mt-1 text-sm text-muted-foreground">
          From your profile and the active review cycle — not editable here.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className={contextLabelCls}>Name</p>
            <p className={contextValueCls}>{view.context.name}</p>
          </div>
          <div>
            <p className={contextLabelCls}>Role</p>
            <p className={contextValueCls}>{view.context.role}</p>
          </div>
          <div>
            <p className={contextLabelCls}>Manager</p>
            <p className={contextValueCls}>{view.context.manager}</p>
          </div>
          <div>
            <p className={contextLabelCls}>Period reviewed</p>
            <p className={contextValueCls}>{view.context.period}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[14px] border border-dashed border-border px-5 py-4">
        <p className="text-sm text-muted-foreground">
          Want to suggest who reviews you? Propose reviewers on the{" "}
          <Link to="/peer-input" className="font-semibold text-foreground underline">
            Peer input
          </Link>{" "}
          page — your manager decides the final list.
        </p>
      </div>

      <div className={sectionCls}>
        <p className={eyebrowCls}>A · Objectives</p>
        <h3 className="font-display text-lg font-semibold">What you owned this year</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The responsibilities that mattered most — at least {SELF_REVIEW_OBJECTIVES_MIN}, up to{" "}
          {SELF_REVIEW_OBJECTIVES_MAX}. Fewer, well-evidenced objectives beat a long list: each one
          needs the objective, the bar, and the result. Your manager will confirm or amend the list.
        </p>
        {SELF_REVIEW_OBJECTIVE_ROWS.slice(0, objectiveCount).map((row, index) => (
          <div key={row.obj} className={index === 0 ? "mt-5" : "mt-5 border-t border-border pt-5"}>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <p className={rowTitleCls}>Objective {index + 1}</p>
              {!readOnly && objectiveCount > SELF_REVIEW_OBJECTIVES_MIN && (
                <button
                  type="button"
                  className={removeBtnCls}
                  onClick={() => removeObjective(index)}
                >
                  Remove
                </button>
              )}
            </div>
            <div className="space-y-3.5">
              {field(row.obj, "Objective / responsibility", "What you owned", {
                help: "One line naming the outcome or responsibility. The review reads against what you actually owned, not your job title.",
              })}
              {field(row.target, 'What "on target" looked like', "The bar for success", {
                help: "The bar as agreed (or understood) at the start of the year. Without a stated bar, a result can't be read fairly.",
              })}
              {field(
                row.result,
                "Result & evidence",
                "What happened — with numbers, artefacts, or dates, and the trade-offs you made",
                {
                  textarea: true,
                  help: "What happened, backed by evidence — numbers, artefacts, dates — and the trade-offs behind it. Calibration weighs evidence; unsupported claims carry no weight.",
                },
              )}
            </div>
          </div>
        ))}
        {!readOnly && objectiveCount < SELF_REVIEW_OBJECTIVES_MAX && (
          <button
            type="button"
            className={addBtnCls}
            onClick={() => setObjectiveCount((count) => count + 1)}
          >
            + Add an objective ({objectiveCount} of {SELF_REVIEW_OBJECTIVES_MAX})
          </button>
        )}
      </div>

      <div className={sectionCls}>
        <div className="flex items-baseline gap-2.5">
          <p className={eyebrowCls}>B · KPI results</p>
          <span className="text-[11px] font-semibold text-ink-300">if your role has them</span>
        </div>
        <h3 className="font-display text-lg font-semibold">Your quantified targets</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a row per KPI (up to {SELF_REVIEW_KPIS_MAX}) — including any that influence variable
          compensation. Skip this section entirely if your role has none. Numbers are verified
          against the authoritative source; the value here is your interpretation.
        </p>
        {kpiCount === 0 && (
          <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            No KPIs listed — fine if your role has no quantified targets.
          </p>
        )}
        {SELF_REVIEW_KPI_ROWS.slice(0, kpiCount).map((row, index) => (
          <div key={row.name} className={index === 0 ? "mt-5" : "mt-5 border-t border-border pt-5"}>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <p className={rowTitleCls}>KPI {index + 1}</p>
              {!readOnly && (
                <button type="button" className={removeBtnCls} onClick={() => removeKpi(index)}>
                  Remove
                </button>
              )}
            </div>
            <div className="grid gap-3.5 sm:grid-cols-[2fr_1fr_1fr]">
              {field(row.name, "KPI name", "e.g. Student retention", {
                help: "As tracked in the source system.",
              })}
              {field(row.target, "Target", "Committed", {
                help: "The number committed to.",
              })}
              {field(row.actual, "Actual", "Achieved", {
                help: "Will be verified at source.",
              })}
            </div>
            <div className="mt-3.5">
              {field(
                row.reading,
                "Reading — what drove it, and what it cost or protected",
                "One to two sentences on quality, student fit, or long-term relationships",
                {
                  textarea: true,
                  help: "The number is checked elsewhere; your reading is the part only you can provide — what drove it, and what hitting (or missing) it cost or protected.",
                },
              )}
            </div>
          </div>
        ))}
        {!readOnly && kpiCount < SELF_REVIEW_KPIS_MAX && (
          <button
            type="button"
            className={addBtnCls}
            onClick={() => setKpiCount((count) => count + 1)}
          >
            + Add a KPI ({kpiCount} of {SELF_REVIEW_KPIS_MAX})
          </button>
        )}
      </div>

      <div className={sectionCls}>
        <p className={eyebrowCls}>C · Context on the year</p>
        <h3 className="font-display text-lg font-semibold">Anything a fair reading should know</h3>
        <div className="mt-3.5">
          {field(
            "c_context",
            "Context",
            "Change of scope, exceptional effort, external constraints, mid-year priority shifts — in either direction",
            {
              textarea: true,
              help: "Scope changes, constraints, exceptional circumstances — in either direction. Unstated context can't be credited during calibration; this is where a fair reading starts.",
            },
          )}
        </div>
      </div>

      <div className={sectionCls}>
        <p className={eyebrowCls}>D · Honest reflection</p>
        <h3 className="font-display text-lg font-semibold">The four that matter most</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Short, direct answers carry more weight than polished ones.
        </p>
        <div className="mt-4 space-y-4">
          {REFLECTION.map((entry) => (
            <div key={entry.key}>
              {field(entry.key, entry.label, entry.ph, { textarea: true, help: entry.help })}
            </div>
          ))}
        </div>
      </div>

      <div className={sectionCls}>
        <p className={eyebrowCls}>E · Looking forward</p>
        <h3 className="font-display text-lg font-semibold">
          Where you want to grow over the next 12 months
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {FORWARD.map((entry) => (
            <div key={entry.key}>
              {field(entry.key, entry.label, entry.ph, { textarea: true, help: entry.help })}
            </div>
          ))}
        </div>
      </div>

      <div className={sectionCls}>
        <div className="flex items-baseline gap-2.5">
          <p className={eyebrowCls}>F · Compensation fairness</p>
          <span className="text-[11px] font-semibold text-ink-300">optional</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Not a place to state a desired salary. Flag a perceived equity issue if you believe your
          pay is inconsistent with your level, scope, or comparable roles. It's reviewed against
          band and internal-equity data during calibration.
        </p>
        <div className="mt-3.5">
          {field("f_fair", "Fairness concern", "Leave blank, or describe a fairness concern", {
            textarea: true,
          })}
        </div>
      </div>

      {!submitted && !canSubmit && (
        <div className="mt-5 rounded-[14px] border border-[var(--color-warning)]/30 bg-[var(--color-warning-surface)] px-5 py-4">
          <p className="text-[13px] font-bold text-[var(--color-warning)]">
            Before you can send to your manager
          </p>
          <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-[var(--color-warning)]">
            {issues.map((issue) => (
              <li key={issue}>· {issue}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-4 pb-8">
        <span className="max-w-sm text-xs text-muted-foreground">
          Send this to your manager before the date they've indicated. They'll add their assessment
          and share it ahead of your review conversation.
        </span>
        {submitted ? (
          <span className="text-sm font-semibold text-muted-foreground">
            Sent{view.context.manager !== "—" ? ` to ${view.context.manager}` : ""}
          </span>
        ) : (
          <Button type="button" disabled={busy || !canSubmit} onClick={() => void submit()}>
            Send to manager →
          </Button>
        )}
      </div>
    </div>
  );
}
