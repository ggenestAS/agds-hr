import { describe, expect, test } from "bun:test";

import {
  EMAIL_FROM_ADDRESS,
  isEmailDryRun,
  isResendConfigured,
  RESEND_API_URL,
  sendTransactional,
} from "./client.ts";

const message = { to: "who@albertschool.com", subject: "Hello", text: "Body" };

type FetchCall = { readonly url: string; readonly init: RequestInit | undefined };

// A typed fetch fake capturing calls; body/status configurable per test.
const fakeFetch = (calls: FetchCall[], response: () => Response): typeof fetch => {
  const impl = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    calls.push({ url: input instanceof Request ? input.url : input.toString(), init });
    return Promise.resolve(response());
  };
  return impl as typeof fetch;
};

describe("resend client", () => {
  test("isResendConfigured reflects the key; empty string reads as unset", () => {
    expect(isResendConfigured({})).toBe(false);
    expect(isResendConfigured({ RESEND_API_KEY: "" })).toBe(false);
    expect(isResendConfigured({ RESEND_API_KEY: "re_x" })).toBe(true);
  });

  test("dry-run unless EMAIL_DRY_RUN is explicitly 'false' (fail closed)", () => {
    expect(isEmailDryRun({})).toBe(true);
    expect(isEmailDryRun({ EMAIL_DRY_RUN: "true" })).toBe(true);
    expect(isEmailDryRun({ EMAIL_DRY_RUN: "0" })).toBe(true);
    expect(isEmailDryRun({ EMAIL_DRY_RUN: "false" })).toBe(false);
  });

  test("dry-run never touches the network", async () => {
    const calls: FetchCall[] = [];
    const result = await sendTransactional(message, {
      env: {},
      fetchImpl: fakeFetch(calls, () => new Response("{}")),
    });
    expect(result).toEqual({ id: undefined, dryRun: true });
    expect(calls).toHaveLength(0);
  });

  test("live path posts the message with the pinned from-address", async () => {
    const calls: FetchCall[] = [];
    const result = await sendTransactional(message, {
      env: { RESEND_API_KEY: "re_x", EMAIL_DRY_RUN: "false" },
      fetchImpl: fakeFetch(
        calls,
        () => new Response(JSON.stringify({ id: "email-1" }), { status: 200 }),
      ),
    });
    expect(result).toEqual({ id: "email-1", dryRun: false });

    const call = calls[0];
    expect(call?.url).toBe(RESEND_API_URL);
    const body = JSON.parse(call?.init?.body as string) as Record<string, unknown>;
    expect(body.from).toBe(EMAIL_FROM_ADDRESS);
    expect(body.to).toEqual(["who@albertschool.com"]);
    expect(body.subject).toBe("Hello");
    expect((call?.init?.headers as Record<string, string>).Authorization).toBe("Bearer re_x");
  });

  test("non-2xx throws resend_send_failed with the status", () => {
    const calls: FetchCall[] = [];
    expect(
      sendTransactional(message, {
        env: { RESEND_API_KEY: "re_x", EMAIL_DRY_RUN: "false" },
        fetchImpl: fakeFetch(calls, () => new Response("nope", { status: 422 })),
      }),
    ).rejects.toThrow("resend_send_failed: 422");
  });

  test("live send without a key throws resend_not_configured", () => {
    expect(sendTransactional(message, { env: { EMAIL_DRY_RUN: "false" } })).rejects.toThrow(
      "resend_not_configured",
    );
  });
});
