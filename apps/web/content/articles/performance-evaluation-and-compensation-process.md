---
type: process
title: "Performance Evaluation and Compensation Process Handbook"
topics: [hr]
owner: CEO & COO
last_reviewed: 2026-07-04
status: draft
sources:
  - raw/prompts/2026-07-02T16-34-34-633Z-performance-evaluation-compensation.md
  - raw/prompts/2026-07-02T17-42-49-299Z-yes.md
supersedes: none
superseded_by: none
related:
  - tier2/performance-evaluation-and-compensation-policy.md
---

# Performance Evaluation and Compensation Process Handbook

## Purpose

Define the nine operational processes that execute the Performance Evaluation and Compensation Policy: who does what, when, with which inputs, and producing which records. Every process ends in a documented output — if it isn't written down, it didn't happen.

**agds-hr** is the system of record for the in-app portions of this handbook. Where a step is not yet supported in software, it remains a manual obligation with the same documentation standard.

## agds-hr coverage

| #   | Process                     | In agds-hr | Primary surfaces                                                                                                       |
| :-- | :-------------------------- | :--------- | :--------------------------------------------------------------------------------------------------------------------- |
| P1  | Employee mapping            | Partial    | `/people`, `/people/$userId`                                                                                           |
| P2  | Salary band management      | Yes        | `/bands`                                                                                                               |
| P3  | Annual review cycle         | Yes        | `/dashboard`, `/self-review`, `/peer-input`, `/assessment`, `/calibration`, `/tracking`, `/sign-off`, `/documentation` |
| P4  | Appeal                      | Yes        | `/appeals`                                                                                                             |
| P5  | Mid-year check-in           | Yes        | `/mid-year`                                                                                                            |
| P6  | Underperformance management | Partial    | Person record · assessment P6 acknowledgment · `p6_triggered` at delivery                                              |
| P7  | Off-cycle compensation      | No         | —                                                                                                                      |
| P8  | Variable compensation plans | No         | `/compensation` (reference principles only)                                                                            |
| P9  | Annual system audit         | Partial    | `/audit`, `/calibration`, `/documentation`, `/bands` (phased transparency)                                             |

Processes marked **Partial** or **No** still bind leadership; the gap is tooling, not policy.

## Trigger

Processes are triggered on varying rhythms — see the process table and the cross-process calendar below.

## Steps

Nine processes govern the full evaluation and compensation system:

| #   | Process                          | Rhythm                               |
| :-- | :------------------------------- | :----------------------------------- |
| P1  | Employee mapping                 | Event-driven + verified mid-year     |
| P2  | Salary band management           | Annual, pre-cycle                    |
| P3  | Annual review cycle              | July → September                     |
| P4  | Appeal                           | Event-driven, ≤30 days post-decision |
| P5  | Mid-year check-in                | January / February                   |
| P6  | Underperformance management      | Event-driven, two entry doors        |
| P7  | Off-cycle compensation decisions | Event-driven                         |
| P8  | Variable compensation plans      | Annual + new-plan                    |
| P9  | Annual system audit              | October                              |

**Transitional note (2026 cycle).** The September 2026 cycle runs on the policy's philosophy, evaluation criteria, and rating scale. Band tables and campus coefficients exist in agds-hr (`/bands`), but band-dependent compensation mechanics (position-in-band merit suggestions, below-band correction workflows) stay advisory until the January 2027 check-in confirms readiness (P2 deadline · P9 transparency decision). All 2026 decisions are documented with full rigor and mapped to bands as the infrastructure matures.

---

### P1 — Employee mapping

**Purpose:** maintain one accurate master record per employee. Every other process depends on it.

**Trigger:** new hire · role or scope change · departure · system initialisation. Verified at every mid-year check-in (P5).

**Owner:** CEO & COO. **Contributors:** managers (verification).

**Steps:**

