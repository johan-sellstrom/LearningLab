# Ops runbook

## Repository layout

- `catalog/` — course and assignment config
- `course-ops/` — CLI and automation workflows
- `artifacts/` — generated outputs
- `overlays/instructor-repo/` — starter-template generator + patch scaffolds

## Common commands

All commands below are run from `course-ops/`.

### Import the enrolled Google Classroom roster
```bash
node src/cli.mjs import-google-roster \
  --config ../catalog/course.config.example.yaml \
  --out ../artifacts/google-roster.learninglab.json
```

### Join the Google roster to GitHub usernames
```bash
node src/cli.mjs join-identities \
  --config ../catalog/course.config.example.yaml \
  --google-roster ../artifacts/google-roster.learninglab.json \
  --identities ../catalog/github-identities.sample.csv \
  --out ../artifacts/joined-roster.learninglab.csv \
  --report-out ../artifacts/joined-roster.learninglab.report.json
```

### Validate config
```bash
node src/cli.mjs validate \
  --config ../catalog/course.config.example.yaml \
  --assignment ../catalog/assignments/lab-01.yaml \
  --roster ../artifacts/joined-roster.learninglab.csv
```

### Dry-run the release plan
```bash
node src/cli.mjs plan \
  --config ../catalog/course.config.example.yaml \
  --assignment ../catalog/assignments/lab-01.yaml \
  --roster ../artifacts/joined-roster.learninglab.csv \
  --out ../artifacts/plan.lab-01.md
```

### Dry-run GitHub provisioning
```bash
node src/cli.mjs provision-github \
  --config ../catalog/course.config.example.yaml \
  --assignment ../catalog/assignments/lab-01.yaml \
  --roster ../artifacts/joined-roster.learninglab.csv \
  --out ../artifacts/repo-map.lab-01.json
```

### Apply GitHub provisioning
```bash
node src/cli.mjs provision-github \
  --config ../catalog/course.config.example.yaml \
  --assignment ../catalog/assignments/lab-01.yaml \
  --roster ../artifacts/joined-roster.learninglab.csv \
  --out ../artifacts/repo-map.lab-01.json \
  --apply
```

### Inspect GitHub repo progress
```bash
node src/cli.mjs progress \
  --config ../catalog/course.config.example.yaml \
  --repo-map ../artifacts/repo-map.lab-01.json \
  --out ../artifacts/progress.lab-01.json
```

### Create Classroom coursework as draft
```bash
node src/cli.mjs publish-google \
  --config ../catalog/course.config.example.yaml \
  --assignment ../catalog/assignments/lab-01.yaml \
  --out ../artifacts/coursework.lab-01.json \
  --state DRAFT \
  --apply
```

### Sync draft grades
```bash
node src/cli.mjs sync-grades \
  --config ../catalog/course.config.example.yaml \
  --assignment ../catalog/assignments/lab-01.yaml \
  --repo-map ../artifacts/repo-map.lab-01.json \
  --coursework ../artifacts/coursework.lab-01.json \
  --out ../artifacts/grade-sync.lab-01.json \
  --apply
```

## Recommended release pattern

### Release
1. import-google-roster
2. join-identities
3. validate
4. plan
5. provision-github dry-run
6. provision-github apply
7. progress
8. publish-google draft
9. UI check in Classroom
10. publish-google published or patch state
11. monitor first workflows

### Grading
1. progress identifies repos that have passed the current lab
2. nightly grade sync writes `draftGrade`
3. instructor reviews outliers
4. when ready, rerun with assigned-grade publication enabled

## Expected artifacts

### Plan artifact
Contains:
- assignment metadata
- due date
- repo naming plan
- collaborator mapping
- warnings / missing data

### Google roster artifact
Contains:
- Google user ID
- student name
- student email

### Joined roster report
Contains:
- match counts
- duplicate Google keys
- duplicate GitHub identity keys
- unmatched Google students
- the final matched provisioning roster when the join succeeds

### Repo map artifact
Contains:
- student name
- student email
- GitHub username
- repo owner
- repo name
- repo URL
- applied `LAB_ID`

### Progress artifact
Contains:
- current `LAB_ID`
- next eligible `LAB_ID`
- latest workflow status and conclusion
- ready-to-advance flag
- workflow run URL

### Coursework artifact
Contains:
- `courseWorkId`
- state
- title
- max points
- due date
- materials

### Grade sync artifact
Contains:
- repo
- latest workflow status
- conclusion
- computed grade
- target student
- target submission
- apply/dry-run result
- error, if any

## Troubleshooting

### Missing GitHub username
Do not provision blindly. Fix the GitHub identity CSV and rerun `join-identities`.

### Repo already exists
Treat as reusable if it matches the expected owner and name.

### Google student not found by email
Try:
- `google_user_id` in the roster CSV
- roster/email scopes
- checking whether the student is actually enrolled in the target course

### No student submission found
Likely causes:
- coursework created in the wrong course
- coursework not created by the same Google Cloud project / OAuth client family you are now using
- student not yet present in the course

### Grades visible too early
Run sync in draft-only mode until the process is stable.
