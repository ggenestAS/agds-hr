import { describe, expect, test } from "bun:test";

import {
  bandPositionPct,
  bandThird,
  CAREER_LEVELS,
  CAREER_PATHS,
  canFileAppealNow,
  canSubmitAssessment,
  canSeeAppeal,
  canTransition,
  checkInSubmitIssues,
  isCheckInStatus,
  EMPLOYMENT_TYPES,
  isAppealCategory,
  isCareerLevel,
  isCareerPath,
  isEmploymentType,
  isPeerQuotaMet,
  peerInputSubmitIssues,
  isDecisionComplete,
  isP6Triggered,
  isReviewParticipationOverride,
  isReviewRating,
  isReviewState,
  isSalaryBandApplicable,
  meritIncreaseBp,
  ownTeamPeerQuota,
  participatesInReview,
  peerInputQuota,
} from "./types.ts";

describe("job architecture tuples", () => {
  test("four levels, two paths", () => {
    expect(CAREER_LEVELS).toHaveLength(4);
    expect(CAREER_PATHS).toEqual(["ic", "manager"]);
  });

  test("guards accept members and reject non-members", () => {
    expect(isCareerLevel("L3")).toBe(true);
    expect(isCareerLevel("P5")).toBe(false);
    expect(isCareerPath("manager")).toBe(true);
    expect(isCareerPath("director")).toBe(false);
  });
});

describe("employment types", () => {
  test("guards accept members and reject non-members", () => {
    expect(isEmploymentType("freelance")).toBe(true);
    expect(isEmploymentType("contractor")).toBe(false);
    expect(isReviewParticipationOverride("excluded")).toBe(true);
    expect(isReviewParticipationOverride("maybe")).toBe(false);
  });

  test("only salaried employees are band-governed (ADR: derived, not stored)", () => {
    expect(isSalaryBandApplicable("employee")).toBe(true);
    for (const type of EMPLOYMENT_TYPES.filter((entry) => entry !== "employee")) {
      expect(isSalaryBandApplicable(type)).toBe(false);
    }
  });

  test("review participation: employee-only by default, everyone else opt-in", () => {
    expect(participatesInReview("employee", null)).toBe(true);
    expect(participatesInReview("apprentice", null)).toBe(false);
    expect(participatesInReview("vie", null)).toBe(false);
    expect(participatesInReview("intern", null)).toBe(false);
    expect(participatesInReview("freelance", null)).toBe(false);
  });

  test("the override wins over the type default, in both directions", () => {
    expect(participatesInReview("freelance", "included")).toBe(true);
    expect(participatesInReview("employee", "excluded")).toBe(false);
    expect(participatesInReview("intern", "included")).toBe(true);
  });
});

describe("review state machine", () => {
  test("valid forward transitions and the appeal branch are allowed", () => {
    expect(canTransition("self_review", "manager_assessment")).toBe(true);
    expect(canTransition("manager_assessment", "calibration")).toBe(true);
    expect(canTransition("calibration", "decision")).toBe(true);
    expect(canTransition("decision", "appeal")).toBe(true);
    expect(canTransition("decision", "closed")).toBe(true);
  });

  test("illegal transitions are rejected (no skipping, no going back)", () => {
    expect(canTransition("self_review", "decision")).toBe(false);
    expect(canTransition("calibration", "self_review")).toBe(false);
    expect(canTransition("closed", "appeal")).toBe(false);
  });

  test("state and rating guards", () => {
    expect(isReviewState("calibration")).toBe(true);
    expect(isReviewState("bogus")).toBe(false);
    expect(isReviewRating(4)).toBe(true);
    expect(isReviewRating(5)).toBe(false);
  });

  test("a decision completes only at two distinct sign-offs", () => {
    expect(isDecisionComplete(0)).toBe(false);
    expect(isDecisionComplete(1)).toBe(false);
    expect(isDecisionComplete(2)).toBe(true);
    expect(isDecisionComplete(3)).toBe(true);
  });

  test("P6 is triggered for ratings 1–2 only", () => {
    expect(isP6Triggered(1)).toBe(true);
    expect(isP6Triggered(2)).toBe(true);
    expect(isP6Triggered(3)).toBe(false);
    expect(isP6Triggered(4)).toBe(false);
    expect(isP6Triggered(undefined)).toBe(false);
  });
});

