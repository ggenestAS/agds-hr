import { describe, expect, test } from "bun:test";

import { computeObligations, type ObligationCaseInput } from "./obligations.ts";

const baseCase = (overrides: Partial<ObligationCaseInput>): ObligationCaseInput => ({
  caseId: "case-1",
  subjectEmail: "Subject@albertschool.com",
  cyclePeriod: "2026",
  state: "self_review",
  decided: false,
  caseCreatedAt: new Date("2026-07-01T00:00:00Z"),
  selfSubmittedAt: undefined,
  peerRequests: [],
  peerQuota: { cross: 2 },
  assessmentSubmittedAt: undefined,
  signoffCount: 0,
  managerEmails: ["manager@albertschool.com"],
  ...overrides,
});

describe("computeObligations", () => {
  test("unsubmitted self-review yields self_review_pending owned by the subject", () => {
    const obligations = computeObligations([baseCase({})], []);
    expect(obligations).toEqual([
      {
        kind: "self_review_pending",
        ownerEmail: "subject@albertschool.com",
        subjectEmail: "subject@albertschool.com",
        caseId: "case-1",
        cyclePeriod: "2026",
        openSince: new Date("2026-07-01T00:00:00Z"),
      },
    ]);
  });

  test("submitted self-review in self_review state yields nothing for the subject", () => {
    const obligations = computeObligations(
      [baseCase({ selfSubmittedAt: new Date("2026-07-02T00:00:00Z") })],
      [],
    );
    expect(obligations).toEqual([]);
  });

  test("each pending peer request yields peer_input_pending owned by the requestee", () => {
    const requestedAt = new Date("2026-07-02T00:00:00Z");
    const obligations = computeObligations(
      [
        baseCase({
          state: "peer_input",
          selfSubmittedAt: new Date("2026-07-01T12:00:00Z"),
          peerRequests: [
            {
              requesteeEmail: "Peer-A@albertschool.com",
              kind: "cross",
              status: "pending",
              createdAt: requestedAt,
            },
            {
              requesteeEmail: "peer-b@albertschool.com",
              kind: "cross",
              status: "submitted",
              createdAt: requestedAt,
            },
            {
              requesteeEmail: "peer-c@albertschool.com",
              kind: "cross",
              status: "declined",
              createdAt: requestedAt,
            },
          ],
          peerQuota: { cross: 1 },
        }),
      ],
      [],
    );
    const peerPending = obligations.filter((entry) => entry.kind === "peer_input_pending");
    expect(peerPending).toEqual([
      {
        kind: "peer_input_pending",
        ownerEmail: "peer-a@albertschool.com",
        subjectEmail: "subject@albertschool.com",
        caseId: "case-1",
        cyclePeriod: "2026",
        openSince: requestedAt,
      },
    ]);
    // Quota met (1 cross submitted) — no peer_quota_unmet rows.
    expect(obligations.some((entry) => entry.kind === "peer_quota_unmet")).toBe(false);
  });

  test("unmet peer quota in peer_input yields peer_quota_unmet for subject and managers", () => {
    const obligations = computeObligations(
      [
        baseCase({
          state: "peer_input",
          selfSubmittedAt: new Date("2026-07-01T12:00:00Z"),
          peerRequests: [],
          peerQuota: { cross: 2 },
          managerEmails: ["Manager@albertschool.com"],
        }),
      ],
      [],
    );
    const owners = obligations
      .filter((entry) => entry.kind === "peer_quota_unmet")
      .map((entry) => entry.ownerEmail);
    expect(owners).toEqual(["subject@albertschool.com", "manager@albertschool.com"]);
  });

  test("manager_assessment without a submitted assessment yields assessment_pending per manager", () => {
    const obligations = computeObligations(
      [
        baseCase({
          state: "manager_assessment",
          selfSubmittedAt: new Date("2026-07-01T12:00:00Z"),
          managerEmails: ["m1@albertschool.com", "m2@albertschool.com"],
        }),
      ],
      [],
    );
    expect(obligations).toHaveLength(2);
    expect(obligations.map((entry) => entry.ownerEmail)).toEqual([
      "m1@albertschool.com",
      "m2@albertschool.com",
    ]);
    expect(obligations.every((entry) => entry.kind === "assessment_pending")).toBe(true);
  });

  test("submitted assessment in manager_assessment yields nothing", () => {
    const obligations = computeObligations(
      [
        baseCase({
          state: "manager_assessment",
          selfSubmittedAt: new Date("2026-07-01T12:00:00Z"),
          assessmentSubmittedAt: new Date("2026-07-05T00:00:00Z"),
        }),
      ],
      [],
    );
    expect(obligations).toEqual([]);
  });

  test("decision below two sign-offs yields sign_off_pending per founder", () => {
    const obligations = computeObligations(
      [baseCase({ state: "decision", selfSubmittedAt: new Date(), signoffCount: 1 })],
      ["Founder-A@albertschool.com", "founder-b@albertschool.com"],
    );
    expect(obligations.map((entry) => [entry.kind, entry.ownerEmail])).toEqual([
      ["sign_off_pending", "founder-a@albertschool.com"],
      ["sign_off_pending", "founder-b@albertschool.com"],
    ]);
  });

  test("decided and closed cases yield nothing at all", () => {
    const obligations = computeObligations(
      [
        baseCase({
          decided: true,
          state: "decision",
          signoffCount: 0,
          peerRequests: [
            {
              requesteeEmail: "peer@albertschool.com",
              kind: "cross",
              status: "pending",
              createdAt: new Date(),
            },
          ],
        }),
        baseCase({ caseId: "case-2", state: "closed" }),
      ],
      ["founder@albertschool.com"],
    );
    expect(obligations).toEqual([]);
  });

  test("calibration state yields no obligations (leadership cadence, not a chase)", () => {
    const obligations = computeObligations(
      [baseCase({ state: "calibration", selfSubmittedAt: new Date() })],
      ["founder@albertschool.com"],
    );
    expect(obligations).toEqual([]);
  });
});
