import { describe, expect, test } from "bun:test";

import { APP_BASE_URL, renderNotification } from "./templates.ts";

describe("renderNotification", () => {
  test("peer_request.created names the subject and links to /peer-input", () => {
    const rendered = renderNotification("peer_request.created", {
      subjectEmail: "someone@albertschool.com",
      caseId: "case-1",
    });
    expect(rendered.subject).toContain("someone@albertschool.com");
    expect(rendered.text).toContain(`${APP_BASE_URL}/peer-input`);
  });

  test("assessment.ready deep-links to the case's assessment page", () => {
    const rendered = renderNotification("assessment.ready", {
      subjectEmail: "report@albertschool.com",
      caseId: "case-42",
    });
    expect(rendered.subject).toContain("report@albertschool.com");
    expect(rendered.text).toContain(`${APP_BASE_URL}/assessment/case-42`);
  });

  test("digest.individual lists one line per item and links to the dashboard", () => {
    const rendered = renderNotification("digest.individual", {
      items: [
        { kind: "self_review_pending", subjectEmail: "me@albertschool.com" },
        { kind: "peer_input_pending", subjectEmail: "colleague@albertschool.com" },
      ],
    });
    expect(rendered.subject).toContain("2 pending actions");
    expect(rendered.text).toContain("self-review has not been submitted");
    expect(rendered.text).toContain("colleague@albertschool.com");
    expect(rendered.text).toContain(`${APP_BASE_URL}/dashboard`);
  });

  test("digest.manager links to the tracking board", () => {
    const rendered = renderNotification("digest.manager", {
      items: [{ kind: "assessment_pending", subjectEmail: "report@albertschool.com" }],
    });
    expect(rendered.subject).toContain("1 open item in your team");
    expect(rendered.text).toContain(`${APP_BASE_URL}/tracking`);
  });

  test("digest.hr renders counts by kind", () => {
    const rendered = renderNotification("digest.hr", {
      total: 3,
      counts: { self_review_pending: 2, assessment_pending: 1 },
    });
    expect(rendered.subject).toContain("3 open obligations");
    expect(rendered.text).toContain("self_review_pending: 2");
    expect(rendered.text).toContain("assessment_pending: 1");
  });

  test("an unknown digest item kind still renders a factual fallback line", () => {
    const rendered = renderNotification("digest.individual", {
      items: [{ kind: "future_kind", subjectEmail: "x@albertschool.com" }],
    });
    expect(rendered.text).toContain("future_kind: x@albertschool.com");
  });

  test("an unknown notification kind throws (fail closed)", () => {
    expect(() => renderNotification("nope.nope", {})).toThrow(
      "unknown_notification_kind: nope.nope",
    );
  });
});
