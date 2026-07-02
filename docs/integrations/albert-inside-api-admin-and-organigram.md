# Albert Inside API — admin users & organigram

Reference for calling **albert-database-admin** (the FastAPI backend behind Inside Albert
School) from agds-hr or other integrations. Source repo:
`~/code-scripts/albert-database/albert-database-admin`.

## Overview

| Item | Value |
| --- | --- |
| Stack | FastAPI + SQLAlchemy + PostgreSQL (Supabase) |
| Local base URL | `http://localhost:8000` (`python run.py`, port from `PORT`, default 8000) |
| Production base URL | `https://api-inside.albertschool.com` |
| Staging base URL | `https://api-admission-staging.albertschool.com` |
| Health check | `GET /health` (no auth) |
| Interactive docs | `GET /docs` and `GET /redoc` (HTTP Basic: user `admin`, password from `DOCUMENTATION_PASSWORD`) |
| Route catalogue | `albert-database-admin/api_docs_output.md` (265+ GET endpoints) |

Routers are mounted under path prefixes in `app/main.py`. User routes live under
`/user`, officer (staff / org) routes under `/officer`, keystone migration routes
under `/keystone`.

## Terminology

Inside Albert School uses two related concepts that map to “admin” in everyday
language:

1. **`User.role = "ADMIN"`** — login role for school staff in the admin UI.
2. **`Officer`** — the HR/org record attached to an admin user (`academic.officer`
   table). Holds title, campus, and **manager links** used for the organigram.

Not every `ADMIN` user is guaranteed to have an `Officer` row, but staff listed in
the organigram always do. Officer-specific fields (title, managers, campus) come from
the `Officer` join, not from `User` alone.

Accountants (`role = "ACCOUNTANT"`) can read the org tree but are excluded from the
user directory listing.

## Authentication

All protected endpoints require one of:

| Method | Header | Notes |
| --- | --- | --- |
| **Supabase JWT** | `Authorization: Bearer <access_token>` | Normal Inside login (Google OAuth or admin magic link). Email in JWT is matched to `admin.user.school_email` / `auth_id`. |
| **Personal access token (PAT)** | `Authorization: Bearer albert_pat_<hex>` | Created via `POST /user/tokens`. Acts as the owning user (must be active). Preferred for scripts and keystone-style integrations. |
| **Service API key** | `X-API-Key: <secret>` | Compared to `SHA256(secret) == HASHED_API_KEY` in env. Resolves to a synthetic **ADMIN** caller. |

PAT creation (once logged in as an admin):

```http
POST /user/tokens
Authorization: Bearer <supabase_jwt>
Content-Type: application/json

{
  "name": "agds-hr sync",
  "expires_in_days": 90
}
```

Response includes `token` **once** — store it securely.

### Auth matrix for the endpoints below

| Endpoint | JWT (any allowed role) | PAT | `X-API-Key` |
| --- | --- | --- | --- |
| `GET /user/user-directory?role=ADMIN` | yes (all roles) | yes | yes |
| `GET /user/search-users?type=admin` | yes | yes (via `verify_token_or_api_key` on other routes; search uses JWT only — see note) | no |
| `GET /officer/org-tree` | **ADMIN or ACCOUNTANT only** | no | no |
| `GET /officer/officer` | **ADMIN or ACCOUNTANT only** | no | no |
| `GET /keystone/officers` | **ADMIN only** | yes | yes |

`GET /user/search-users` depends on `verify_jwt_token` only — PAT/API key do **not**
work there. Prefer `user-directory` or `keystone/officers` for machine access.

RBAC is enforced twice: route dependencies plus app-level `x-required-roles` checks
on `openapi_extra`.

---

## Getting admin users

### Recommended: user directory (paginated, rich profile)

```http
GET /user/user-directory?role=ADMIN&page=1&limit=100
Authorization: Bearer albert_pat_...
```

Query parameters:

| Param | Type | Description |
| --- | --- | --- |
| `role` | string | Filter: `STUDENT`, `TEACHER`, `ADMIN`, `ALUMNI` |
| `page` | int | 1-based page (default 1) |
| `limit` | int | Page size, 1–1000 (default 10) |
| `search_term` | string | Multi-token search on name, email, and (for admins) officer title |
| `department` | string | For admins, matches `Officer.title` |
| `include_inactive` | bool | Admin-only; include deactivated users |

