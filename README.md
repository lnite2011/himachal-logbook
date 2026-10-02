# Himachal logbook

A static, no-backend site that renders our trip's Markdown notes live from GitHub.

- **Content** is never copied here. `app.js` fetches the `.md` files from the private
  planning repo (see `config.js`) through the GitHub API and renders them in the browser.
  Edit a note, push it, refresh the page.
- **Access**: this site is public but shows nothing until a read-only, fine-grained
  GitHub token (Contents: read, one repo) is pasted on the device. The token lives in
  that browser's `localStorage` only.
- **Offline**: the last fetched copy of each note is cached on the device, and a small
  service worker keeps the site itself available.
- **Local preview**: `python3 -m http.server 8765 --directory trips` from the planning
  repo, then open `/himachal-2026-10/website/app/`. On localhost it reads the files
  directly; add `?remote` to test the GitHub path.
- **Photos**: Wikimedia Commons, credited in `credits.json` and on the site's credits page.

Source of truth lives in the planning repo under `trips/himachal-2026-10/website/app/`
and is published here with `git subtree push` (see `publish.sh` there).
