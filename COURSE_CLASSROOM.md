# GitHub Classroom + Actions (soft gates)

This setup keeps the solution repo private while giving students a scaffold repo that autogrades each lab.

## 1) Create a student template repo (sanitized)

Option A (recommended): create a new repo that contains only the `LearningLab/` tree.

- Quick path:
  - Copy `LearningLab/` into a new repo root.
  - Keep `labs/` docs and the starter code.
  - Exclude any internal notes or solution branches.

Option B (history-preserving): use `git filter-repo --subdirectory-filter LearningLab` to extract the lab tree into its own repo.

Option C (automated scaffold): generate a ready-to-publish template folder from this repo.

- Run: `node scripts/scaffold-classroom-template.js --clean`
- Result: `classroom-template/` contains a sanitized copy you can push as the GitHub Classroom template repo.

## 2) Add the autograding workflow

Commit the workflow in `.github/workflows/classroom.yml` (provided in this repo). It:

- installs dependencies with pnpm
- starts issuer/verifier
- runs `node scripts/lab-check.js --start`

The script will infer the lab ID from branch name (e.g., `lab-01-issuance` → `01`) or from `LAB_ID`.

## 3) Create GitHub Classroom assignments

- Create a Classroom, then an assignment.
- Choose the student template repo.
- Autograding:
  - Select **Custom YAML** and use the existing `classroom.yml`, or
  - Select **Run command** and use `pnpm -C LearningLab lab:check -- --start --lab 01`.

Create one assignment per lab (Lab 00–05) or use branch naming to auto-detect lab IDs.

## 4) Set lab IDs (pick one)

Option A (branch-based):
- `lab-00-start`
- `lab-01-issuance`
- `lab-02-bbs`
- `lab-03-ohttp`
- `lab-04-iproov`
- `lab-05-revocation`

Option B (repo variable):
- Set `LAB_ID=01` (or `02`, etc.) in **Settings → Secrets and variables → Actions → Variables**.

## 5) Hook the web course to GitHub Actions (unlocking)

Your web course can unlock the next step when GitHub Actions reports success:

- Require students to authenticate with GitHub OAuth.
- Read their assignment repo’s latest workflow run (`classroom.yml`).
- Unlock the next lab when the run status is **success**.

This avoids sharing your internal repo and keeps the “proof” in GitHub Actions.
