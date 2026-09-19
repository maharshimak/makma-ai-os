# Security

The default local provider is deterministic, not an LLM. SSE replays a completed answer rather than streaming model tokens. Sessions are identifiers, not authentication boundaries. API-provided approvals are intended for a trusted local client, not multi-user authorization. Run history persists responses and metadata; full tool traces are returned with the response, not persisted. SQLite operations are synchronous. No shell, filesystem, browser or autonomous background execution is implemented.

Use synthetic or explicitly authorized public data. Do not commit API keys, databases, model credentials, patient records or private employer material. Remote model adapters transmit supplied text to the configured endpoint; choose the provider deliberately.

For a suspected vulnerability, use GitHub private vulnerability reporting if enabled. Otherwise contact the maintainer privately through the [portfolio](https://maharshipatel-portfolio.vercel.app/). Do not put secrets or exploit payloads containing private data in a public issue. No response SLA is promised.
