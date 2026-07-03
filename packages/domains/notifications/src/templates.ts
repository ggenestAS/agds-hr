// Email rendering for outbox kinds — plain, factual text (spec: HTML polish is
// deferred). Rendering happens at SEND time from the stored payload, so copy
// fixes apply to still-pending rows. An unknown kind THROWS: fail closed — a
// row we cannot render stays pending and surfaces through its attempt count
// rather than going out half-baked.

// The production hostname is pinned in code like the auth trusted origins —
// the code is the system of record; an env-configured base URL drifts.
export const APP_BASE_URL = "https://hr.albertschool.com";

export type RenderedNotification = {
  readonly subject: string;
  readonly text: string;
};

// Digest item lines, keyed by obligation kind (people/obligations.ts). Open
// string keys here: templates must render any payload the digest job stored,
// including kinds added later.
const DIGEST_ITEM_LINES: Record<string, (subjectEmail: string) => string> = {
  self_review_pending: () => "Your self-review has not been submitted yet.",
  peer_input_pending: (subjectEmail) =>
    `A peer input request about ${subjectEmail} is waiting for your answer.`,
  peer_quota_unmet: (subjectEmail) =>
    `The peer-input quota for ${subjectEmail}'s review is not met yet.`,
  assessment_pending: (subjectEmail) =>
    `The manager assessment for ${subjectEmail} has not been submitted.`,
  sign_off_pending: (subjectEmail) => `${subjectEmail}'s decision is waiting for founder sign-off.`,
};

const digestItemLine = (item: { readonly kind: string; readonly subjectEmail: string }): string => {
  const line = DIGEST_ITEM_LINES[item.kind];
  return line === undefined ? `${item.kind}: ${item.subjectEmail}` : line(item.subjectEmail);
};

type DigestItem = { readonly kind: string; readonly subjectEmail: string };

const asDigestItems = (payload: Record<string, unknown>): readonly DigestItem[] =>
  Array.isArray(payload.items) ? (payload.items as readonly DigestItem[]) : [];

const stringField = (payload: Record<string, unknown>, key: string, fallback: string): string => {
  const value = payload[key];
  return typeof value === "string" ? value : fallback;
};

export function renderNotification(
  kind: string,
  payload: Record<string, unknown>,
): RenderedNotification {
  switch (kind) {
    case "peer_request.created": {
      const subjectEmail = stringField(payload, "subjectEmail", "a colleague");
      return {
        subject: `Peer input requested: ${subjectEmail}`,
        text: [
          `You have been asked to give peer input on ${subjectEmail}'s annual review.`,
          `Answer (or decline with a reason) here: ${APP_BASE_URL}/peer-input`,
        ].join("\n\n"),
      };
    }
    case "assessment.ready": {
      const subjectEmail = stringField(payload, "subjectEmail", "your report");
      const caseId = stringField(payload, "caseId", "");
      return {
        subject: `Ready for assessment: ${subjectEmail}`,
        text: [
          `${subjectEmail}'s review has reached the manager-assessment stage — the self-review and peer inputs are in.`,
          `Write the assessment here: ${APP_BASE_URL}/assessment/${caseId}`,
        ].join("\n\n"),
      };
    }
    case "digest.individual": {
      const items = asDigestItems(payload);
      return {
        subject: `Review cycle: ${items.length} pending action${items.length === 1 ? "" : "s"}`,
        text: [
          "Your open review-cycle actions:",
          ...items.map((item) => `- ${digestItemLine(item)}`),
          `Start here: ${APP_BASE_URL}/dashboard`,
        ].join("\n"),
      };
    }
    case "digest.manager": {
      const items = asDigestItems(payload);
      return {
        subject: `Review cycle: ${items.length} open item${items.length === 1 ? "" : "s"} in your team`,
        text: [
          "Open review-cycle items among your reports:",
          ...items.map((item) => `- ${digestItemLine(item)}`),
          `Track them here: ${APP_BASE_URL}/tracking`,
        ].join("\n"),
      };
    }
    case "digest.hr": {
      const total = Number(payload.total ?? 0);
      const counts = (payload.counts ?? {}) as Record<string, number>;
      return {
        subject: `Review cycle: ${total} open obligation${total === 1 ? "" : "s"} org-wide`,
        text: [
          "Open obligations across the cycle:",
          ...Object.entries(counts).map(([kindKey, count]) => `- ${kindKey}: ${count}`),
          `Full board: ${APP_BASE_URL}/tracking`,
        ].join("\n"),
      };
    }
    default:
      throw new Error(`unknown_notification_kind: ${kind}`);
  }
}
