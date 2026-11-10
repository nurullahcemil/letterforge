# Deploying

Vercel project `letterforge` (team id `team_5zRG4X7ZH2hh2Zh0w2xPc17w`, project id
`prj_AjrFUyPuxyBoNGlUJUIloydveogQ`), production alias https://letterforge-sigma.vercel.app.
There is **no GitHub repo yet** (the user skipped it). Source lives in this repo/zip only.

## Recommended: connect GitHub (saves a lot of tokens)
Push this repo to GitHub and connect it to the Vercel project; then every push deploys
and no file contents ever need to be sent through the API.

## How it was deployed so far (Vercel MCP `create_deployment`, inline files)
The deployed tree is NOT the TS source. It is a small Vite project whose src is
pre-bundled JS, so files stay small:
```
index.html            (script src /src/main.js)
package.json, vite.config.ts, public/favicon.svg
src/main.js           esbuild bundle of src/main.ts (packages external)
src/worker.js         esbuild bundle of src/worker.ts
src/style.css, style2.css ... style7.css   (CSS split in parts; new CSS = new file)
```
Build the bundle (SP = scratch deploy dir that has the files above):
```bash
npx esbuild src/worker.ts --bundle --format=esm --minify --charset=utf8 \
  --external:manifold-3d --external:'*?url' --external:opentype.js \
  --external:straight-skeleton --external:qrcode --external:fflate \
  --target=es2022 --outfile=$SP/src/worker.js
npx esbuild src/main.ts --bundle --format=esm --minify --charset=utf8 \
  --external:three --external:'three/*' --external:'*?url' --external:'@fontsource/*' \
  --external:fflate --external:'*.css' --target=es2022 --outfile=$SP/src/main.js
sed -i 's#import"./style.css";#import"./style.css";import"./style2.css";...;import"./style7.css";#; s#"./worker.ts"#"./worker.js"#' $SP/src/main.js
sed 's#/src/main.ts#/src/main.js#' index.html > $SP/index.html
```
Then `create_deployment` with `projectSettings {framework: vite, buildCommand: "vite build",
outputDirectory: dist, installCommand: "npm install"}`, target production; unchanged files by
`{file, sha, size}`, changed files inline (`encoding: utf-8`). `--charset=utf8` matters (keeps
shas stable). Verify with `list_deployment_files` (compare uid to local `sha1sum`) and
`get_deployment` until READY.

Pain point: minified names change on every build, so any change means re-sending the whole
main.js (~50 KB) and/or worker.js (~29 KB). GitHub-connected deploys avoid this.
