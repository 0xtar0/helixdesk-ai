# Security Policy

HelixDesk AI is local-first. Ticket, customer, and knowledge-base data are stored in the browser by default and are not sent to hosted services by this app.

## Supported Versions

The `main` branch is the supported development version until the first stable release.

## Reporting

Please open a private advisory or email the maintainers before publishing a vulnerability. Include reproduction steps, browser version, and whether Ollama or another local endpoint was enabled.

## Local AI Endpoint

When Ollama is enabled, the browser sends selected ticket and knowledge-base context to the configured local endpoint. Use `http://localhost:11434` unless you intentionally run a trusted endpoint elsewhere.
