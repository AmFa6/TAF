# West of England Connectivity Tool (TAF)

## Repository Layout

- `index.html`, `main.js`, `styles.css`, `config.js`, `glossary.html`: Current public version (latest).
- `data/`: Current dataset used by the app.
- `versions/`: Immutable snapshots of released versions.
- `releases/versions.json`: Version registry used by the in-app version selector.
- `releases/<version>.md`: Release documentation for each version.
- `scripts/publish-version.ps1`: Script to create a new version snapshot.

## Day-to-Day Workflow

1. Create a feature branch from `main`.
2. Make changes and test locally.
3. Open a pull request into `main`.
4. Merge only when approved.

This keeps private testing in branches and only publishes reviewed code.

## Create a New Public Version

Run from repository root:

```powershell
./scripts/publish-version.ps1 -Version v1.2.0
```

What this does:

1. Copies the current app + `data/` into `versions/v1.2.0/`.
2. Updates `releases/versions.json`.
3. Creates `releases/v1.2.0.md` if missing.

Then:

1. Fill in release notes.
2. Commit changes.
3. Create git tag `v1.2.0`.
4. Create a GitHub Release using the notes.

## Keep Older Versions Available

Each release is stored under `versions/<version>/` and can remain publicly accessible.
The version dropdown in the app reads `releases/versions.json` and lets users jump between versions.

## Data Source Behavior

By default the app reads from `./data` in this repository.

Optional query parameters:

- `?dataSource=legacy` to read from legacy `TAF_test` paths.
- `?dataRef=v1.2.0` to load an immutable tagged snapshot through jsDelivr.
- `?dataRepo=AmFa6/TAF` to override data repo for `dataRef` mode.

## Important Privacy Limitation

To have data not publicly readable, I must use a backend/API with authentication (not pure static hosting).