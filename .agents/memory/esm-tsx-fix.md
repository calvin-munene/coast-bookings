---
name: ESM top-level await fix for tsx
description: How to fix tsx "Top-level await not supported with cjs output format" error.
---

# ESM / tsx top-level await fix

## Problem
`tsx` treats `.ts` files as CJS when `package.json` does not have `"type": "module"`. CJS does not support top-level await, causing build errors in scripts that use it.

## Fix
Add a `package.json` with `{"type": "module"}` in the directory containing the script (e.g. `scripts/package.json`, `src/db/package.json`). This is a local override that forces ESM mode for that directory without affecting the root package.json (which Next.js requires to stay as CJS/default).

**Why:** Changing root package.json to `"type": "module"` breaks Next.js. The local package.json trick is minimal and non-breaking.

**How to apply:** Whenever a standalone tsx script uses top-level await and fails with this error, add `{"type":"module"}` as package.json in its directory.
