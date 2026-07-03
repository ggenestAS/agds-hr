import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../components/ui/button.tsx";
import type { SelfReviewKey, SelfReviewView } from "../server/people.shared.ts";
import { SELF_REVIEW_KEYS } from "../server/people.shared.ts";
import {
  selfReviewGetFn,
  selfReviewReopenFn,
  selfReviewSaveFn,
  selfReviewSubmitFn,
} from "../server/people.functions.ts";

// The self-review form (design): sections A–F. "This is an input, not a
// self-rating" — the manager assigns the rating. Drafts autosave locally;
// Save draft / Send to manager write the audited server copy.
export const Route = createFileRoute("/_app/self-review")({
  loader: () => selfReviewGetFn(),
  component: SelfReviewPage,
});

const STORAGE_KEY = "agds_selfreview_2026";

type FormState = Partial<Record<SelfReviewKey, string>>;

const OBJECTIVES = [
  { title: "Objective 1", obj: "o1_obj", target: "o1_target", result: "o1_result" },
  { title: "Objective 2", obj: "o2_obj", target: "o2_target", result: "o2_result" },
  { title: "Objective 3", obj: "o3_obj", target: "o3_target", result: "o3_result" },
] as const;

const KPIS = [
  {
    title: "KPI 1",
    name: "k1_name",
    target: "k1_target",
    actual: "k1_actual",
    reading: "k1_reading",
  },
  {
    title: "KPI 2 · if applicable",
    name: "k2_name",
    target: "k2_target",
    actual: "k2_actual",
    reading: "k2_reading",
  },
] as const;

const REFLECTION = [
  {
    key: "d_proud",
    label: "1 · What are you most proud of — and why does it matter beyond your own output?",
    ph: "…",
  },
  {
    key: "d_short",
    label: "2 · Where did you fall short — and what would you do differently?",
    ph: "…",
  },
  {
    key: "d_feedback",
    label: "3 · What feedback did you receive, and what did you actually do with it?",
    ph: "If you received none, say so — that is itself useful",
  },
  {
    key: "d_others",
    label:
      "4 · Beyond your objectives, where did you make others or the organisation more effective?",
    ph: "A process improved, a problem solved that wasn't strictly yours, knowledge shared, friction reduced",
  },
] as const;

const FORWARD = [
  { key: "e_skills", label: "Skills you want to build", ph: "…" },
  { key: "e_scope", label: "Scope or responsibility you'd like to take on", ph: "…" },
  { key: "e_direction", label: "Role direction over the next 1–2 years", ph: "…" },
  {
    key: "e_support",
    label: "Support you need to get there",
    ph: "From your manager or the school",
  },
] as const;

const inputCls =
  "block w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[rgba(233,75,60,0.12)]";
const labelCls = "mb-1.5 block text-[12.5px] font-semibold text-ink-700";
const sectionCls =
  "mt-4 rounded-[14px] border border-border bg-card p-6 shadow-[var(--shadow-soft)]";
const eyebrowCls =
  "mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]";

