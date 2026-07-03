import {
  isPeerQuotaMet,
  type PeerKind,
  type PeerRequestStatus,
  type ReviewState,
} from "./types.ts";

// The single brain for "who still has to do what" (docs/plans/notifications.md,
// ADR 2026-07-04-notifications-and-cycle-tracking): obligations are DERIVED
// from case state, never stored, so they cannot drift from the flow that
// discharges them. Consumed by the tracking board, the dashboard pending
// block, and the weekly digest job. Pure — callers assemble inputs from the
// DALs and the org graph.
export const OBLIGATION_KINDS = [
  "self_review_pending",
  "peer_input_pending",
  "peer_quota_unmet",
  "assessment_pending",
  "sign_off_pending",
] as const;
export type ObligationKind = (typeof OBLIGATION_KINDS)[number];

export type Obligation = {
  readonly kind: ObligationKind;
  // Who must act (lowercase email). Distinct from the case subject: peer
  // requestees, managers, and founders all own obligations on someone
  // else's case.
  readonly ownerEmail: string;
  readonly subjectEmail: string;
  readonly caseId: string;
  readonly cyclePeriod: string;
  readonly openSince: Date | undefined;
};

export type ObligationCaseInput = {
  readonly caseId: string;
  readonly subjectEmail: string;
  readonly cyclePeriod: string;
  readonly state: ReviewState;
  readonly decided: boolean;
  readonly caseCreatedAt: Date | undefined;
  readonly selfSubmittedAt: Date | undefined;
  readonly peerRequests: readonly {
    readonly requesteeEmail: string;
    readonly kind: PeerKind;
    readonly status: PeerRequestStatus;
    readonly createdAt: Date;
  }[];
  readonly peerQuota: Readonly<Partial<Record<PeerKind, number>>>;
  readonly assessmentSubmittedAt: Date | undefined;
  readonly signoffCount: number;
  // The subject's direct managers, both reporting lines.
  readonly managerEmails: readonly string[];
};

// Sign-off needs two DISTINCT founders (REVIEW_SIGNOFFS_REQUIRED); founders
// are passed in because the founder set lives in identity, not people.
// Calibration deliberately emits nothing: it is a leadership meeting cadence,
// not an individual's overdue item — chasing it by email would be noise.
export function computeObligations(
  cases: readonly ObligationCaseInput[],
  founderEmails: readonly string[],
): readonly Obligation[] {
  const obligations: Obligation[] = [];
  for (const entry of cases) {
    if (entry.decided || entry.state === "closed") {
      continue;
    }
    const subjectEmail = entry.subjectEmail.toLowerCase();
    const base = {
      subjectEmail,
      caseId: entry.caseId,
      cyclePeriod: entry.cyclePeriod,
    };

    if (entry.state === "self_review" && entry.selfSubmittedAt === undefined) {
      obligations.push({
        kind: "self_review_pending",
        ownerEmail: subjectEmail,
        openSince: entry.caseCreatedAt,
        ...base,
      });
    }

    for (const request of entry.peerRequests) {
      if (request.status === "pending") {
        obligations.push({
          kind: "peer_input_pending",
          ownerEmail: request.requesteeEmail.toLowerCase(),
          openSince: request.createdAt,
          ...base,
        });
      }
    }

    if (entry.state === "peer_input" && !isPeerQuotaMet(entry.peerRequests, entry.peerQuota)) {
      const owners = [subjectEmail, ...entry.managerEmails.map((email) => email.toLowerCase())];
      for (const ownerEmail of owners) {
        obligations.push({
          kind: "peer_quota_unmet",
          ownerEmail,
          openSince: entry.caseCreatedAt,
          ...base,
        });
      }
    }

    if (entry.state === "manager_assessment" && entry.assessmentSubmittedAt === undefined) {
      for (const managerEmail of entry.managerEmails) {
        obligations.push({
          kind: "assessment_pending",
          ownerEmail: managerEmail.toLowerCase(),
          openSince: entry.caseCreatedAt,
          ...base,
        });
      }
    }

    if (entry.state === "decision" && entry.signoffCount < 2) {
      for (const founderEmail of founderEmails) {
        obligations.push({
          kind: "sign_off_pending",
          ownerEmail: founderEmail.toLowerCase(),
          openSince: entry.caseCreatedAt,
          ...base,
        });
      }
    }
  }
  return obligations;
}