Response shape:

```json
{
  "users": [ { "...": "..." } ],
  "total": 42
}
```

Each **admin** entry includes base user fields plus officer data when an `Officer`
row exists:

```json
{
  "user_id": "uuid",
  "first_name": "Marie",
  "last_name": "Curie",
  "school_email": "marie.curie@albertschool.com",
  "personal_email": null,
  "notification_email": "marie.curie@albertschool.com",
  "role": "ADMIN",
  "active": true,
  "avatar_url": "https://...",
  "title": "Head of Admissions",
  "officer_id": 17,
  "external": false,
  "external_note": null,
  "functional_manager_name": "Olivier Rodot",
  "local_manager_name": null,
  "campus_id": "uuid",
  "campus_name": "Paris"
}
```

When the caller is also an admin, extra PII is included (`address`, `city`,
`zip_code`, `phone`).

Implementation: `app/routes/user.py` → `get_user_directory_endpoint` →
`app/services/user_service.py` → `get_user_directory`.

### Full officer list (admin UI shape)

```http
GET /officer/officer
Authorization: Bearer <supabase_jwt_as_admin_or_accountant>
```

Returns an array of `Officer` objects with resolved manager **names**, campus,
job description audit fields, etc. Requires JWT as ADMIN or ACCOUNTANT (not PAT/API
key).

Implementation: `app/routes/officer.py` → `list_officers`.

### Search by name (interactive, JWT only)

```http
GET /user/search-users?search_term=marie&type=admin&limit=20
Authorization: Bearer <supabase_jwt>
```

`type` may be repeated (`type=admin&type=teacher`). Returns compact rows:
`name`, `email`, `user_id`, `role`, optional `teacher_id`.

### Single user lookup

```http
GET /user/by-user-id/{user_id}
Authorization: Bearer <supabase_jwt>
```

Returns `UserResponse` with linked `officer_id` when applicable. Admin/accountant
or self only.

### Keystone sync (machine-oriented, includes inactive officers)

For bulk import into agds-hr / keystone during migration:

```http
GET /keystone/officers?limit=500
Authorization: Bearer albert_pat_...
```

Cursor pagination via `nextCursor` query param on subsequent requests.

Each item:

```json
{
  "officer_id": "17",
  "user_id": "uuid",
  "title": "Head of Admissions",
  "functional_manager_user_id": "uuid-or-null",
  "local_manager_user_id": "uuid-or-null",
  "external": false,
  "external_note": null,
  "campus_id": "uuid-or-null",
  "job_description": "...",
  "deactivated_at": null
}
```

Unlike `/officer/org-tree`, this includes **inactive** officers (with
`deactivated_at` set when the linked user is inactive).

Implementation: `app/routes/keystone.py` → `list_keystone_officers`.

---

## Getting the organigram (org chart)

Inside does not expose a route named “organigram”. The org chart is backed by
**officer manager links** and exposed as:

```http
GET /officer/org-tree
Authorization: Bearer <supabase_jwt_as_admin_or_accountant>
```

Returns a **flat forest** — one node per active admin user who has an `Officer`
record. The client builds the tree by joining on manager UUIDs.

### Node shape (`OrgTreeNode`)

```json
{
  "officer_id": 17,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "first_name": "Marie",
  "last_name": "Curie",
  "title": "Head of Admissions",
  "avatar_url": "https://...",
  "functional_manager_user_id": "660e8400-e29b-41d4-a716-446655440001",
  "local_manager_user_id": null,
  "external": false,
  "campus_name": "Paris"
}
```

Only **active** users (`User.active == true`) are included.

Implementation: `app/routes/officer.py` → `get_org_tree`.

Migration context: columns `functional_manager_user_id` and
`local_manager_user_id` on `academic.officer` were added specifically for org-chart
generation (`app/alembic/versions/20260327_add_officer_org_columns.py`).

### Building the hierarchy client-side

Inside maintains **two** reporting lines:

| Field | Meaning |
| --- | --- |
| `functional_manager_user_id` | Dotted-line / functional manager (primary chain for reviews, weekly reports) |
| `local_manager_user_id` | Local / site manager |

Typical organigram UI uses the **functional** chain. Algorithm:

1. Fetch all nodes from `/officer/org-tree` (or `/keystone/officers` for full sync).
2. Index nodes by `user_id`.
3. For each node, set `parent_user_id = functional_manager_user_id` (or
   `local_manager_user_id` for a local tree).