describe("compensation", () => {
  test("band position clamps to 0–100 and handles a degenerate band", () => {
    expect(bandPositionPct(50_000, 40_000, 60_000)).toBe(50);
    expect(bandPositionPct(30_000, 40_000, 60_000)).toBe(0);
    expect(bandPositionPct(70_000, 40_000, 60_000)).toBe(100);
    expect(bandPositionPct(50_000, 60_000, 60_000)).toBe(50);
  });

  test("band thirds split at 34 and 67", () => {
    expect(bandThird(10)).toBe("low");
    expect(bandThird(50)).toBe("mid");
    expect(bandThird(90)).toBe("high");
  });

  test("merit is guide-not-formula: low-in-band + top rating earns most; rating 1 nothing", () => {
    expect(meritIncreaseBp(4, 10)).toBeGreaterThan(meritIncreaseBp(4, 90));
    expect(meritIncreaseBp(4, 10)).toBeGreaterThan(meritIncreaseBp(3, 10));
    expect(meritIncreaseBp(1, 10)).toBe(0);
  });
});

describe("assessment gate", () => {
  const dim = (narrative: string, evidence: string) => ({ score: 3 as const, narrative, evidence });
  const fullDims = {
    impact: dim("n", "e"),
    ownership: dim("n", "e"),
    quality: dim("n", "e"),
    collaboration: dim("n", "e"),
    culture: dim("n", "e"),
  };

  const noPromo = { promoProposed: false, promoNote: "" };

  test("complete dims + rating submits; missing evidence blocks", () => {
    expect(
      canSubmitAssessment({ dims: fullDims, proposedRating: 3, ...noPromo, p6Acknowledged: false }),
    ).toBe(true);
    expect(
      canSubmitAssessment({
        dims: { ...fullDims, quality: dim("n", "  ") },
        proposedRating: 3,
        ...noPromo,
        p6Acknowledged: false,
      }),
    ).toBe(false);
    expect(
      canSubmitAssessment({ dims: {}, proposedRating: 3, ...noPromo, p6Acknowledged: false }),
    ).toBe(false);
    expect(
      canSubmitAssessment({
        dims: fullDims,
        proposedRating: undefined,
        ...noPromo,
        p6Acknowledged: false,
      }),
    ).toBe(false);
  });

  test("a low rating requires the P6 acknowledgment", () => {
    expect(
      canSubmitAssessment({ dims: fullDims, proposedRating: 2, ...noPromo, p6Acknowledged: false }),
    ).toBe(false);
    expect(
      canSubmitAssessment({ dims: fullDims, proposedRating: 2, ...noPromo, p6Acknowledged: true }),
    ).toBe(true);
  });

  test("a proposed promotion requires the promotion note", () => {
    expect(
      canSubmitAssessment({
        dims: fullDims,
        proposedRating: 3,
        promoProposed: true,
        promoNote: "  ",
        p6Acknowledged: false,
      }),
    ).toBe(false);
    expect(
      canSubmitAssessment({
        dims: fullDims,
        proposedRating: 3,
        promoProposed: true,
        promoNote: "L2 → L3 — owns the funnel end-to-end",
        p6Acknowledged: false,
      }),
    ).toBe(true);
  });
});

describe("peer input", () => {
  test("quota needs 2 submitted cross-team + own-team scaled to local team size; declines don't count", () => {
    const submitted = (kind: "lt" | "team" | "cross") => ({ kind, status: "submitted" as const });
    const declined = (kind: "lt" | "team" | "cross") => ({ kind, status: "declined" as const });
    const fullTeam = peerInputQuota(2);
    expect(
      isPeerQuotaMet(
        [submitted("cross"), submitted("cross"), submitted("team"), submitted("team")],
        fullTeam,
      ),
    ).toBe(true);
    expect(
      isPeerQuotaMet(
        [submitted("cross"), declined("cross"), submitted("team"), submitted("team")],
        fullTeam,
      ),
    ).toBe(false);
    expect(isPeerQuotaMet([], fullTeam)).toBe(false);
    // LT-tagged input is optional — it neither helps nor blocks
    expect(
      isPeerQuotaMet(
        [
          submitted("cross"),
          submitted("cross"),
          submitted("team"),
          submitted("team"),
          declined("lt"),
        ],
        fullTeam,
      ),
    ).toBe(true);
    const soloTeam = peerInputQuota(0);
    expect(isPeerQuotaMet([submitted("cross"), submitted("cross")], soloTeam)).toBe(true);
    expect(
      isPeerQuotaMet([submitted("cross"), submitted("team"), submitted("team")], soloTeam),
    ).toBe(false);
    const pairTeam = peerInputQuota(1);
    expect(
      isPeerQuotaMet([submitted("cross"), submitted("cross"), submitted("team")], pairTeam),
    ).toBe(true);
  });

  test("ownTeamPeerQuota caps at two and scales down for small local teams", () => {
    expect(ownTeamPeerQuota(0)).toBe(0);
    expect(ownTeamPeerQuota(1)).toBe(1);
    expect(ownTeamPeerQuota(2)).toBe(2);
    expect(ownTeamPeerQuota(5)).toBe(2);
  });
});

