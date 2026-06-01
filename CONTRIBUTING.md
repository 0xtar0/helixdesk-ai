# Contributing

HelixDesk AI is intentionally dependency-free while the core product surface is being built. Keep changes small, local-first, and easy to run from a static server.

## Development

```bash
npm run dev
```

Open `http://localhost:4173`.

## Pull request checklist

- Keep user data in local browser storage unless a feature explicitly adds a self-hosted backend.
- Avoid adding external network calls outside the configured local AI endpoint.
- Run `npm test`.
- Update the README when user-visible behavior changes.
