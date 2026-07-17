# Peer cancel protect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refuse cancel/withdraw when a pending peer request still has answer text (reopen-after-submit trap); clarify manager UI.

**Architecture:** Domain fail-closed guard in `cancelPeerRequest` before DELETE; UI relabel + `window.confirm` + surface `conflict: peer_request_has_input`. No schema change.

**Tech Stack:** Bun tests, Drizzle, TanStack Router peer-input page.

## Global Constraints

- Errors: `ConflictError("peer_request_has_input")` → message `conflict: peer_request_has_input`
- Has input: any jsonb string value non-empty after trim
- Cancel of empty pending still hard-deletes + audits
- No soft-delete status; no restore API

---

### Task 1: Domain guard + integration test

**Files:**

- Modify: `packages/domains/people/src/peer-input.ts` (`cancelPeerRequest`)
- Modify: `packages/domains/people/src/peer-input.test.ts`

**Interfaces:**

- Consumes: `submitPeerInput`, `reopenPeerRequest`, `cancelPeerRequest`
- Produces: cancel throws when input present after reopen

- [x] **Step 1:** Add failing test: submit → reopen → cancel → `ConflictError` / `peer_request_has_input`; row remains pending with input
- [x] **Step 2:** Unit helper tests for `peerRequestHasAnswerText` (integration skipped without `AGDS_HR_TEST_DB=1`)
- [x] **Step 3:** In `cancelPeerRequest`, select `input`; if any trimmed non-empty string value, throw `ConflictError("peer_request_has_input")`
- [x] **Step 4:** Unit tests green

### Task 2: Manager UI

**Files:**

- Modify: `apps/web/src/routes/_app.peer-input.tsx`

- [x] **Step 1:** Relabel Cancel → Withdraw request; confirm before `peerCancelFn`
- [x] **Step 2:** Catch cancel errors in `run`; show `peer_request_has_input` friendly copy
- [x] **Step 3:** Update file header comment (withdraw unanswered only)

### Task 3: Verify

- [x] **Step 1:** Unit tests for helper pass; integration tests present (need test-db sentinel)
- [ ] **Step 2:** Manual smoke: reopen then withdraw shows error / no delete
