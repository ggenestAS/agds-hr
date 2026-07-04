// SAMPLE DATA for reviewing the app — not real reviews. Seeds review cases for
// three real roster people at different stages, plus a completed previous
// cycle (2025), all through the domain DALs so state machines, gates, and the
// audit trail behave exactly like production writes.
//
//   bun --env-file=.env scripts/ops/seed-sample-reviews.ts          # seed
//   bun --env-file=.env scripts/ops/seed-sample-reviews.ts --clear  # remove it all
//
// 2026 stages: bbernard = self-only · lbeaulieu = self + peers ·
// aarno = fully finished (assessed, rated, dual-signed, delivered).
// Everyone else stays "not started". 2025: all three closed & backdated.
// --clear deletes exactly these cases (cascades wipe self-reviews, peer
// requests, assessments, comp recs, signoffs). Audit rows remain — the trail
// is append-only and truthfully records that samples were seeded.
import { inArray, and, eq, sql } from "drizzle-orm";

import { getDbAs } from "@agds-hr/db";
import { ensureUserByEmail } from "@agds-hr/identity";
import {
  advanceCase,
  createPeerRequests,
  declinePeerRequest,
  listPeerRequestsForCase,
  openCase,
  setCaseRating,
  signDecision,
  submitAssessment,
  submitPeerInput,
  submitSelfReview,
  upsertCompRecommendation,
} from "@agds-hr/people";
import { assessment, peerRequest, reviewCase, selfReview } from "@agds-hr/people/db/schema";
import type { AssessmentDraft } from "@agds-hr/people";
import type { EvaluationDimension, PeerInputKey, ReviewRating } from "@agds-hr/people/types";
import { RequestId } from "@agds-hr/shared";

const ACTOR_EMAIL = "ggenest@albertschool.com";
const FOUNDERS = ["ggenest@albertschool.com", "mschimpl@albertschool.com"];

// The three sample subjects (real roster emails — names/managers render).
const SELF_ONLY = "bbernard@albertschool.com"; // Boris Bernard
const SELF_PLUS_PEERS = "lbeaulieu@albertschool.com"; // Léa Beaulieu
const FINISHED = "aarno@albertschool.com"; // Axel Arno

const SAMPLE_SUBJECTS = [SELF_ONLY, SELF_PLUS_PEERS, FINISHED];
const PREVIOUS_CYCLE = "2025";
const CURRENT_CYCLE = "2026";

const clear = process.argv.includes("--clear");
const adminDb = getDbAs("admin");

if (clear) {
  const removed = await adminDb
    .delete(reviewCase)
    .where(
      and(
        inArray(reviewCase.subjectEmail, SAMPLE_SUBJECTS),
        inArray(reviewCase.cyclePeriod, [PREVIOUS_CYCLE, CURRENT_CYCLE]),
      ),
    )
    .returning({
      id: reviewCase.id,
      subject: reviewCase.subjectEmail,
      cycle: reviewCase.cyclePeriod,
    });
  console.log(JSON.stringify({ ok: true, cleared: removed }, null, 2));
  process.exit(0);
}

const actorUserId = await ensureUserByEmail(adminDb, ACTOR_EMAIL, "Gregoire Genest");
const ctx = () => ({
  actorUserId,
  subjectUserId: actorUserId,
  requestId: RequestId(crypto.randomUUID()),
});

type PeerSpec = {
  readonly email: string;
  readonly kind: "cross" | "team" | "lt";
  readonly action: "submit" | "decline" | "pending";
  readonly input?: Readonly<Partial<Record<PeerInputKey, string>>>;
  readonly declineReason?: string;
};

type SampleSpec = {
  readonly subject: string;
  readonly cycle: string;
  readonly self: Readonly<Record<string, string>>;
  readonly peers: readonly PeerSpec[];
  readonly assessment?: {
    readonly author: string;
    readonly draft: Omit<AssessmentDraft, "authorEmail">;
  };
  readonly rating?: ReviewRating;
  readonly comp?: {
    currentBaseEur: number;
    increaseEur: number;
    bonusEur: number;
    rationale: string;
  };
  readonly deliver?: boolean;
  readonly close?: boolean;
};

const dims = (
  entries: readonly [EvaluationDimension, ReviewRating, string, string][],
): AssessmentDraft["dims"] =>
  Object.fromEntries(
    entries.map(([dimension, score, narrative, evidence]) => [
      dimension,
      { score, narrative, evidence },
    ]),
  ) as AssessmentDraft["dims"];

