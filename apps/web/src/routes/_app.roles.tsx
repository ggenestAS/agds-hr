import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import type { UserRole } from "@agds-hr/shared";

import { Button } from "../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { ASSIGNABLE_ROLES } from "../server/roles.shared.ts";
import type { RolesPageView } from "../server/roles.shared.ts";
import { grantRoleFn, revokeRoleFn, rolesPageFn } from "../server/roles.functions.ts";

// Role management: who is manager/founder/admin/developer, and how to change
// it. Developer-only (identity.role.grant) — the same gate the nav item and
// this route share, so there's no drift between "who sees the link" and "who
// can act". Roles decide review authority throughout the product: a person
// needs `manager` (or founder/developer) to appear as a reviewer on
// /peer-input, /assessment, and /calibration.
export const Route = createFileRoute("/_app/roles")({
  loader: () => rolesPageFn(),
  component: Roles,
});

const ROLE_LABEL: Record<(typeof ASSIGNABLE_ROLES)[number], string> = {
  manager: "Manager",
  founder: "Founder",
  admin: "Admin",
  developer: "Developer",
};

const ROLE_HINT: Record<(typeof ASSIGNABLE_ROLES)[number], string> = {
  manager: "review authority — opens cases, rates, requests peer input, runs assessments",
  founder: "leadership — calibration, dual sign-off, compensation, bands",
  admin: "HR admin — employee attributes, appeals queue",
  developer: "platform superuser — break-glass for every gate, including this page",
};

// "staff" can appear on a role row (dev-login grants it explicitly) but is
// never assignable/revokable from this page — it's the no-grant baseline.
const isAssignableRole = (role: UserRole): role is (typeof ASSIGNABLE_ROLES)[number] =>
  (ASSIGNABLE_ROLES as readonly UserRole[]).includes(role);

const roleChipCls = (role: UserRole): string =>
  role === "developer"
    ? "bg-ink-900 text-white"
    : role === "founder"
      ? "bg-[var(--color-accent)] text-white"
      : role === "admin"
        ? "bg-[#1e3a8a] text-white"
        : "bg-bone text-ink-700";

function Roles() {
  const data: RolesPageView = Route.useLoaderData();
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pickRole, setPickRole] = useState<Record<string, (typeof ASSIGNABLE_ROLES)[number]>>({});
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<(typeof ASSIGNABLE_ROLES)[number]>("manager");

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusyKey(key);
    try {
      await action();
      await router.invalidate();
    } finally {
      setBusyKey(null);
    }
  };

  const filtered = data.assignments.filter((assignment) => {
    const needle = query.trim().toLowerCase();
    if (needle === "") {
      return true;
    }
    return (
      assignment.name.toLowerCase().includes(needle) ||
      assignment.email.toLowerCase().includes(needle) ||
      (assignment.title ?? "").toLowerCase().includes(needle)
    );
  });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Access control · developer only
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Roles</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-700">
        Roles decide review authority throughout the cycle. Someone needs <strong>Manager</strong>{" "}
        (or Founder/Developer) to open cases, request peer input, run assessments, or appear in
        calibration as a reviewer. Every grant and revoke is recorded in the audit trail.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ASSIGNABLE_ROLES.map((role) => (
          <div key={role} className="rounded-[14px] border border-border bg-card p-3.5">
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${roleChipCls(role)}`}
            >
              {ROLE_LABEL[role]}
            </span>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{ROLE_HINT[role]}</p>
          </div>
        ))}
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Grant a role</CardTitle>
          <p className="text-sm text-muted-foreground">
            Works for anyone by email — provisions their account on first grant if they've never
            signed in.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-56 flex-1 text-xs">
              <span className="mb-1 block font-semibold text-ink-700">Email</span>
              <input
                value={addEmail}
                onChange={(event) => setAddEmail(event.target.value)}
                placeholder="name@albertschool.com"
                className="block w-full rounded-[10px] border border-border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
              />
            </label>
            <label className="text-xs">
              <span className="mb-1 block font-semibold text-ink-700">Role</span>
              <select
                value={addRole}
                onChange={(event) =>
                  setAddRole(event.target.value as (typeof ASSIGNABLE_ROLES)[number])
                }
                className="block rounded-[10px] border border-border bg-card px-2 py-1.5 text-sm"
              >
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              size="sm"
              disabled={busyKey !== null || addEmail.trim().length === 0}
              onClick={() => {
                const email = addEmail.trim().toLowerCase();
                void run(`add:${email}`, () =>
                  grantRoleFn({ data: { email, role: addRole } }).then(() => setAddEmail("")),
                );
              }}
            >
              Grant
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-5 overflow-hidden">
        <CardHeader>
          <div className="flex items-baseline justify-between gap-3">
            <CardTitle>Everyone with a role, plus the roster</CardTitle>
            <span className="text-xs tabular-nums text-muted-foreground">
              {filtered.length} of {data.assignments.length}
            </span>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, email, or title…"
            className="mt-2 block w-full rounded-[10px] border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        </CardHeader>
        <div className="divide-y divide-border">
          {filtered.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">No matches.</p>
          ) : (
            filtered.map((assignment) => {
              const key = assignment.userId ?? assignment.email;
              const chosen = pickRole[key] ?? "manager";
              const available = ASSIGNABLE_ROLES.filter((role) => !assignment.roles.includes(role));
              return (
                <div key={key} className="flex flex-wrap items-center gap-3 px-6 py-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">
                      {assignment.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {assignment.email}
                      {assignment.title !== undefined && ` · ${assignment.title}`}
                      {assignment.userId === undefined && " · not yet provisioned"}
                    </span>
                  </span>

                  <span className="flex flex-wrap gap-1.5">
                    {assignment.roles.length === 0 ? (
                      <span className="text-xs text-muted-foreground">staff (default)</span>
                    ) : (
                      assignment.roles.map((role) => (
                        <span
                          key={role}
                          className={`flex items-center gap-1.5 rounded-full py-0.5 pl-2.5 pr-1 text-[11px] font-bold ${roleChipCls(role)}`}
                        >
                          {role}
                          {assignment.userId !== undefined && isAssignableRole(role) && (
                            <button
                              type="button"
                              disabled={busyKey !== null}
                              title={`Revoke ${role}`}
                              onClick={() => {
                                const userId = assignment.userId!;
                                void run(`revoke:${userId}:${role}`, () =>
                                  revokeRoleFn({ data: { userId, role } }),
                                );
                              }}
                              className="flex size-3.5 items-center justify-center rounded-full bg-black/15 text-[9px] leading-none hover:bg-black/25"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))
                    )}
                  </span>

                  {available.length > 0 && (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <select
                        value={chosen}
                        onChange={(event) =>
                          setPickRole((prev) => ({
                            ...prev,
                            [key]: event.target.value as (typeof ASSIGNABLE_ROLES)[number],
                          }))
                        }
                        className="rounded-[10px] border border-border bg-card px-2 py-1 text-xs"
                      >
                        {available.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABEL[role]}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busyKey !== null}
                        onClick={() => {
                          void run(`grant:${key}:${chosen}`, () =>
                            grantRoleFn({ data: { email: assignment.email, role: chosen } }),
                          );
                        }}
                      >
                        + Add
                      </Button>
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