1. Create or update the master record: name · role family · level (L1–L4) · path (IC / manager) · country · campus · manager · start date · current title.
2. Check title–level coherence; flag and document any legacy mismatch with a correction intent.
3. Assign band (once P2 is live): role family × level → band (Paris reference); adjust by campus coefficient with judgment; calculate band position. Band math applies only to salaried employees (`employment_type = employee`).
4. Document any exception (above-band, title mismatch, adjacent-market benchmark).
5. Mid-year verification (via P5): manager confirms role, level, scope, and reporting line per direct report; changes route back to step 1.

**Output:** master employee record; exception records where applicable.

**In agds-hr:** the Albert Inside roster is the source for name, email, title, campus, country, and functional manager. agds-hr holds HR attributes on `people.employee` (level, path, `employment_type`, optional `review_participation_override`, role family when set), reconciled by verified school email on the person page. Reporting lines are read from Inside, not duplicated.

**Rules:** no employee may enter P3 without a complete, current master record. Review participation defaults to salaried employees only; apprentices, VIE, interns, and freelancers are out of the cycle unless HR sets `review_participation_override = included` (documented). Non-participants are blocked at case open (`not_in_review_cycle`).

---

### P2 — Salary band management

**Purpose:** build and maintain the band infrastructure that makes compensation decisions coherent and auditable.

**Trigger:** annually, completed before the July cycle opens; addition of a new country or role family; significant market movement.

**Owner:** CEO & COO. **Visibility:** CEO, COO, and LT members involved in compensation decisions only — until publication criteria are met.

**Steps:**

1. Build or update bands by role family × level, using market benchmarks from the relevant talent market. agds-hr stores Paris-reference min/mid/max (whole EUR) per family × level, including high-variable, low-variable, and Teaching families where applicable.
2. Apply campus coefficients (Paris = 1.00×; other campuses as added). The policy speaks in country terms; operationally agds-hr adjusts by campus because cost-of-living differs within a country. Document any non-mechanical application.
3. Map every salaried employee to a band; calculate position: below / low / midpoint / high / above (merit-matrix helpers exist; full band-position surfacing is gated on `employment_type`).
4. Flag anomalies: below-band gaps · above-band salaries (no reduction; future raises constrained) · internal-equity inconsistencies.
5. Document all exceptions with rationale.
6. Assess publication readiness against the phased approach (bands built → employees mapped → gaps identified → convergence underway → exceptions documented → publish). Publication decision made in P9. The six-step roadmap is visible on `/bands`.

**Output:** band table · coefficient table · band position per employee · anomaly and exception list (feeds P3 calibration and P9 audit).

**In agds-hr:** founders edit bands and view campus coefficients on `/bands` (leadership-only; every write audited). Reads of compensation amounts elsewhere are separately audited.

**Deadlines:** bands built and all employees mapped by the January 2027 check-in; band ranges published at the 2027 cycle, subject to P9 confirmation.

---

### P3 — Annual review cycle

**Purpose:** evaluate every employee, decide ratings, compensation, and promotions — evidence-based, calibrated, documented.

**Trigger:** opened by CEO & COO for the active cycle (`2026` in agds-hr). Decisions effective September.

**Owner:** CEO & COO (cycle, calibration, sign-off) · managers (assessments) · employees (self-evaluations).

**Timeline gates (hard deadlines):**

| Gate | Step                                             | Target          |
| :--- | :----------------------------------------------- | :-------------- |
| G1   | Cycle opens; objectives lists confirmed          | early July      |
| G2   | Self-evaluations submitted                       | mid July        |
| G3   | Peer input collected                             | late July       |
| G4   | Manager assessments complete                     | mid August      |
| G5   | Calibration session(s) held                      | late August     |
| G6   | CEO/COO sign-off; documentation complete         | end August      |
| G7   | Decision summaries delivered; conversations held | early September |
| G8   | Appeal window closes                             | early October   |

A missed gate is escalated to CEO/COO, not silently absorbed.

**2026 optimized sequence (agds-hr).** The `/dashboard` cycle timeline front-loads constraints and calibration relative to the gate table above: mid-year check-in Jan–Feb · budget planning June (envelope and headcount before reviews) · self-review and peer input late June · manager preparation early July · calibration early July (before any outcome is communicated) · annual review conversations and objective-setting July–August · effective September. agds-hr tracks review **state** and **obligations** (`/tracking`), not calendar gate dates — gate compliance remains a leadership discipline.

