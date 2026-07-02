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

// A flat org-tree node — the client builds the hierarchy by joining on manager
// user ids. GET /officer/org-tree accepts the service API key (active staff with
// an officer record).
export type OrgNode = {
  readonly userId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly title: string | undefined;
  readonly functionalManagerUserId: string | undefined;
};

type RawOrgNode = {
  readonly user_id: string;
  readonly first_name: string;
  readonly last_name: string;
  readonly title?: string | null;
  readonly functional_manager_user_id?: string | null;
};

export async function listOrgTree(
  options: Omit<ListAdminDirectoryOptions, "limit"> = {},
): Promise<readonly OrgNode[]> {
  const env = options.env ?? process.env;
  const apiKey = readOptional("INSIDE_API_KEY", env);
  if (apiKey === undefined) {
    throw new Error("inside_not_configured: INSIDE_API_KEY is unset (see .env.example)");
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? INSIDE_BASE_URL;

  const response = await fetchImpl(`${baseUrl}/officer/org-tree`, {
    headers: { "X-API-Key": apiKey },
  });
  if (!response.ok) {
    throw new Error(`inside_request_failed: org-tree returned ${response.status}`);
  }
  const rows = (await response.json()) as readonly RawOrgNode[];
  return rows.map((raw) => ({
    userId: raw.user_id,
    firstName: raw.first_name,
    lastName: raw.last_name,
    title: raw.title ?? undefined,
    functionalManagerUserId: raw.functional_manager_user_id ?? undefined,
  }));
}

// Pure: the ordered functional management chain for a user (immediate manager
// first, up to the top). Cycle-guarded and depth-capped, matching the server's
// max_depth = 10.
export function managementChain(nodes: readonly OrgNode[], userId: string): readonly OrgNode[] {
  const byId = new Map(nodes.map((node) => [node.userId, node]));
  const chain: OrgNode[] = [];
  const seen = new Set<string>([userId]);
  let next = byId.get(userId)?.functionalManagerUserId;
  while (next !== undefined && !seen.has(next) && chain.length < 10) {
    const node = byId.get(next);
    if (node === undefined) {
      break;
    }
    chain.push(node);
    seen.add(next);
    next = node.functionalManagerUserId;
  }
  return chain;
}