const peerVoice = (
  impact: string,
  collaboration: string,
): Readonly<Partial<Record<PeerInputKey, string>>> => ({
  // The three witness questions (required at submit since the form redesign).
  p_context: "We worked together on shared tracks and cross-campus syncs, roughly weekly.",
  p_keep: impact,
  p_improve: "Could flag capacity limits earlier instead of absorbing overload silently.",
  impact,
  collaboration,
  culture: "Reliable and direct; represents the team well.",
});

const SAMPLES: readonly SampleSpec[] = [
  // ---------- previous cycle: all three, closed ----------
  {
    subject: FINISHED,
    cycle: PREVIOUS_CYCLE,
    self: {
      sr_period: "Jul 2024 – Jun 2025",
      o1_obj: "Deliver the L1 mathematics track across both Paris cohorts",
      o1_target: "All sessions delivered, pass rate above 85%",
      o1_result: "Delivered every session; pass rate landed at 88% with the hardest exam so far.",
      d_proud: "Students rated the stats module 4.6/5 — up from 3.9 the year before.",
      d_short: "Grading turnaround slipped past one week twice during exam season.",
      e_skills: "Applied ML content for the new AI minor.",
    },
    peers: [
      {
        email: "orodot@albertschool.com",
        kind: "cross",
        action: "submit",
        input: peerVoice(
          "His exam redesign raised the bar without tanking pass rates — we reused it at Mines.",
          "Easy to align with across institutions; came prepared to every sync.",
        ),
      },
      {
        email: "eneuville@albertschool.com",
        kind: "team",
        action: "submit",
        input: peerVoice(
          "Carried the heaviest teaching load in the department without quality dropping.",
          "Shares material openly; other teachers build on his slides.",
        ),
      },
    ],
    assessment: {
      author: "bapra@albertschool.com",
      draft: {
        dims: dims([
          [
            "impact",
            3,
            "Consistently strong teaching outcomes across both cohorts.",
            "Pass rate 88%; module rating 4.6/5",
          ],
          [
            "ownership",
            3,
            "Owns his track end-to-end, including exam design.",
            "Redesigned exam adopted by Mines track",
          ],
          [
            "quality",
            3,
            "Rigorous material; grading slipped twice under load.",
            "Two grading rounds past the one-week SLA",
          ],
          [
            "collaboration",
            3,
            "Material shared and reused by the department.",
            "Slides reused by 3 other teachers",
          ],
          [
            "culture",
            3,
            "Steady, student-first, no drama under exam pressure.",
            "Peer input (Rodot, Neuville)",
          ],
        ]),
        narrative:
          "Axel fully meets L1 expectations with a heavy load carried cleanly. Next year: co-own the AI-minor math content to grow toward L2 scope.",
        proposedRating: 3,
        promoProposed: false,
        promoNote: "",
        compRec: "+3% merit",
        p6Acknowledged: false,
      },
    },
    rating: 3,
    comp: {
      currentBaseEur: 34000,
      increaseEur: 1000,
      bonusEur: 0,
      rationale: "Strong year at L1; standard merit progression within the Teaching band.",
    },
    deliver: true,
    close: true,
  },
  {
    subject: SELF_ONLY,
    cycle: PREVIOUS_CYCLE,
    self: {
      sr_period: "Jul 2024 – Jun 2025",
      o1_obj: "Ship the new content engine for all campus landing pages",
      o1_target: "All 4 campus sites migrated by March",
      o1_result: "Migrated all campuses by February; organic traffic up 22% by June.",
      d_proud: "The Milan launch content was ready two weeks before the campus opened.",
      d_short: "Video content stayed on the backlog all year.",
      e_scope: "Own the full content calendar including admissions campaigns.",
    },
    peers: [
      {
        email: "lwillems@albertschool.com",
        kind: "cross",
        action: "submit",
        input: peerVoice(
          "The content engine cut page-launch time from a week to a day for my team.",
          "Fast, responsive, and pragmatic about scope.",
        ),
      },
      {
        email: "qdeme@albertschool.com",
        kind: "team",
        action: "submit",
        input: peerVoice(
          "Unblocked the Marseille campaign with same-day turnarounds.",
          "The person I go to when something has to be live tomorrow.",
        ),
      },
    ],
    assessment: {
      author: "ggenest@albertschool.com",
      draft: {
        dims: dims([
          [
            "impact",
            4,
            "The content engine changed how every campus ships pages.",
            "Launch time down from ~1 week to ~1 day; organic +22%",
          ],
          [
            "ownership",
            4,
            "Saw the migration through across four campuses solo.",
            "All campuses live by February, one month early",
          ],
          [
            "quality",
            3,
            "High editorial bar; video backlog untouched.",
            "Zero rollback incidents on migrated pages",
          ],
          [
            "collaboration",
            4,
            "Cross-team turnarounds repeatedly unblocked campaigns.",
            "Peer input (Willems, Deme)",
          ],
          ["culture", 3, "Low-ego, high-throughput.", "Consistent peer feedback"],
        ]),
        narrative:
          "Boris exceeded expectations — the content engine is institution-level leverage, the L3 test. Exceptional year.",
        proposedRating: 4,
        promoProposed: false,
        promoNote: "",
        compRec: "+5% + bonus",
        p6Acknowledged: false,
      },
    },
    rating: 4,
    comp: {
      currentBaseEur: 42000,
      increaseEur: 2100,
      bonusEur: 1500,
      rationale: "Exceptional rating; bonus recognises the non-recurring migration effort.",
    },
    deliver: true,
    close: true,
  },
  {
    subject: SELF_PLUS_PEERS,
    cycle: PREVIOUS_CYCLE,
    self: {
      sr_period: "Jul 2024 – Jun 2025",
      o1_obj: "Build the Swiss admissions pipeline from scratch",
      o1_target: "60 qualified applications for the Geneva cohort",
      o1_result:
        "41 qualified applications — below target; the CH market needed more local presence than planned.",
      d_proud: "The school-fair circuit I built now generates a third of Swiss leads.",
      d_short: "I over-invested in digital early on when in-person converts better in CH.",
      e_support: "A local events budget and earlier campus-visit slots.",
    },
    peers: [
      {
        email: "mbianchi@albertschool.com",
        kind: "cross",
        action: "submit",
        input: peerVoice(
          "Adapted fast once the fair circuit started working — Q4 was much stronger than Q1.",
          "Asks for help early, which saved the Geneva open day.",
        ),
      },
      {
        email: "lbartoluci@albertschool.com",
        kind: "team",
        action: "submit",
        input: peerVoice(
          "Her fair playbook is now what I use for France school events.",
          "Generous with what she learns; we sync weekly without friction.",
        ),
      },
    ],
    assessment: {
      author: "awalus@albertschool.com",
      draft: {
        dims: dims([
          [
            "impact",
            2,
            "Missed the application target in a hard market.",
            "41/60 qualified applications",
          ],
          [
            "ownership",
            3,
            "Owned the correction — pivoted channel mix herself.",
            "Fair circuit built in Q3, now 1/3 of leads",
          ],
          [
            "quality",
            2,
            "Early digital spend was poorly instrumented.",
            "Q1–Q2 CAC roughly 2x plan",
          ],
          ["collaboration", 3, "Playbook adopted by the France team.", "Peer input (Bartoluci)"],
          [
            "culture",
            3,
            "Honest about misses; no defensiveness.",
            "Self-review matches the numbers",
          ],
        ]),
        narrative:
          "Léa's first Swiss year missed target but ended on a real trajectory. Inconsistent overall; the P6 plan focuses on channel discipline with a mid-year checkpoint.",
        proposedRating: 2,
        promoProposed: false,
        promoNote: "",
        compRec: "No raise",
        p6Acknowledged: true,
      },
    },
    rating: 2,
    comp: {
      currentBaseEur: 38000,
      increaseEur: 0,
      bonusEur: 0,
      rationale: "Inconsistent rating; priority is the improvement plan, revisit at mid-year.",
    },
    deliver: true,
    close: true,
  },

  // ---------- current cycle: three distinct stages ----------
  {
    subject: SELF_ONLY,
    cycle: CURRENT_CYCLE,
    self: {
      sr_period: "Jul 2025 – Jun 2026",
      o1_obj: "Launch the multilingual content system (FR/EN/IT/DE)",
      o1_target: "All programme pages in four languages by May",
      o1_result: "FR/EN/IT shipped; DE at 70% — translation vendor churn cost six weeks.",
      o2_obj: "Admissions campaign content for all campuses",
      o2_target: "Campaign kits ready two weeks before each intake wave",
      o2_result: "All three waves shipped on time; Swiss kit reused by Geneva fairs.",
      d_proud: "The IT localisation unlocked the Milan campaign a month early.",
      d_short: "I should have dual-sourced translation from the start.",
      d_feedback: "Asked to delegate more of the routine editing — I now brief two freelancers.",
      e_skills: "Structured content modelling; basic motion design.",
      sr_peers: "Lucas Willems (content engine work), Quentin Deme (Marseille campaigns)",
    },
    peers: [],
  },
  {
    subject: SELF_PLUS_PEERS,
    cycle: CURRENT_CYCLE,
    self: {
      sr_period: "Jul 2025 – Jun 2026",
      o1_obj: "Hit 70 qualified Swiss applications with fair-first channel mix",
      o1_target: "70 qualified applications, CAC within plan",
      o1_result:
        "78 qualified applications at 12% under planned CAC — the fair circuit compounding.",
      o2_obj: "Stand up the Zurich school-partnership program",
      o2_target: "5 partner schools signed",
      o2_result: "7 signed, 2 with guaranteed visit days.",
      d_proud: "Turning last year's miss into the strongest admissions channel in CH.",
      d_short: "Reporting still manual; I want the funnel in one dashboard.",
      d_feedback: "P6 checkpoint feedback applied — channel spend is now reviewed monthly.",
      e_direction: "Own DACH admissions as the region grows.",
    },
    peers: [
      {
        email: "mbianchi@albertschool.com",
        kind: "cross",
        action: "submit",
        input: peerVoice(
          "The Zurich partnerships gave the Swiss campus its first predictable pipeline.",
          "Proactive with campus ops — visit days ran without a single logistics issue.",
        ),
      },
      {
        email: "iberthouhaas@albertschool.com",
        kind: "cross",
        action: "submit",
        input: peerVoice(
          "Her fair playbook transferred to Italy almost as-is and works.",
          "Answers within the hour whenever Italy admissions needs Swiss data.",
        ),
      },
      {
        email: "lbartoluci@albertschool.com",
        kind: "team",
        action: "submit",
        input: peerVoice(
          "78 qualified applications in CH speaks for itself — and she shared every tactic.",
          "The weekly sync she runs keeps France and Swiss admissions aligned.",
        ),
      },
      { email: "qdeme@albertschool.com", kind: "team", action: "pending" },
      {
        email: "dcraven@albertschool.com",
        kind: "cross",
        action: "decline",
        declineReason: "No meaningful overlap with Swiss admissions this year",
      },
    ],
  },
  {
    subject: FINISHED,
    cycle: CURRENT_CYCLE,
    self: {
      sr_period: "Jul 2025 – Jun 2026",
      o1_obj: "Co-own the AI-minor mathematics track",
      o1_target: "Track live for the autumn cohort, co-taught with Benjamin",
      o1_result: "Track shipped; 92% completion and the strongest exam median of my tracks.",
      o2_obj: "Cut grading turnaround to under 5 days",
      o2_target: "All exams graded within 5 working days",
      o2_result: "Averaged 3.8 days using the rubric templates Benjamin and I built.",
      d_proud: "Students from the AI minor are winning the case competitions.",
      d_short: "I still say yes to too many substitute sessions.",
      d_feedback: "Last year's grading feedback — fixed with rubric templates.",
      e_scope: "Lead the L2 applied-math redesign next year.",
    },
    peers: [
      {
        email: "orodot@albertschool.com",
        kind: "cross",
        action: "submit",
        input: peerVoice(
          "The AI-minor math track is the best-articulated course hand-off I've seen between our institutions.",
          "Coordinates exam calendars with Mines without ever needing escalation.",
        ),
      },
      {
        email: "eneuville@albertschool.com",
        kind: "team",
        action: "submit",
        input: peerVoice(
          "Grading SLA fixed for good — the rubric system he built is now department standard.",
          "Quietly makes every other teacher's semester easier.",
        ),
      },
    ],
    assessment: {
      author: "bapra@albertschool.com",
      draft: {
        dims: dims([
          [
            "impact",
            4,
            "The AI-minor track is a genuine differentiator this year.",
            "92% completion; case-competition wins",
          ],
          [
            "ownership",
            3,
            "Owns his tracks fully; over-commits on substitutions.",
            "3.8-day grading average vs 5-day target",
          ],
          [
            "quality",
            4,
            "Rubric system adopted department-wide.",
            "Department standard since January",
          ],
          [
            "collaboration",
            4,
            "Model hand-offs with Mines; lifts the department.",
            "Peer input (Rodot, Neuville)",
          ],
          ["culture", 3, "Student-first, steady, generous with time.", "Consistent peer feedback"],
        ]),
        narrative:
          "Axel is operating above L1 — the AI-minor track and the rubric system are system-level improvements, the L2/L3 test. Strong, trending exceptional; propose the L2 conversation at objective-setting.",
        proposedRating: 3,
        promoProposed: true,
        promoNote:
          "L1 → L2 — co-owns the AI-minor math content and mentors the incoming teaching fellows",
        compRec: "+4% merit",
        p6Acknowledged: false,
      },
    },
    rating: 3,
    comp: {
      currentBaseEur: 35000,
      increaseEur: 1400,
      bonusEur: 0,
      rationale:
        "Strong rating, low in the Teaching band; +4% keeps progression ahead of the band midline.",
    },
    deliver: true,
  },
];