**Review case states in agds-hr:** `self_review` → `peer_input` → `manager_assessment` → `calibration` → `decision` → (`appeal` | `closed`). Non-LT employees may skip `peer_input` when the manager advances directly; LT members should still collect peer input per step 2b.

**Steps:**

1. **Cycle opening (CEO/COO):** announce calendar and gates; open cases in agds-hr. Each manager confirms or amends every direct report's objective list before self-evaluations are written (objectives live in the self-review form once the employee opens it).
2. **Self-evaluation (employee):** complete the standard form on `/self-review` (objectives with evidence · KPI results · context · honest reflection · growth and support · optional compensation-fairness flag). The self-evaluation is an input, not a determinant of the rating. Submitted to the manager by G2. agds-hr auto-opens the subject's case on first save; submit is word-count gated (fail closed).
   - **2b. Peer input collection:** LT members — mandatory structured input from 2–3 LT peers and at least 2 team members (operational target; tag requests as `lt` / `team` / `cross` in agds-hr). All other employees — manager requests input from relevant stakeholders. **agds-hr enforces a minimum quota before advancing past `peer_input`:** two submitted cross-team inputs, plus own-team inputs scaled to local team size (0–2). LT-tagged requests are tracked but do not satisfy the quota. Input is named, not anonymous, never shown to the person being reviewed, and goes to the reviewer.
3. **Manager assessment:** written, evidence-based on `/assessment`, covering the five shared dimensions (impact · ownership · quality & rigor · collaboration · culture & judgment) · role-specific objectives · manager or senior-IC criteria where applicable · self-evaluation and peer input · comparison with level expectations. Every dimension claim requires at least one piece of evidence; submit is blocked until complete.
4. **Manager proposal:** rating (1–4) · development priorities · promotion readiness (three-condition test: sustained performance + already operating at next level + organisational need) · compensation recommendation type (amounts entered at sign-off).
   4b. **Envelope confirmation (CEO & COO, before calibration):** Calculate the total pool available for variables and bonuses for the fiscal year (12% of net profit). Communicate the envelope to all calibration participants as a hard budget constraint. Calibration decisions must fit within this envelope; any exception requires CEO & COO co-sign with documented rationale. **Not yet stored in agds-hr** — manual step; recorded in calibration notes and P9 audit.
5. **Calibration (CEO, COO, relevant LT members):** compare ratings on `/calibration` · challenge inflated or harsh ratings · check consistency by level · surface internal-equity issues · explicitly test for bias (visibility, personality, negotiation style, gender, age, tenure, proximity to leadership). LT members go through the same calibration, prepared jointly by CEO & COO. CEO and COO review each other with the same mechanism.
6. **Final decisions (CEO & COO sign-off):** ratings, raises, bonuses, promotions, exceptions. agds-hr requires **two distinct founder sign-offs** per case on `/sign-off` before delivery; that stamps `decided_at`, opens the 30-day appeal clock, and sets `p6_triggered` when rating ≤ 2. Prohibited factors: personal financial need, loyalty alone, tenure alone, effort without impact, negotiation pressure, threats to leave, closeness to leadership.
7. **Documentation per employee:** role & level · current compensation · band & position · rating · raise/bonus decision · promotion decision · one-paragraph rationale · any exception with justification. Delivered decisions appear on `/documentation` (leadership-only; the page load is one audited comp read).
8. **Written decision summary (manager → employee):** standard one-page document delivered before the review conversation. The appeal clock (P4) starts from agds-hr delivery (`decided_at` / `appeal_until`), not from the conversation date.
9. **Review conversation:** manager and employee discuss the decision summary; the conversation explains the decision, it does not renegotiate it (renegotiation path = P4).
10. **Ratings 1–2 route to P6.** Promotion-blocked cases are formally acknowledged in the decision summary with a review date and, where appropriate, within-band progression. Low proposed ratings require explicit P6 acknowledgment before assessment submit.