function SelfReviewPage() {
  const view: SelfReviewView = Route.useLoaderData();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => ({ ...view.payload }));
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const submitted = view.submittedAt !== undefined;

  // Draft autosave: localStorage, merged under any server copy on first load.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const local = JSON.parse(raw) as FormState;
        setForm((prev) => ({ ...local, ...prev }));
      }
    } catch {
      // ignore unreadable local drafts
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (key: SelfReviewKey, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage full/unavailable — the explicit save still works
      }
      return next;
    });
  };

  const filled = useMemo(
    () => SELF_REVIEW_KEYS.filter((key) => (form[key] ?? "").trim().length > 0).length,
    [form],
  );
  const pct = Math.round((filled / SELF_REVIEW_KEYS.length) * 100);

  const payload = () =>
    Object.fromEntries(
      Object.entries(form).filter(([, value]) => typeof value === "string"),
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

  const field = (key: SelfReviewKey, label: string, ph: string, textarea = false) => (
    <div>
      <label className={labelCls}>{label}</label>
      {textarea ? (
        <textarea
          value={form[key] ?? ""}
          onChange={(event) => setField(key, event.target.value)}
          placeholder={ph}
          disabled={submitted || view.locked}
          rows={3}
          maxLength={4000}
          className={inputCls}
        />
      ) : (
        <input
          value={form[key] ?? ""}
          onChange={(event) => setField(key, event.target.value)}
          placeholder={ph}
          disabled={submitted || view.locked}
          maxLength={4000}
          className={inputCls}
        />
      )}
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
          before the review conversation.
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
              {filled}/{SELF_REVIEW_KEYS.length} answered · {pct}%
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
            <Button type="button" size="sm" disabled={busy} onClick={() => void submit()}>
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
            {view.managerName !== undefined && (
              <>
                {" "}
                to <strong>{view.managerName}</strong>
              </>
            )}
            . They'll add their assessment and share it before your review conversation.
            {!view.locked && " You can still reopen and edit."}
          </span>
        </div>
      )}

      <div className={sectionCls}>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("sr_name", "Name", "Your name")}
          {field("sr_role", "Role", "Role · level · path")}
          {field("sr_manager", "Manager", view.managerName ?? "Who you report to")}
          {field("sr_period", "Period reviewed", "e.g. Sep 2025 – Aug 2026")}
        </div>
      </div>

      <div className={sectionCls}>
        <p className={eyebrowCls}>A · Objectives</p>
        <h3 className="font-display text-lg font-semibold">What you owned this year</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The 2–3 responsibilities that mattered most. Name it, describe what "on target" looked
          like, and give one sentence of result and evidence — including trade-offs. Your manager
          will confirm or amend the list.
        </p>
        {OBJECTIVES.map((objective, index) => (
          <div
            key={objective.title}
            className={index === 0 ? "mt-5" : "mt-5 border-t border-border pt-5"}
          >
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              {objective.title}
            </p>
            <div className="space-y-3.5">
              {field(objective.obj, "Objective / responsibility", "What you owned")}
              {field(objective.target, 'What "on target" looked like', "The bar for success")}
              {field(
                objective.result,
                "Result & evidence",
                "One sentence — what you did that produced this result, including trade-offs",
                true,
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={sectionCls}>
        <p className={eyebrowCls}>B · KPI results</p>
        <h3 className="font-display text-lg font-semibold">Your quantified targets</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete only if your role includes KPIs — including any that influence variable
          compensation. State target, actual, and your reading of what drove it. Numbers are
          verified against the authoritative source; the value here is your interpretation.
        </p>
        {KPIS.map((kpi, index) => (
          <div
            key={kpi.title}
            className={index === 0 ? "mt-5" : "mt-5 border-t border-border pt-5"}
          >
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              {kpi.title}
            </p>
            <div className="grid gap-3.5 sm:grid-cols-[2fr_1fr_1fr]">
              {field(kpi.name, "KPI name", "e.g. Student retention")}
              {field(kpi.target, "Target", "Target")}
              {field(kpi.actual, "Actual", "Actual")}
            </div>
            <div className="mt-3.5">
              {field(
                kpi.reading,
                "Reading — what drove it, and what it cost or protected",
                "One to two sentences on quality, student fit, or long-term relationships",
                true,
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={sectionCls}>
        <p className={eyebrowCls}>C · Context on the year</p>
        <h3 className="font-display text-lg font-semibold">Anything a fair reading should know</h3>
        <div className="mt-3.5">
          {field(
            "c_context",
            "Context",
            "Change of scope, exceptional effort, external constraints, mid-year priority shifts — in either direction",
            true,
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
            <div key={entry.key}>{field(entry.key, entry.label, entry.ph, true)}</div>
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
            <div key={entry.key}>{field(entry.key, entry.label, entry.ph, true)}</div>
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
          {field("f_fair", "Fairness concern", "Leave blank, or describe a fairness concern", true)}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 pb-8">
        <span className="max-w-sm text-xs text-muted-foreground">
          Send this to your manager before the date they've indicated. They'll add their assessment
          and share it ahead of your review conversation.
        </span>
        {submitted ? (
          <span className="text-sm font-semibold text-muted-foreground">
            Sent{view.managerName !== undefined ? ` to ${view.managerName}` : ""}
          </span>
        ) : (
          <Button type="button" disabled={busy} onClick={() => void submit()}>
            Send to manager →
          </Button>
        )}
      </div>
    </div>
  );
}