const seeded: { subject: string; cycle: string; caseId: string; stage: string }[] = [];

for (const spec of SAMPLES) {
  const reviewCaseRow = await openCase(adminDb, spec.subject, spec.cycle, ctx());
  await submitSelfReview(adminDb, reviewCaseRow.id, spec.self, ctx());

  let stage = "self-only";
  if (spec.peers.length > 0) {
    await advanceCase(adminDb, reviewCaseRow.id, "peer_input", ctx());
    await createPeerRequests(
      adminDb,
      reviewCaseRow.id,
      actorUserId,
      spec.peers.map((peer) => ({ email: peer.email, kind: peer.kind })),
      ctx(),
    );
    const requests = await listPeerRequestsForCase(adminDb, reviewCaseRow.id);
    for (const peer of spec.peers) {
      const request = requests.find((entry) => entry.requesteeEmail === peer.email);
      if (request === undefined) {
        continue;
      }
      if (peer.action === "submit" && peer.input !== undefined) {
        await submitPeerInput(adminDb, request.id, peer.email, peer.input, ctx());
      } else if (peer.action === "decline") {
        await declinePeerRequest(
          adminDb,
          request.id,
          peer.email,
          peer.declineReason ?? "n/a",
          ctx(),
        );
      }
    }
    stage = "self+peers";
  }

  if (spec.assessment !== undefined) {
    await advanceCase(adminDb, reviewCaseRow.id, "manager_assessment", ctx());
    await submitAssessment(
      adminDb,
      reviewCaseRow.id,
      { ...spec.assessment.draft, authorEmail: spec.assessment.author },
      ctx(),
    );
    if (spec.rating !== undefined) {
      await setCaseRating(adminDb, reviewCaseRow.id, spec.rating, ctx());
    }
    await advanceCase(adminDb, reviewCaseRow.id, "calibration", ctx());
    await advanceCase(adminDb, reviewCaseRow.id, "decision", ctx());
    if (spec.comp !== undefined) {
      await upsertCompRecommendation(adminDb, reviewCaseRow.id, spec.comp, ctx());
    }
    stage = "assessed";
    if (spec.deliver === true) {
      for (const founderEmail of FOUNDERS) {
        const founderId = await ensureUserByEmail(adminDb, founderEmail, founderEmail);
        await signDecision(adminDb, reviewCaseRow.id, founderId, ctx());
      }
      stage = "delivered";
    }
    if (spec.close === true) {
      await advanceCase(adminDb, reviewCaseRow.id, "closed", ctx());
      stage = "closed";
    }
  }

  seeded.push({ subject: spec.subject, cycle: spec.cycle, caseId: reviewCaseRow.id, stage });
}

