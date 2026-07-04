# Muze alignment: metro-oldm

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

metro-oldm is a thin integration layer between Metro and OLDM. That is a good Muze shape if it remains thin. Its alignment work is mainly to keep responsibilities clear: HTTP belongs to Metro, Linked Data mapping belongs to OLDM, and this package should only compose them.

## Strengths

- Keeps Linked Data HTTP handling out of Metro core.
- Keeps OLDM independent from one particular HTTP client.
- Supports composition between small Muze libraries.

## Alignment issues

### 1. Define the exact boundary between Metro and OLDM

**Principle:** Correct abstractions and replaceability.

**Problem:** An integration package can accidentally absorb behavior from both sides: content negotiation, parsing, serialization, error handling, graph mapping, and HTTP retries.

**Why it matters:** The smaller and clearer the adapter, the easier it is to replace or remove.

**Suggested direction:** Write a short boundary section: Metro handles requests/responses; OLDM handles parse/write/map; metro-oldm only selects parser/writer based on content type and attaches parsed data.

**Status:** Open

### 2. Document escape hatches to raw Response and raw graph data

**Principle:** View-source learnability.

**Problem:** If parsed data is attached automatically, users still need to know how to inspect headers, status, raw text, and raw graph data.

**Why it matters:** Debugging Solid/Linked Data apps often requires seeing the underlying HTTP and RDF.

**Suggested direction:** Provide examples for raw response, parsed OLDM source, and serialization back to text.

**Status:** Open

### 3. Avoid becoming a policy layer for Solid apps

**Principle:** Single-concern libraries.

**Problem:** metro-oldm may be used by jsfs-solid or solid-client, but should not absorb Solid login, WebID, storage discovery, or ACL behavior.

**Why it matters:** Keeping it generic preserves replaceability and standards alignment.

**Suggested direction:** Move Solid-specific behavior to jsfs-solid/solid-client. Keep metro-oldm generic over RDF/Linked Data HTTP.

**Status:** Open

## Open questions

- Should content negotiation defaults live here or in calling code?
- Should failed parsing reject the response or return a response with parse metadata?
- How much of OLDM should be exposed through this middleware?

## Non-goals

- Do not become a Solid client.
- Do not hide the raw HTTP response.
- Do not add RDF mapping behavior that belongs in OLDM.

## Review cadence

Review this document before feature work, before releases, and whenever the public API or dependency surface changes. Close issues by changing their status to `Done` and leaving a short note about the decision.
