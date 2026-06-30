# Muze alignment: metro-oauth2

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

metro-oauth2 is useful and fits the Metro middleware model, but it sits in a security-sensitive area. Its documentation and defaults must be safer and clearer than ordinary library docs. The highest-priority alignment work is to separate browser public-client usage from confidential/server usage and to make PKCE-first flows the default story.

## Strengths

- Keeps OAuth behavior composable by implementing it as Metro middleware.
- Allows different authorization callbacks, which supports replaceability.
- Provides redirect and popup flows, which are important for browser applications.
- Keeps protocol handling outside Metro core.

## Alignment issues

### 1. Remove client secrets from browser-first examples

**Principle:** Serve non-professional developers without hiding technical reality.

**Problem:** The examples normalize `client_secret` next to browser-oriented redirect and popup flows.

**Why it matters:** Developers copy examples. Browser apps are public clients, so examples should not teach people to put secrets in browser code.

**Suggested direction:** Make the first examples use `client_id` + PKCE only. Move `client_secret` to a clearly marked confidential-client/server section, or omit it until that use case is explicitly supported.

**Status:** Partly addressed. The README now leads with a public-client PKCE flow and explicitly warns against browser client secrets.

### 2. Make PKCE and browser security the default documentation path

**Principle:** Browser-native standards and stable, safe abstractions.

**Problem:** The configuration list includes `code_verifier`, but the README should lead with a secure public-client flow rather than treating security parameters as advanced details.

**Why it matters:** The target audience needs safe defaults without needing to know every OAuth pitfall first.

**Suggested direction:** Add a “Recommended browser flow” section: authorization-code + PKCE, no client secret, redirect URI rules, storage tradeoffs, and what the middleware handles.

**Status:** Partly addressed. The README now documents the PKCE-first browser flow and popup state/origin checks; deeper storage guidance remains open.

### 3. Separate protocol core from UI flow helpers

**Principle:** Small, single-concern libraries.

**Problem:** Redirect, popup, iframe, token handling, mock-server behavior, and protocol configuration are related but conceptually different.

**Why it matters:** Bundling too many concerns makes the library harder to understand and replace.

**Suggested direction:** Consider submodules: `oauth2mw` core, `authorizePopup`, `popupHandleRedirect`, `mockserver`. At minimum document these as layers rather than one conceptual API.

**Status:** Partly addressed. Mock servers now live under explicit testing entries; popup helpers remain in the main package because they are part of common browser OAuth usage.

### 4. Document token and state storage tradeoffs

**Principle:** View-source learnability and sovereignty.

**Problem:** The README mentions localStorage-like stores, but does not fully explain the risks or replacement options.

**Why it matters:** Storage choices affect security, privacy, and app portability.

**Suggested direction:** Add examples for custom stores, in-memory stores, and localStorage/sessionStorage tradeoffs. Explain what must persist across reloads and what should not.

**Status:** Open

## Open questions

- Is this package intended to support confidential clients, or only browser/public clients?
- Should DPoP live here, only in metro-oidc, or in a shared lower-level package?
- What is the minimum OAuth subset that Muze wants to support long-term?

## Non-goals

- Do not become a generic OAuth framework for every grant type.
- Do not hide protocol behavior so much that developers cannot debug authentication failures.
- Do not encourage browser secrets, even accidentally.

## Review cadence

Review this document before feature work, before releases, and whenever the public API or dependency surface changes. Close issues by changing their status to `Done` and leaving a short note about the decision.
