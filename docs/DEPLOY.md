# Deploying

GitHub repo `nurullahcemil/letterforge` is connected to the Vercel project `letterforge`
(team id `team_5zRG4X7ZH2hh2Zh0w2xPc17w`, project id `prj_AjrFUyPuxyBoNGlUJUIloydveogQ`).

**Every push to `main` deploys to production:** https://letterforge-sigma.vercel.app

Vercel build settings: framework Vite, install `npm install`, build `vite build`, output `dist`.

Before pushing:
```bash
npx tsc --noEmit -p .
npx vite build
npx tsx scripts/smoke.ts   # compare with the output before your change
```
After pushing, check the deployment reached READY (Vercel dashboard, or the Vercel MCP
`list_deployments` / `get_deployment` tools) and open the site.