4. Roots are nodes whose chosen parent is `null` or not in the index.
5. Attach children recursively; detect cycles defensively (server walks chains with
   `max_depth = 10` in `get_management_chain`).

### Management chain for one officer

```http
GET /officer/{officer_id}/management-chain
Authorization: Bearer <supabase_jwt>
```

Returns an ordered list of **functional** manager `user_id` strings from immediate
manager up to the top (empty array if none). Any authenticated role may call this.

Implementation: `get_management_chain(..., kind="functional")` in
`app/routes/officer.py`. Variants `"local"` and `"both"` exist for authorization
checks in officer reviews but are not exposed as query params on this route.

### Related endpoints

| Route | Purpose |
| --- | --- |
| `GET /officer/by-id/{officer_id}` | Full officer profile with manager names |
| `GET /officer/{officer_id}/students` | Students assigned to this officer |
| `GET /officer/{officer_id}/teachers` | Teachers assigned to this officer |
| `GET /officer-review/team/{period_year}/{kind}` | Manager rollup of direct/indirect reports |

---

## Example calls

Local dev (PAT):

```bash
curl -sS \
  -H "Authorization: Bearer albert_pat_..." \
  "http://localhost:8000/user/user-directory?role=ADMIN&limit=200"
```

Production org tree (interactive admin session JWT):

```bash
curl -sS \
  -H "Authorization: Bearer eyJ..." \
  "https://api-inside.albertschool.com/officer/org-tree"
```

Keystone officer export with pagination:

```bash
CURSOR=""
while true; do
  URL="https://api-inside.albertschool.com/keystone/officers?limit=500"
  [ -n "$CURSOR" ] && URL="${URL}&cursor=${CURSOR}"
  RESP=$(curl -sS -H "Authorization: Bearer albert_pat_..." "$URL")
  echo "$RESP" | jq '.items[]'
  CURSOR=$(echo "$RESP" | jq -r '.nextCursor // empty')
  [ -z "$CURSOR" ] && break
done
```

Service API key (directory only):

```bash
curl -sS \
  -H "X-API-Key: ${INSIDE_API_KEY}" \
  "https://api-inside.albertschool.com/user/user-directory?role=ADMIN&limit=500"
```

---

## Choosing an endpoint

| Goal | Endpoint | Auth for scripts |
| --- | --- | --- |
| Paginated admin staff with names, emails, titles, managers | `GET /user/user-directory?role=ADMIN` | PAT or `X-API-Key` |
| Active organigram nodes (flat, build tree locally) | `GET /officer/org-tree` | Supabase JWT (admin/accountant) |
| Full officer rows incl. inactive, keystone contract | `GET /keystone/officers` | PAT or `X-API-Key` (admin) |
| Quick name lookup in the UI | `GET /user/search-users?type=admin` | Supabase JWT only |
| Richest officer detail (job description, audit) | `GET /officer/officer` | Supabase JWT (admin/accountant) |

For **agds-hr** batch sync, start with `GET /keystone/officers` (manager UUIDs +
deactivation state) or `GET /user/user-directory?role=ADMIN` (display-ready names).
Use `/officer/org-tree` when you need exactly what the Inside organigram UI shows
(active staff only, compact nodes).

## Errors

| Status | Typical cause |
| --- | --- |
| 401 | Missing/invalid JWT, PAT, or API key |
| 403 | Valid auth but wrong role (e.g. teacher calling `/officer/org-tree`) |
| 404 | Unknown `user_id` / `officer_id` |
| 400 | Invalid `role` filter on directory, invalid keystone cursor |

All business errors from typed handlers use plain `detail` strings (no `snake_case:`
prefix — that convention belongs to agds-hr, not the legacy Inside API).

## Source map

| Concern | File |
| --- | --- |
| App entry, router mounts | `app/main.py` |
| User directory & search | `app/routes/user.py`, `app/services/user_service.py` |
| Org tree & officer CRUD | `app/routes/officer.py` |
| Keystone officer export | `app/routes/keystone.py` |
| Auth (JWT, PAT, API key) | `app/services/security.py` |
| PAT management | `app/routes/personal_tokens.py` |
| Officer schemas | `app/schemas.py` (`Officer`, `OfficerCreate`, …) |
| Generated endpoint list | `api_docs_output.md` |
