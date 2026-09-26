# Frontend

The dashboard is a React 19 + TanStack Start app. It runs from the repository root, so its source lives in `/src`:

| Path | Purpose |
|---|---|
| `src/routes/index.tsx` | Dashboard |
| `src/routes/assessment.tsx` | New assessment form + prediction result |
| `src/routes/history.tsx` | Prediction history (search / filter) |
| `src/routes/facilities.tsx` | Facility list + add facility |
| `src/routes/analytics.tsx` | EDA, feature selection & model evaluation charts |
| `src/routes/api-docs.tsx` | REST API docs + live tester |
| `src/routes/api/public/predict.ts` | REST endpoint `POST /api/public/predict` |
| `src/lib/risk-model.ts` | Model inference + validation schema (uses `src/data/model.json`) |
| `src/lib/hygiene.functions.ts` | Data queries and server actions |
| `src/components/hygiene/AppShell.tsx` | Reusable layout & UI components |

Run: `bun install && bun run dev`. Tests: `bunx vitest run`.
