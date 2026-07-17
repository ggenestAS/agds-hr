# Peer cancel protect — design

Date: 2026-07-17  
Status: approved (approach A)

## Problem

On `/peer-input`, a manager can **Reopen** a submitted peer request (`submitted` → `pending`, input kept), then click **Cancel**. Cancel hard-deletes pending rows. Managers who mean “undo reopen” destroy the reviewer’s written input. Audit events do not store the text; there is no restore API.

## Goal

Fail closed: never delete a peer request that still carries answer text. Keep cancel as hard-delete only for never-answered pending requests. Clarify UI so Withdraw is not mistaken for undo-reopen.

## Non-goals

- Soft-delete / `cancelled` status
- Restore API or ops undelete tooling
- Changing reopen semantics
- Schema / migration

## Domain

In `cancelPeerRequest` (`packages/domains/people/src/peer-input.ts`):

1. Load `status` and `input` (existing path already loads status + requestee).
2. Keep existing guards: missing → `NotFoundError`; not `pending` → `ConflictError("peer_request_not_pending")`.
3. **New guard:** if `input` has any key whose string value is non-empty after trim, throw `ConflictError("peer_request_has_input")` and do not delete.
4. Otherwise delete + audit `people.peer.cancelled` as today.

Empty `{}` / all-blank values count as unanswered (withdraw allowed). Reopen-after-submit always leaves prior answers, so withdraw is refused.

## UI (`/_app/peer-input`)

For `pending` requests on the manager team list:

| Before                   | After                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button label **Cancel**  | **Withdraw request**                                                                                                                                           |
| Immediate `peerCancelFn` | `window.confirm` first: withdrawing removes the request; it stops blocking assessment; the person can be re-requested later. If they confirm, call the server. |
| Tooltip about withdraw   | Same intent; mention that answered / reopened-with-answers requests cannot be withdrawn                                                                        |

On `conflict: peer_request_has_input` (and preferably other cancel failures): surface a page-level error string via the existing `run` helper (catch + set state), e.g. that this request still has the reviewer’s answers after reopen — leave it pending for edit/resubmit; withdraw is unavailable.

No new dialog component library — `window.confirm` matches current stack (no confirm/dialog usage yet).

## Tests

Integration (`peer-input.test.ts`), same suite as cancel today:

1. **Existing:** cancel never-answered pending → delete, audit, slot freed (unchanged).
2. **Existing:** cancel while `submitted` → conflict (unchanged).
3. **New:** submit → reopen → cancel → throws `ConflictError` with reason `peer_request_has_input`; row still exists with `pending` and input preserved.

## Files

- `packages/domains/people/src/peer-input.ts` — guard
- `packages/domains/people/src/peer-input.test.ts` — new case
- `apps/web/src/routes/_app.peer-input.tsx` — label, confirm, error surfacing
- Comment at top of peer-input route (cancel → withdraw unanswered only)

## Success

Angelo’s sequence (Reopen then Cancel/Withdraw) cannot wipe Henry’s text. Never-answered withdrawals still work. Copy makes “remove unanswered request” the clear meaning.
