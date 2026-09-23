# Security

The default local provider is deterministic, not an LLM. OpenAI-compatible and Ollama adapters stream provider chunks natively. Protected `/v1` routes reject non-loopback access unless `MAKMA_API_TOKEN` is configured, but this is a single-owner bearer-token boundary rather than multi-user identity/session ownership. Client chat payloads cannot assert tool approvals. No high-risk tools are currently registered and there is not yet a server-authoritative approval-challenge store for future side-effecting tools. Run lifecycle status and failures persist; full tool traces are returned with responses rather than stored as first-class audit rows. SQLite operations are synchronous. No shell, filesystem, browser or autonomous background execution is implemented.

Use synthetic or explicitly authorized public data. Do not commit API keys, databases, model credentials, patient records or private employer material. Remote model adapters transmit supplied text to the configured endpoint; choose the provider deliberately.

For a suspected vulnerability, use GitHub private vulnerability reporting if enabled. Otherwise contact the maintainer privately through the [portfolio](https://maharshipatel-portfolio.vercel.app/). Do not put secrets or exploit payloads containing private data in a public issue. No response SLA is promised.