**Output:** per employee — final rating · comp decision · promotion decision · development plan · decision summary · full documentation trail. Calibration notes and exception list feed P9.

---

### P4 — Appeal

**Purpose:** a bounded, documented channel for disagreement — so disputes are resolved in a defined process rather than in 1:1 pressure.

**Trigger:** written appeal by an employee within 30 days of receiving their decision summary (agds-hr: within `appeal_until` after dual-founder delivery).

**Owner:** the alternate decision-maker (if the manager decided, CEO or COO; if Grégoire decided, Mathieu; and vice versa). LT-member appeals heard by both founders together, with written peer input re-examined. **agds-hr routing:** because annual decisions require dual-founder sign-off, there is no non-deciding founder left — open appeals queue to **HR Admin**, who resolves with a written response on `/appeals`. The policy's alternate-decision-maker rule still governs who re-reviews substantively; Admin is the operational channel.

**Steps:**

1. Submission: written on `/appeals`, stating the specific disagreement (rating, raise, band placement, or exception). One appeal per decision (enforced in agds-hr).
2. Re-review by the alternate decision-maker within 30 days: re-read assessment, evidence, peer input, and calibration notes; interview employee and manager if useful.
3. Outcome: confirm · adjust · escalate to the next calibration session.
4. Written response delivered to the employee and filed alongside the original decision (agds-hr stores resolution; appeals are never joined into future performance views).

**Rules:** using the appeal path carries no penalty and must never be treated as a negative signal in future reviews. Appeal outcomes reviewed in aggregate at P9.

**Output:** appeal record (submission · re-review reasoning · outcome · response) attached to the employee's decision documentation.

---

### P5 — Mid-year check-in

**Purpose:** course-correct in January so July holds no surprises. Not a review — no ratings, no comp.

**Trigger:** January / February, initiated by CEO & COO.

**Owner:** managers.

**Steps:**

1. Meeting (30–60 min per direct report): priorities on track / off track · gaps and blockers · feedback in both directions · support needed.
2. P1 verification: role, level, scope, manager still accurate? Changes route to P1.
3. Promotion-candidacy flag: if the manager believes the person may meet promotion conditions 1–2 by July, flag it now.
4. Underperformance flag: if delivery, ownership, or judgment is materially below level, flag it now → P6 early door. Holding a known problem until July is a management failure.
5. Written summary filed: one paragraph per person — status, flags, agreed actions.

**Output:** check-in record per employee · P1 updates · promotion-candidacy flags · underperformance flags (each routed to its process).

**In agds-hr:** managers file the written output on `/mid-year` — status (on/off track), the one-paragraph summary, master-record verification, and the promotion-candidacy and underperformance flags. Filing opens **January 1** and closes **January 31** (Europe/Paris); submit is gated (fail closed: status chosen, summary ≥ 30 words, an unverified record or a raised flag requires its note) and final. Scope follows the manager graph (either reporting line, any depth) with the leadership roster fallback; no one files on themselves. The conversation itself and follow-up actions outside the app (person-record updates, underperformance plans) remain manual obligations. Records are reviewer-and-up visibility.

---

### P6 — Underperformance management

**Purpose:** address underperformance directly and quickly, with clarity on the gap, the standard, and the consequences.

**Two entry doors:**

| Door   | Trigger                                                          | Formality                                                      |
| :----- | :--------------------------------------------------------------- | :------------------------------------------------------------- |
| Early  | Mid-year flag (P5) or manager judgment at any time               | Documented feedback + defined expectations; no formal plan yet |
| Formal | Rating 2 (Inconsistent) or 1 (Not at level) at the annual review | Improvement plan; mandatory for rating 1                       |

**Owner:** manager, supervised by CEO & COO.

**Steps:**

1. Define in writing: the performance gap · the expected standard · the actions required · the support available · the timeline · the consequences if improvement does not happen.
2. Early door: deliver as structured feedback with a follow-up date (typically 6–8 weeks). If resolved, close with a written note. If not, escalate to a formal plan without waiting for the annual review.
3. Formal door: rating 1 → formal improvement plan, reviewed with CEO/COO before delivery. Rating 2 → documented feedback and improvement actions; formal plan at manager's discretion.
4. Timeline review: assess against the written standard at the defined date. Outcome: improvement confirmed · plan extended (once, with reason) · role change · level change · exit.
5. Document the outcome.

