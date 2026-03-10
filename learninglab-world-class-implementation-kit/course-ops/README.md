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
cp .env.example .env
pnpm install
```

Then fill the secrets in `.env`.

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
- `join-identities` fails closed when a Google Classroom student has no GitHub username match or when duplicate identity keys exist.
- The GitHub commands assume the automation token can create repos from the template, set repo variables, add collaborators, and read workflow runs.
- `progress` reads `LAB_ID` plus the latest workflow run to identify which repos are ready to advance.
- The grade sync writes `draftGrade` by default unless your course config enables assigned-grade publication.