// Backdate the previous cycle so it reads as history (sample data only —
// production rows are never touched this way).
const backdated = await adminDb
  .update(reviewCase)
  .set({
    decidedAt: sql`timestamptz '2025-09-15 10:00:00+02'`,
    appealUntil: sql`timestamptz '2025-10-15 10:00:00+02'`,
    createdAt: sql`timestamptz '2025-07-01 09:00:00+02'`,
    updatedAt: sql`timestamptz '2025-09-15 10:00:00+02'`,
  })
  .where(
    and(
      inArray(reviewCase.subjectEmail, SAMPLE_SUBJECTS),
      eq(reviewCase.cyclePeriod, PREVIOUS_CYCLE),
    ),
  )
  .returning({ id: reviewCase.id });
const previousIds = backdated.map((row) => row.id);
if (previousIds.length > 0) {
  await adminDb
    .update(selfReview)
    .set({ submittedAt: sql`timestamptz '2025-07-05 09:00:00+02'` })
    .where(inArray(selfReview.caseId, previousIds));
  await adminDb
    .update(peerRequest)
    .set({ submittedAt: sql`timestamptz '2025-07-12 09:00:00+02'` })
    .where(and(inArray(peerRequest.caseId, previousIds), eq(peerRequest.status, "submitted")));
  await adminDb
    .update(assessment)
    .set({ submittedAt: sql`timestamptz '2025-07-20 09:00:00+02'` })
    .where(inArray(assessment.caseId, previousIds));
}

console.log(
  JSON.stringify({ ok: true, seeded, backdatedPreviousCycle: previousIds.length }, null, 2),
);
process.exit(0);
