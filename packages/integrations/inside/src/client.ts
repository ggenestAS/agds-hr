import { readOptional, type EnvSource } from "@agds-hr/env";

// Thin, domain-agnostic client for the Albert Inside API (albert-database-admin)
// — docs/integrations/albert-inside-api-admin-and-organigram.md, §8.3. Reads its
// own credential from env, raw fetch, injectable for tests. The service API key
// goes in the X-API-Key header and resolves to a synthetic ADMIN caller, which
// the user-directory endpoint accepts.
export const INSIDE_BASE_URL = "https://api-inside.albertschool.com";

export function isInsideConfigured(env: EnvSource = process.env): boolean {
  return readOptional("INSIDE_API_KEY", env) !== undefined;
}

// Display-ready admin staff, mapped from GET /user/user-directory?role=ADMIN.
export type InsideAdmin = {
  readonly userId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly title: string | undefined;
  readonly campus: string | undefined;
  readonly country: string | undefined;
  readonly functionalManagerName: string | undefined;
  readonly active: boolean;
};

type RawUser = {
  readonly user_id: string;
  readonly first_name: string;
  readonly last_name: string;
  readonly school_email: string;
  readonly title?: string | null;
  readonly campus_name?: string | null;
  readonly country?: string | null;
  readonly functional_manager_name?: string | null;
  readonly active?: boolean;
};

export type ListAdminDirectoryOptions = {
  readonly env?: EnvSource;
  readonly fetchImpl?: typeof fetch;
  readonly baseUrl?: string;
  readonly limit?: number;
};

export async function listAdminDirectory(
  options: ListAdminDirectoryOptions = {},
): Promise<readonly InsideAdmin[]> {
  const env = options.env ?? process.env;
  const apiKey = readOptional("INSIDE_API_KEY", env);
  if (apiKey === undefined) {
    throw new Error("inside_not_configured: INSIDE_API_KEY is unset (see .env.example)");
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? INSIDE_BASE_URL;
  const limit = options.limit ?? 1000;

  const response = await fetchImpl(`${baseUrl}/user/user-directory?role=ADMIN&limit=${limit}`, {
    headers: { "X-API-Key": apiKey },
  });
  if (!response.ok) {
    throw new Error(`inside_request_failed: user-directory returned ${response.status}`);
  }
  const body = (await response.json()) as { readonly users?: readonly RawUser[] };

  return (body.users ?? []).map((raw) => ({
    userId: raw.user_id,
    firstName: raw.first_name,
    lastName: raw.last_name,
    email: raw.school_email,
    title: raw.title ?? undefined,
    campus: raw.campus_name ?? undefined,
    country: raw.country ?? undefined,
    functionalManagerName: raw.functional_manager_name ?? undefined,
    active: raw.active ?? true,
  }));
}
