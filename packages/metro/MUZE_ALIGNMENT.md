# Muze alignment: metro

> Initial alignment roadmap. It is intended as a practical maintenance document, not as a complete code audit.

## Muze design principles

Muze builds web software for technically curious non-professional programmers, without making the tools unattractive to professionals.

We prefer:

- simplicity over completeness
- small, decoupled, single-concern libraries
- correct abstractions that do not cross conceptual boundaries
- browser-native standards where possible
- lightweight abstractions only when they make developer code simpler
- stable, long-term APIs
- components and frameworks that are easy to adapt or replace
- standards-based or open-source hosting stacks that avoid lock-in
- software small enough to work well on slow devices and connections
- a view-source philosophy: invite developers to look under the hood and learn

When making tradeoffs, prefer composability, replaceability, web-platform alignment, and long-term simplicity over convenience, popularity, or feature completeness.


## Muze package namespace policy

The `@muze-nl` npm namespace should be a trust signal. Packages published there should be close to production-ready: the public API is expected to be stable, the package can be installed and used by a fresh project, and the README should be clear about supported usage.

Experimental libraries should use the `@muze-labs` namespace until they are mature enough to carry the main Muze production-readiness signal. Moving from `@muze-labs` into `@muze-nl` should be treated as a release-readiness decision, not only a naming cleanup.

## Current assessment

Metro is one of the best-aligned Muze libraries: it is browser-platform oriented, Fetch-compatible, small in concept, and built around composable middleware. The core has now been split into `@muze-nl/metro-core`, while `@muze-nl/metro` is the beginner-friendly combined package. The main risks are documentation clarity, optional global/browser builds, and keeping middleware from turning into a framework-like ecosystem with hidden conventions.

## Strengths

- Builds on Fetch concepts instead of inventing a completely new HTTP model.
- Middleware is a small and composable abstraction with a clear single concern.
- Immutable request/response copies help make data flow easier to reason about.
- Works in browser-oriented usage and can serve as a stable base for OAuth, OIDC, and Linked Data middleware.

## Alignment issues

### 1. Make browser-global usage clearly optional

**Principle:** Replaceability, composability, and browser-native standards.

**Problem:** The CDN/browser examples are useful, but any build that writes to a global namespace should be clearly separated from the normal ESM module path.

**Why it matters:** A hidden global side effect makes the library harder to compose with other tools and harder to replace later.

**Suggested direction:** Document `@muze-nl/metro` as pure ESM first. Provide a separate documented `browser.js` or `global` build for script-tag users, with an explicit note that it creates `globalThis.metro`.

**Status:** Partly done — `@muze-nl/metro-core` is now the small pure core package, and the browser/global behavior lives in the combined `@muze-nl/metro` package. The docs still need a clearer ESM-vs-global explanation.

### 2. Explain exactly how Metro maps to Fetch

**Principle:** Browser-native standards where possible.

**Problem:** The README says request and response are compatible with Fetch, but the boundary between native Fetch objects and Metro-specific helpers can be clearer.

**Why it matters:** Developers should understand when they are using the platform and when they are using a Muze abstraction.

**Suggested direction:** Add a short “Metro and Fetch” section: equivalent `fetch()` code, how `request.with()`/`response.with()` differs from native objects, and how to drop down to plain Fetch.

**Status:** Open

### 3. Add a middleware authoring guide focused on constraints

**Principle:** View-source learnability and stable APIs.

**Problem:** Middleware is the key extension point, so accidental conventions can become de facto API.

**Why it matters:** Small teams benefit when extension points are narrow, explicit, and hard to misuse.

**Suggested direction:** Document middleware invariants: immutability, always return a response, when to call `next`, error handling, body consumption, and how to avoid hidden state.

**Status:** Open

### 4. Add a release/installability checklist

**Principle:** Stable, long-term APIs.

**Problem:** Metro is becoming the base of other Muze packages. Any release issue cascades into many downstream libraries.

**Why it matters:** If Metro breaks, OAuth, OIDC, JSFS/Solid, and Linked Data layers become harder to trust.

**Suggested direction:** Add CI checks for npm install, ESM import, browser CDN example, tests, and package metadata before publishing.

**Status:** Open

## Open questions

- Should the browser-global build live in the same package or in an explicit secondary export path?
- Should Metro commit to Fetch-compatible surface area as a long-term API promise?
- Which middleware patterns are deliberately out of scope?

## Non-goals

- Do not become a full application framework.
- Do not abstract away HTTP so far that Fetch knowledge stops being useful.
- Do not add retry/cache/auth features into core when they can remain middleware.

## Review cadence

Review this document before feature work, before releases, and whenever the public API or dependency surface changes. Close issues by changing their status to `Done` and leaving a short note about the decision.
