# GitHub Setup Checklist

## 1) Branch protection

In repository settings for TAF, protect branch main with:

- Require a pull request before merging.
- Require at least 1 approval.
- Require status checks (if you add CI later).
- Restrict who can push directly to main.

## 2) Keep testing private before release

Use feature branches and pull requests.

- Create branch feature/<short-name>.
- Test locally from that branch.
- Merge only when ready to publish.

## 3) GitHub Pages

- Publish from branch: main.
- Folder: /(root).

The root files are your latest public version.

## 4) Release process

1. Run `./scripts/publish-version.ps1 -Version vX.Y.Z`
2. Fill `releases/vX.Y.Z.md`
3. Commit and push
4. Create tag vX.Y.Z
5. Create GitHub Release with the same notes

## 5) Data privacy reality

Public GitHub Pages serves static files directly to browsers.
If the website can fetch a data file, users can also download it.

To keep data private while still offering public pages, move private data behind an authenticated API/backend.
