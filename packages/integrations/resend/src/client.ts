import { readOptional, type EnvSource } from "@agds-hr/env";

// Thin, domain-agnostic Resend client (§8.3): reads its own credential from
// env, raw fetch over the SDK, injectable for tests, and a fail-closed dry-run
// mode — email goes out ONLY when EMAIL_DRY_RUN is explicitly "false"
// (production sets it; every other environment defaults to dry-run, so a dev
// worktree pointed at real data can never mail real people).
export const RESEND_API_URL = "https://api.resend.com/emails";

// The verified sender. Pinned in code (the code is the system of record);
// changing it means re-verifying the domain in Resend — a deliberate act.
export const EMAIL_FROM_ADDRESS = "Albert People <people@albertschool.com>";

// Workers outbound fetch has no default timeout; a slow Resend response would
// stall the drain job past its cron window. Fail fast — the row retries.
const RESEND_FETCH_TIMEOUT_MS = 10_000;

export function isResendConfigured(env: EnvSource = process.env): boolean {
  return readOptional("RESEND_API_KEY", env) !== undefined;
}

export function isEmailDryRun(env: EnvSource = process.env): boolean {
  return readOptional("EMAIL_DRY_RUN", env) !== "false";
}

export type SendTransactionalInput = {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
};

export type SendTransactionalOptions = {
  readonly env?: EnvSource;
  readonly fetchImpl?: typeof fetch;
};

export type SendTransactionalResult = {
  readonly id: string | undefined;
  readonly dryRun: boolean;
};

export async function sendTransactional(
  input: SendTransactionalInput,
  options: SendTransactionalOptions = {},
): Promise<SendTransactionalResult> {
  const env = options.env ?? process.env;
  if (isEmailDryRun(env)) {
    console.log(`[email dry-run] to=${input.to} subject=${JSON.stringify(input.subject)}`);
    return { id: undefined, dryRun: true };
  }
  const apiKey = readOptional("RESEND_API_KEY", env);
  if (apiKey === undefined) {
    throw new Error("resend_not_configured: RESEND_API_KEY is unset (see .env.example)");
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM_ADDRESS,
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
    signal: AbortSignal.timeout(RESEND_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`resend_send_failed: ${response.status}`);
  }
  const body = (await response.json()) as { readonly id?: string };
  return { id: body.id, dryRun: false };
}
