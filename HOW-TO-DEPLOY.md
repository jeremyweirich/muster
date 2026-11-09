# 🚀 HOW TO DEPLOY (read me, future Jeremy)

> **Pushing to `main` does NOT update the live game anymore.**
> Since 9 November 2026 (the release to friends), the live site only changes when you deploy by hand.

## The short version

1. Open **https://github.com/jeremyweirich/muster/actions/workflows/pages.yml**
2. Click the **Run workflow** button (right side, above the list of runs).
3. Leave the branch on **`main`** and click the green **Run workflow**.
4. Wait about 3 minutes for the run to turn green ✅.
5. Open **https://jeremyweirich.github.io/muster/** and check the version in the top-right corner (`vNNN · abc1234`).
   It should match the newest commit. Hard-refresh (Ctrl+Shift+R) if it still shows the old one.

That's it. Whatever is on `main` at that moment goes live.

## Even shorter

Tell Claude **"deploy"**. It will run `gh workflow run pages.yml --ref main` and watch it finish.

## Things worth knowing

- **Every push still runs the tests and the build** (the same workflow, minus the publishing step). If the latest
  push's run is red ❌, fix that first: the deploy run tests too and will refuse to publish.
- **Nothing is lost by waiting.** Push as often as you like; friends only see a new version when you run the workflow.
- **Rolling back:** undo the bad change on `main` (`git revert <commit>`, push, or ask Claude), then deploy again.
  Deploying another branch usually won't work: GitHub only lets Pages deploy from `main`.
- **Telling friends what changed:** `CHANGELOG.md` lists the big changes by date and version.
- **Turning auto-deploy back on:** in `.github/workflows/pages.yml`, delete the two
  `if: github.event_name == 'workflow_dispatch'` lines (or ask Claude to).
