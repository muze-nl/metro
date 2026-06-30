# Metro real-world examples

This directory is reserved for runnable examples that prove Metro works against real-world APIs without turning the core package into a provider SDK.

Suggested first examples:

- `github-token-auth`: list repositories/issues with a personal access token.
- `github-pagination`: follow paginated REST responses.
- `dropbox-pkce`: browser OAuth2 PKCE login and folder listing.
- `dropbox-upload`: upload a small file through Dropbox's content API.
- `solid-protected-resource`: try anonymous access first, then use OIDC/OAuth when required.

Each example should be runnable and should explain when secrets must stay server-side.