**Rules:** no employee should first learn of a serious performance concern at the annual review. If that happens, it is logged as a management failure and addressed in the manager's own review. Exits follow local legal requirements per country.

**Output:** written feedback / improvement plan · timeline review record · outcome record.

**In agds-hr:** the formal door sets `p6_triggered` on delivery when rating ≤ 2; managers must acknowledge P6 before submitting a low-rating assessment. There is no improvement-plan table or early-door workflow yet — written plans and follow-ups live outside the app.

---

### P7 — Off-cycle compensation decisions

**Purpose:** give the exceptions the policy allows a controlled path — so they happen deliberately and documented, not ad hoc.

**Covers:** off-cycle raises (material below-band gaps) · off-cycle promotions (real scope change) · retention adjustments · market adjustments · unusual bonuses.

**Trigger:** a manager (or CEO/COO directly) identifies a case outside the September cycle.

**Owner:** requesting manager proposes · CEO & COO approve.

**Steps:**

1. Written request: the person · the proposed change · the category · the rationale · the evidence.
2. Eligibility test by category:
   - _Below-band correction:_ gap must be material, create retention or fairness risk; person performing strongly.
   - _Off-cycle promotion:_ real, current change in scope — not anticipation, not retention, not a promise. Three-condition test still applies.
   - _Retention adjustment:_ permitted only if the person is rated Strong+ and demonstrably below band or below market. A fairly paid person threatening to leave gets a documented "no."
   - _Market adjustment:_ documented market movement in the relevant talent market.
   - _Unusual bonus:_ exceptional, non-recurring contribution where a raise is inappropriate.
3. CEO & COO decision — approve, reject, or defer to the next cycle. Internal-equity check mandatory.
4. Exception record created. Hard constraint: no off-cycle compensation change exists without an exception record (category, rationale, evidence, approver, date).
5. Batch review at P9.

**Output:** decision (including documented rejections) · exception record → P9.

**In agds-hr:** not implemented. Off-cycle changes must still produce a written exception record (manual, filed for P9 batch review).

---

### P8 — Variable compensation plans

**Purpose:** ensure variable comp drives quality outcomes, never volume at the expense of student fit, academic standards, or reputation.

**Covers:** roles with variable pay — admissions, sales, corporate partnerships, business development.

**Trigger:** design of a new plan · annual renewal of an existing plan (before the fiscal/academic year it covers) · payout event.

**Owner:** plan designer (usually the function head) proposes · CEO & COO approve.

**Steps — plan design / renewal:**

1. Plan document: covered roles · metrics and targets · payout formula · caps · payment calendar.
2. Mandatory quality safeguards — every plan must specify at least the applicable subset: student quality · retention · conversion quality · company satisfaction · payment reliability · compliance with admissions standards · explicit prohibition of aggressive or misleading sales behaviour. A plan without safeguards is not approvable.
3. Perverse-incentive test: for each metric, answer in writing — what is the worst behaviour this metric could reward? which safeguard catches it?
4. CEO & COO approval. Documented. Approval also confirms that total variable commitments across all plans remain within the annual envelope established in P3 (step 4b). No informal or verbal variable arrangements.

**Steps — payout:** 5. Verified results: KPI outcomes confirmed against the authoritative source (TBL or equivalent) — self-reported numbers are claims, not the record. 6. Safeguard check: quality indicators reviewed before payout; a safeguard breach reduces or blocks payout per the plan's own rules. 7. Payout documented per person: metric results, safeguard status, amount.

**Output:** approved plan document · payout records · safeguard-breach records if any → P9.

**In agds-hr:** not implemented. `/compensation` publishes merit-matrix principles, should-not-drive-pay rules, and bonus guidance for managers writing recommendations — not plan design, payout, or safeguard tracking.

---

