# GitHub Actions workflows

## Why don’t I see these workflows in GitHub Actions?

**GitHub only lists workflows that exist on your repository’s default branch** (usually `main` or `master`). If you only have these workflow files on a feature branch (e.g. `feature/teamtalk-tests`), they will **not** appear under the Actions tab until that branch is merged into the default branch (or the workflow files are added to the default branch).

### What to do

1. **Merge your branch into the default branch**  
   For example, merge `feature/teamtalk-tests` into `main` (or `master`). After the merge, the workflows will show up under **Actions**.

2. **Or push the workflow files to the default branch**  
   Check out the default branch, add or update the workflow files from your feature branch, commit, and push.

3. **Run workflows manually**  
   After they appear in Actions:
   - **PlanetF1 Tests** – Actions → “PlanetF1 Tests” → “Run workflow”.
   - **Playwright Selectable** – Actions → “Playwright Selectable” → “Run workflow” → choose e.g. `test:planetf1`.
   - **Playwright Tests** (CI) – Runs on push/PR to `main`, `master`, or `feature/teamtalk-tests`.

## Workflows in this folder

| Workflow               | Trigger                    | What it runs                    |
|------------------------|----------------------------|---------------------------------|
| **ci.yml**             | Push/PR, workflow_dispatch | All Playwright tests            |
| **playwright-planetf1.yml** | Push/PR, workflow_dispatch | PlanetF1 test only             |
| **playwright-selectable.yml** | workflow_dispatch      | One chosen test (e.g. test:planetf1) |
