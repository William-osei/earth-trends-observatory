# Contributing

Open an issue describing the user problem or scientific concern before starting a large change. For a small fix, explain the observed behavior, proposed change and relevant validation in a pull request.

## Local checks

Use Node.js 24, then run:

```sh
npm run check
npm test
npm start
```

No dependency installation or API key is required. The local server is available at `http://127.0.0.1:4173`. Check the affected browser flow when changing the interface.

## Data and methods

- Keep NASA source values unchanged and distinguish raw snapshots from derived statistics.
- Record source URL, retrieval time, coordinates, units, missing-value handling and hashes when updating data.
- Do not silently change a statistical assumption or treat software checks as scientific validation. Add meaningful numerical reference tests for new methods.
- Preserve licenses, source attribution and accurate tool/contribution credits.
- Keep credentials, account details, private messages, deployment metadata and submission receipts out of commits.

Discuss findings respectfully. Focus criticism on evidence and behavior, credit others' contributions, and avoid personal attacks or discriminatory language.
