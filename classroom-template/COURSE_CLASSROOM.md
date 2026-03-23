# GitHub Classroom + Actions (soft gates)

This setup keeps the solution repo private while giving students a scaffold repo that autogrades each lab.

## Recommended model: one repo + `LAB_ID`

Use a single student repo for the whole course and drive progression with the GitHub Actions variable `LAB_ID`.

- Students keep one repo and one working environment through the full lab
- Your autograder checks the currently active lab based on `LAB_ID`
- Your course site or instructor workflow advances learners by changing `LAB_ID`
- Branch-based detection remains available for local debugging, but it should not be the primary progression mechanism

## Student setup options (cross-platform)

The student template includes three ways to get running:

- Local install (macOS/Windows): `scripts/bootstrap-mac.sh` and `scripts/bootstrap-windows.ps1`
- No local installs: GitHub Codespaces / VS Code Dev Containers via `.devcontainer/`
- Docker (issuer+verifier only): `docker compose up --build`

## Develop locally before GitHub Classroom

You can build and validate almost all of the Classroom flow locally before you create any assignments.

1. Prepare the repo:
   - `pnpm env:setup`
   - `pnpm install -r --frozen-lockfile`
2. Regenerate the sanitized student repo when course files change:
   - `pnpm classroom:template`
3. Run the same grading command the GitHub Actions workflow uses:
   - `pnpm classroom:check`
   - On `main`, this defaults to Lab 05 because the repo reflects the final integrated state
4. Target one lab explicitly while developing:
   - `LAB_ID=01 pnpm classroom:check`
   - `LAB_ID=02 pnpm classroom:check`
5. Test branch-based lab detection by naming your branch like `lab-01-issuance` only when you intentionally want to exercise the fallback path.

What this gives you locally:
- Student template generation
- The grading logic in `scripts/lab-check.js`
- The same `--start --verbose` execution path used by `.github/workflows/classroom.yml`

What still requires GitHub:
- Classroom assignment creation
- Per-student repo provisioning
- Unlocking steps from real GitHub Actions status
- GitHub OAuth integration for your course site

How `LAB_ID` fits the hosted course:
- Store `LAB_ID` as an Actions variable on the student repo
- Start learners on `LAB_ID=00` or `LAB_ID=01`
- Update `LAB_ID` on that repo whenever you want to move the learner forward
- The autograder does not enforce previous-lab correctness before you do this
- Keep the repo on `main`; do not require students to switch grading branches

## 1) Create a student template repo (sanitized)

Option A (recommended): create a new repo that contains only the `LearningLab/` tree.

- Quick path:
  - Copy `LearningLab/` into a new repo root.
  - Keep `labs/` docs and the starter code.
  - Exclude any internal notes or solution branches.

Option B (history-preserving): use `git filter-repo --subdirectory-filter LearningLab` to extract the lab tree into its own repo.

Option C (automated scaffold): generate a ready-to-publish template folder from this repo.

- Run: `pnpm classroom:template`
- Result: `classroom-template/` contains a sanitized copy you can push as the GitHub Classroom template repo.

## 2) Add the autograding workflow

Commit the workflow in `.github/workflows/classroom.yml` (provided in this repo). It:

- installs dependencies with pnpm
- starts issuer/verifier
- runs `node scripts/lab-check.js --start`

The script will infer the lab ID from branch name (e.g., `lab-01-issuance` → `01`) or from `LAB_ID`. On `main`, it defaults to Lab 05.

## 3) Create GitHub Classroom assignments

- Create a Classroom, then an assignment.
- Choose the student template repo.
- Recommended:
  - create one assignment for the whole Learning Lab
  - keep students in a single repo for the duration of the course
  - control the active graded lab with the repo Actions variable `LAB_ID`
- Autograding:
  - Select **Custom YAML** and use the existing `classroom.yml`, or
  - Select **Run command** and use `LAB_ID=01 pnpm -C LearningLab lab:check -- --start --verbose`.
  - For local rehearsals on a machine that already has issuer/verifier processes on `3001`/`3002`, set `ISSUER_BASE_URL` and `VERIFIER_BASE_URL` to isolated ports before running `lab:check --start`.

Branch-based detection is still supported, but `LAB_ID` should be the primary control plane.

### In-person cohorts with no pre-collected emails

- Share the assignment invite URL in the room instead of pre-inviting students by email.
- Let GitHub Classroom create repos as students accept the invite with their GitHub accounts.
- Use the Google Classroom roster plus `course-ops seed-identities` to capture GitHub usernames after students join the Google course.
- Use the exported `accepted_assignments.csv` with `pnpm classroom:set-lab-id`, `pnpm classroom:progress`, and `pnpm classroom:advance`.

## 4) Set lab IDs

- Recommended:
  - Set `LAB_ID=01` (or `02`, etc.) in **Settings → Secrets and variables → Actions → Variables**
  - Advance the learner by updating that value on the repo
- If you want learners to skip ahead:
  - set `LAB_ID` directly to the target lesson
  - or use `pnpm classroom:advance --from 01 --apply` to move everyone currently on Lab 01 forward, regardless of pass/fail
- If you want pass-first advancement:
  - use `pnpm classroom:advance --from 01 --only-ready --apply`
- Fallback:
  - branch naming like `lab-01-issuance` remains supported for local/dev use

## 5) Hook the web course to GitHub Actions (unlocking)

Your web course can unlock the next step when GitHub Actions reports success:

- Require students to authenticate with GitHub OAuth.
- Read their assignment repo’s latest workflow run (`classroom.yml`).
- Unlock the next lab when the run status is **success**.

This avoids sharing your internal repo and keeps the “proof” in GitHub Actions.
