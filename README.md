# DSH Memory 0.2.1-rc.2

A small installable DSH bundle that provides scoped, policy-aware memory. It is intentionally self-contained and does not install dependencies or call external accounts.

## Capabilities

- Host persistence through the `storageDomain` KV service (`dsh-memory`, version 1), with a process-local fallback only when that service is unavailable.
- Tables for `memoryItems`, `sources`, `revisions`, `policy`, and `accessLog`.
- Limited RPC endpoint `dsh-memory`: `status`, `list`, `search`, `create`, `update`, `delete`, `restore`, and `toggle_policy`.
- Scope isolation by authenticated browser peer (or agent/session id for the shared tool path).
- Sensitive-content rejection for secret/password/token/API-key/private-key/credit-card/credential-like fields and values. A rejected write returns `SENSITIVE_CONTENT` and is logged as a failed operation.
- Soft delete and restore, revision snapshots, source metadata, bounded list/search, and a user-facing enable switch.
- Client UI registered in `sidebar.panellist` and keyed `main` panel. It uses `ctx.connection.rpc`, `ctx.slots`, `ctx.locale`, and theme alias tokens. It does not use DOM APIs or import DSH Client packages.
- A single `memory` agent tool shares the Host repository logic; policy toggling stays a UI/user action.

## Install

Install the directory as a local bundle using the DSH bundle installer (the package directory is `dsh-memory/`). The patch inserts the `dsh-memory` Host row and the Web client artifact.

No package manager or dependency installation is required. The bundle is ESM and uses only platform APIs plus DSH services supplied by the Host.

## Verification

Run the minimal logic tests from this directory:

```sh
node --test test/*.test.js
```

The implementation can be syntax-checked with `node --check index.js`, `node --check rpc.js`, and `node --check client.js` (the Client file is a loader artifact and may be checked only in an environment that provides the loader global).

A connected Harness Web page is required to verify actual slot rendering and theme/locale switching. This delivery intentionally does **not** create mock screenshots, preview HTML, or screenshot scripts. If Client inspection times out because the page is not connected, verify installation and Host RPC separately, then report rendered UI as unverified.

## Data safety notes

This is a derived convenience cache, not a replacement for the session log. Keep memory content short and non-sensitive. Deletes are soft deletes so users can recover them; the access log records operation, scope, success, and timestamp without copying secret content.