describe("appeals", () => {
  test("category guard rejects unknown values", () => {
    expect(isAppealCategory("rating")).toBe(true);
    expect(isAppealCategory("exception")).toBe(true);
    expect(isAppealCategory("promotion")).toBe(false);
  });

  test("an appeal is visible to the appellant and to HR admins, no one else", () => {
    expect(canSeeAppeal({ isSubject: true, canManageAppeals: false })).toBe(true);
    expect(canSeeAppeal({ isSubject: false, canManageAppeals: true })).toBe(true);
    expect(canSeeAppeal({ isSubject: false, canManageAppeals: false })).toBe(false);
  });

  test("filing is the subject's alone, within an open window, once", () => {
    const base = { isSubject: true, appealUntilMs: 2000, nowMs: 1000, alreadyFiled: false };
    expect(canFileAppealNow(base)).toBe(true);
    // not the subject
    expect(canFileAppealNow({ ...base, isSubject: false })).toBe(false);
    // window elapsed
    expect(canFileAppealNow({ ...base, nowMs: 3000 })).toBe(false);
    // never delivered (no clock)
    expect(canFileAppealNow({ ...base, appealUntilMs: undefined })).toBe(false);
    // already filed
    expect(canFileAppealNow({ ...base, alreadyFiled: true })).toBe(false);
    // exactly at the deadline still counts
    expect(canFileAppealNow({ ...base, nowMs: 2000 })).toBe(true);
  });
});

describe("checkInSubmitIssues", () => {
  const complete = {
    status: "on_track" as const,
    summary: Array.from({ length: 35 }, (_, index) => `word${index}`).join(" "),
    p1Confirmed: true,
    p1Note: "",
    promoFlag: false,
    promoNote: "",
    underperfFlag: false,
    underperfNote: "",
  };

  test("a complete filing passes", () => {
    expect(checkInSubmitIssues(complete)).toEqual([]);
  });

  test("status and a real summary are required", () => {
    expect(checkInSubmitIssues({ ...complete, status: undefined })).toHaveLength(1);
    expect(checkInSubmitIssues({ ...complete, summary: "too short" })).toHaveLength(1);
  });

  test("an unconfirmed P1 needs a note; flags need their substance", () => {
    expect(checkInSubmitIssues({ ...complete, p1Confirmed: false })).toHaveLength(1);
    expect(checkInSubmitIssues({ ...complete, p1Confirmed: false, p1Note: "new scope" })).toEqual(
      [],
    );
    expect(checkInSubmitIssues({ ...complete, promoFlag: true })).toHaveLength(1);
    expect(checkInSubmitIssues({ ...complete, promoFlag: true, promoNote: "meets 1-2" })).toEqual(
      [],
    );
    expect(
      checkInSubmitIssues({ ...complete, underperfFlag: true, underperfNote: "  " }),
    ).toHaveLength(1);
  });

  test("status guard rejects unknown values", () => {
    expect(isCheckInStatus("on_track")).toBe(true);
    expect(isCheckInStatus("paused")).toBe(false);
  });
});

describe("peerInputSubmitIssues", () => {
  test("all three witness questions are required; dimensions stay optional", () => {
    expect(
      peerInputSubmitIssues({ p_context: "weekly", p_keep: "clarity", p_improve: "delegate" }),
    ).toEqual([]);
    // dimensions alone do not satisfy the gate
    expect(peerInputSubmitIssues({ impact: "shipped the track" })).toHaveLength(3);
    // whitespace does not count as an answer
    expect(peerInputSubmitIssues({ p_context: "x", p_keep: "  ", p_improve: "y" })).toEqual([
      '"Keep doing" is required',
    ]);
  });
});
