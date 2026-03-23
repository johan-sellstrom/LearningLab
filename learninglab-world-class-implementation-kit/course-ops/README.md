# course-ops

Automation scaffolding for:

- provisioning GitHub repos from a starter template
- posting course work to Google Classroom
- syncing grades from GitHub Actions back to Classroom

## Safety model

All operational commands are dry-run by default.

Use `--apply` to make changes.

## Setup

```bash
cp .env.example .env.local
pnpm install
```

Then fill the secrets in `.env.local`.

`course-ops` auto-loads env files in this order:

- `COURSE_OPS_ENV_FILE` if you point it at an external instructor-only env file
- `.env.local`
- `.env`

Both `.env.local` and `.env` are gitignored. Prefer `.env.local` for instructor secrets so the sample `.env.example` stays student-safe.

For short-lived local runs, you can also skip the refresh-token bundle and
export `GOOGLE_ACCESS_TOKEN` directly, for example:

```bash
GOOGLE_ACCESS_TOKEN="$(gcloud auth print-access-token)" \
node src/cli.mjs import-google-roster --config ../catalog/course.config.example.yaml
```

That token still needs Google Classroom scopes; an ordinary Cloud SDK token
without Classroom scopes will be rejected by the API.

For a persistent instructor-only setup, keep the OAuth client JSON local, run:

```bash
gcloud auth application-default login \
  --client-id-file=/absolute/path/to/client_secret_<id>.apps.googleusercontent.com.json \
  --scopes=https://www.googleapis.com/auth/classroom.coursework.students,https://www.googleapis.com/auth/classroom.rosters.readonly,https://www.googleapis.com/auth/classroom.profile.emails,https://www.googleapis.com/auth/classroom.courses.readonly
```

Then copy the `client_id`, `client_secret`, and `refresh_token` into `.env.local`:

```dotenv
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_CLASSROOM_COURSE_ID=...
GITHUB_CLASSROOM_INVITE_URL=...
GITHUB_CLASSROOM_ASSIGNMENT_TITLE=...
GITHUB_CLASSROOM_STARTER_REPO_URL=...
GITHUB_CLASSROOM_STARTER_REPO_TITLE=...
```

The `refresh_token` is stored in `~/.config/gcloud/application_default_credentials.json` after the ADC login flow completes. If you do not want any secrets inside the repo checkout, store that env file elsewhere and run commands with `COURSE_OPS_ENV_FILE=/absolute/path/to/course-ops.env`.

Keep the checked-in course config student-safe by leaving `googleClassroom.courseId` as a placeholder and setting `GOOGLE_CLASSROOM_COURSE_ID` only in your local instructor env file. The CLI will prefer the env override and fail fast if neither a real config value nor the env override is present.

Workflow scaffolding is included under `.github/workflows/` for manual release and nightly grade sync once this package is promoted into its own repo.

## Required external inputs

- a course config YAML
- an assignment YAML
- a Google roster artifact
- a GitHub identity CSV
- for grade sync, a repo-map artifact and a courseWork artifact

## Commands

### Import Google Classroom roster
```bash
node src/cli.mjs import-google-roster \
  --config ../catalog/course.config.example.yaml \
  --out ../artifacts/google-roster.learninglab.json
```

### Join Google roster with GitHub usernames
```bash
node src/cli.mjs join-identities \
  --config ../catalog/course.config.example.yaml \
  --google-roster ../artifacts/google-roster.learninglab.json \
  --identities ../catalog/github-identities.sample.csv \
  --out ../artifacts/joined-roster.learninglab.csv \
  --report-out ../artifacts/joined-roster.learninglab.report.json
```

### Seed an editable GitHub identity CSV from the Google roster
```bash
node src/cli.mjs seed-identities \
  --config ../catalog/course.config.example.yaml \
  --google-roster ../artifacts/google-roster.learninglab.json \
  --out ../artifacts/github-identities.learninglab.csv
```

### Validate
```bash
node src/cli.mjs validate \
  --config ../catalog/course.config.example.yaml \
  --assignment ../catalog/assignments/lab-01.yaml \
  --roster ../artifacts/joined-roster.learninglab.csv
```

### Plan
```bash
node src/cli.mjs plan \
  --config ../catalog/course.config.example.yaml \
  --assignment ../catalog/assignments/lab-01.yaml \
  --roster ../artifacts/joined-roster.learninglab.csv \
  --out ../artifacts/plan.lab-01.md
```

### Provision GitHub repos
```bash
node src/cli.mjs provision-github \
  --config ../catalog/course.config.example.yaml \
  --assignment ../catalog/assignments/lab-01.yaml \
  --roster ../artifacts/joined-roster.learninglab.csv \
  --out ../artifacts/repo-map.lab-01.json \
  --apply
```

### Report cohort progress from GitHub
```bash
node src/cli.mjs progress \
  --config ../catalog/course.config.example.yaml \
  --repo-map ../artifacts/repo-map.lab-01.json \
  --out ../artifacts/progress.lab-01.json
```

### Advance only repos that are ready
```bash
node src/cli.mjs advance-ready \
  --config ../catalog/course.config.example.yaml \
  --progress ../artifacts/progress.lab-01.json \
  --from 01 \
  --out ../artifacts/advance.lab-01.json \
  --apply
```

### Reconcile roster, repo-map, and live GitHub state
```bash
node src/cli.mjs reconcile \
  --config ../catalog/course.config.example.yaml \
  --assignment ../catalog/assignments/lab-01.yaml \
  --roster ../artifacts/joined-roster.learninglab.csv \
  --repo-map ../artifacts/repo-map.lab-01.json \
  --out ../artifacts/reconcile.lab-01.json
```

### Publish Google Classroom course work
```bash
node src/cli.mjs publish-google \
  --config ../catalog/course.config.example.yaml \
  --assignment ../catalog/assignments/lab-01.yaml \
  --out ../artifacts/coursework.lab-01.json \
  --state DRAFT \
  --apply
```

### Sync grades
```bash
node src/cli.mjs sync-grades \
  --config ../catalog/course.config.example.yaml \
  --assignment ../catalog/assignments/lab-01.yaml \
  --repo-map ../artifacts/repo-map.lab-01.json \
  --coursework ../artifacts/coursework.lab-01.json \
  --out ../artifacts/grade-sync.lab-01.json \
  --apply
```

## Notes

- The Google command paths assume one dedicated Google Cloud project and OAuth client for production course operations.
- For an in-person cohort with no pre-collected emails, use GitHub Classroom for repo creation and `seed-identities` after students join the Google Classroom course. The generated CSV already contains the Google-side student emails and IDs; you only need to fill GitHub usernames.
- If `GITHUB_CLASSROOM_INVITE_URL` is set in your local env, `publish-google` and `patch-google` append that invite link and the optional starter repo URL to the Google Classroom coursework materials.
- `join-identities` fails closed when a Google Classroom student has no GitHub username match or when duplicate identity keys exist.
- The GitHub commands assume the automation token can create repos from the template, set repo variables, add collaborators, and read workflow runs.
- `progress` reads `LAB_ID` plus the latest workflow run to identify which repos are ready to advance.
- `advance-ready` consumes the progress artifact and only updates `LAB_ID` for repos already marked ready.
- `reconcile` compares the joined roster, repo-map, and live GitHub state to surface drift before it becomes a grading problem.
- The grade sync writes `draftGrade` by default unless your course config enables assigned-grade publication.