### P9 — Annual system audit

**Purpose:** the process that keeps every other process honest. Reads the documentation nobody otherwise reads; decides whether the system has earned more transparency.

**Trigger:** October, after the cycle and the appeal window close.

**Owner:** CEO & COO, in the calibration group. One session; one written output.

**Agenda:**

1. Exceptions batch review (from P2, P3, P7): all exception records, reviewed together. Explicit clustering check (country, gender, team, function, tenure, proximity to leadership). Any cluster is investigated and answered in writing.
2. Appeal outcomes review (P4): volume, categories, confirmation vs. adjustment rate.
3. Rating distribution review (P3): distribution by team and level; compression toward 3 checked against inflation risk.
4. Band health check (P2): drift vs. market, stale mappings, convergence progress on below-band corrections.
5. Transparency decision: against the six-step phased approach — is the system ready for the next publication step? Documented either way.
6. Process and policy review: what failed or created friction in P1–P8 · policy amendments needed · next year's calendar and gates. Satisfies the policy's "reviewed at least annually" clause.
7. Variable comp review (P8): plan effectiveness, safeguard breaches, perverse-incentive evidence.

**Output:** annual audit memo — findings · cluster analysis · transparency decision · policy amendments · next-year calendar. Filed; action items are owned and dated.

**In agds-hr:** partial support. `/calibration` supplies rating distribution; `/documentation` lists delivered decisions; `/audit` is the append-only mutation trail; `/bands` shows phased-transparency progress. The audit memo itself, clustering analysis, and P8 review remain manual outputs filed outside the app.

---

## Inputs and outputs

**Inputs:** manager assessments, employee self-evaluations, peer input, master employee records, band data, KPI results from authoritative sources (TBL or equivalent), market benchmarks.

**Outputs:** per employee — master record, rating, comp decision, promotion decision, development plan, decision summary. System-level — exception list, calibration notes, appeal records, audit memo. All outputs are written; undocumented decisions are treated as not made.

## Owner

CEO & COO own this process suite. Managers own P5 and P6 day-to-day, supervised by CEO & COO. Any change to process rules is confirmed at P9 and documented before the next cycle opens.

## Cross-process rules

1. **Documentation is a precondition, not an afterthought.** A decision without its record is treated as not made. For off-cycle changes (P7), this is a hard system constraint once the module ships; until then, manual exception records satisfy the rule.
2. **Visibility model (agds-hr):** founders and HR admins see compensation amounts and bands. Managers see merit principles and write comp recommendation types; amounts are revealed only through audited reads at sign-off. Calibration participants see ratings and assessments for the population under discussion. Every authenticated user sees the directory; employees see their own case, self-review, peer obligations, and appeal. Appeals are visible only to the appellant and HR admins — structurally excluded from other performance views. Band ranges on `/bands` stay leadership-only until the phased-transparency decision (P9) publishes them.
3. **Conflict rule:** where this handbook and the policy diverge, the policy prevails, and the divergence is fixed at P9 or immediately if material. Where agds-hr implements a narrower or adapted rule (appeal routing, peer quota, campus coefficients), this handbook documents the running system; closing gaps is tracked in product plans.

**Steady-state calendar:**

| Month                  | Activity                                                                    |
| :--------------------- | :-------------------------------------------------------------------------- |
| January–February       | P5 mid-year check-ins · P1 verification                                     |
| June                   | Budget envelope and headcount constraints (2026 optimized — before reviews) |
| Pre-July               | P2 band update · P8 plan renewals                                           |
| Late June – early July | P3 self-review · peer input · manager prep · calibration (2026 optimized)   |
| July–August            | P3 annual conversations · objective setting (gates G4–G7)                   |
| September              | Decisions effective                                                         |
| September–October      | P4 appeal window (G8)                                                       |
| October                | P9 annual audit                                                             |
| Any time               | P6 early door · P7 off-cycle · P1 event updates                             |

## Citations

- `raw/prompts/2026-07-02T16-34-34-633Z-performance-evaluation-compensation.md` — source for all nine processes, steps, rules, and outputs in this article.
