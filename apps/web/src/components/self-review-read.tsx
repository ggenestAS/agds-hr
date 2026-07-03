import type {
  SelfReviewFieldRead,
  SelfReviewKpiRead,
  SelfReviewObjectiveRead,
  SelfReviewPayload,
  SelfReviewReadModel,
} from "../server/people.shared.ts";
import {
  projectSelfReviewReadModel,
  selfReviewReadModelHasContent,
} from "../server/people.shared.ts";

function ReadField({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? "rounded-xl bg-cream px-3.5 py-3" : undefined}>
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[13.5px] leading-relaxed text-foreground">{value}</p>
    </div>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-accent)]">
        {eyebrow}
      </p>
      <h3 className="mt-1 font-display text-lg font-semibold tracking-tight">{title}</h3>
    </div>
  );
}

function ObjectiveBlock({ objective }: { objective: SelfReviewObjectiveRead }) {
  return (
    <div className="rounded-[14px] border border-border bg-card px-4 py-4">
      <p className="font-display text-base font-semibold text-foreground">
        Objective {objective.index}
        {objective.title !== undefined && (
          <span className="font-normal text-ink-500"> · {objective.title}</span>
        )}
      </p>
      <div className="mt-3 space-y-3">
        {objective.target !== undefined && <ReadField label="On target" value={objective.target} />}
        {objective.result !== undefined && (
          <ReadField label="Result & evidence" value={objective.result} highlight />
        )}
      </div>
    </div>
  );
}

function KpiBlock({ kpi }: { kpi: SelfReviewKpiRead }) {
  return (
    <div className="rounded-[14px] border border-border bg-card px-4 py-4">
      <p className="font-display text-base font-semibold text-foreground">
        KPI {kpi.index}
        {kpi.name !== undefined && <span className="font-normal text-ink-500"> · {kpi.name}</span>}
      </p>
      {(kpi.target !== undefined || kpi.actual !== undefined) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {kpi.target !== undefined && <ReadField label="Target" value={kpi.target} />}
          {kpi.actual !== undefined && <ReadField label="Actual" value={kpi.actual} />}
        </div>
      )}
      {kpi.reading !== undefined && (
        <div className="mt-3">
          <ReadField label="Reading" value={kpi.reading} highlight />
        </div>
      )}
    </div>
  );
}

function FieldGrid({ fields }: { fields: readonly SelfReviewFieldRead[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => (
        <ReadField key={field.label} label={field.label} value={field.value} />
      ))}
    </div>
  );
}

function ContextGrid({ model }: { model: SelfReviewReadModel }) {
  const items = [
    { label: "Name", value: model.context.name },
    { label: "Role", value: model.context.role },
    { label: "Manager", value: model.context.manager },
    { label: "Period", value: model.context.period },
  ].filter((entry) => entry.value !== undefined);
  if (items.length === 0) {
    return null;
  }
  return (
    <section className="rounded-[14px] border border-border bg-cream/60 px-4 py-4">
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
        Review context
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {items.map((entry) => (
          <div key={entry.label}>
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
              {entry.label}
            </p>
            <p className="mt-0.5 text-[13.5px] font-medium text-ink-800">{entry.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SelfReviewReadView({ payload }: { payload: SelfReviewPayload }) {
  const model = projectSelfReviewReadModel(payload);
  if (!selfReviewReadModelHasContent(model)) {
    return <p className="text-muted-foreground">No self-review content yet.</p>;
  }

  return (
    <div className="space-y-8">
      <ContextGrid model={model} />

      {model.objectives.length > 0 && (
        <section>
          <SectionHeader eyebrow="A · Objectives" title="What they owned this year" />
          <div className="space-y-3">
            {model.objectives.map((objective) => (
              <ObjectiveBlock key={objective.index} objective={objective} />
            ))}
          </div>
        </section>
      )}

      {model.kpis.length > 0 && (
        <section>
          <SectionHeader eyebrow="B · KPI results" title="Quantified targets" />
          <div className="space-y-3">
            {model.kpis.map((kpi) => (
              <KpiBlock key={kpi.index} kpi={kpi} />
            ))}
          </div>
        </section>
      )}

      {model.contextNote !== undefined && (
        <section>
          <SectionHeader eyebrow="C · Context" title="Anything a fair reading should know" />
          <ReadField label="Context on the year" value={model.contextNote} highlight />
        </section>
      )}

      {model.reflection.length > 0 && (
        <section>
          <SectionHeader eyebrow="D · Reflection" title="Honest reflection" />
          <div className="space-y-4">
            {model.reflection.map((field) => (
              <ReadField key={field.label} label={field.label} value={field.value} highlight />
            ))}
          </div>
        </section>
      )}

      {model.development.length > 0 && (
        <section>
          <SectionHeader eyebrow="E · Looking forward" title="Growth over the next 12 months" />
          <FieldGrid fields={model.development} />
        </section>
      )}

      {model.fairness !== undefined && (
        <section>
          <SectionHeader eyebrow="F · Compensation" title="Fairness concern" />
          <ReadField label="Fairness concern" value={model.fairness} highlight />
        </section>
      )}
    </div>
  );
}
