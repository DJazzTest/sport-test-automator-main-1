# Running PlanetF1 (and Playwright) tests in Docker

Docker runs the same Linux + Chromium setup as GitHub Actions, so you can verify the test and report locally before pushing.

## Quick run

```bash
# Build image and run full PlanetF1 test (same as CI)
npm run test:planetf1:docker

# Or quick mode (fewer tabs)
npm run test:planetf1:docker:quick
```

## Manual Docker commands

```bash
# Build
docker build -t sport-test-planetf1 .

# Run PlanetF1 test (recommended: --init and --ipc=host for Chromium)
docker run --rm --init --ipc=host sport-test-planetf1 npm run test:planetf1

# Other test scripts
docker run --rm --init --ipc=host sport-test-planetf1 npm run test:planetf1:quick
docker run --rm --init --ipc=host sport-test-planetf1 npm run test:teamtalk
```

## Why use Docker?

- **Same env as CI** – Linux + default Playwright browser cache, so no “Executable doesn’t exist” from Mac vs Linux.
- **Report output** – You see the same report block (header + failures or “No Fails identified”) that gets extracted for the email.
- **Reproduce CI** – If a run fails in GitHub Actions, run the same test in Docker locally to debug.

## Notes

- The Dockerfile sets `CI=1` so the test uses the default browser cache (no project `playwright-browsers/` path).
- `--init` and `--ipc=host` follow [Playwright’s Docker recommendations](https://playwright.dev/docs/docker) for Chromium.
