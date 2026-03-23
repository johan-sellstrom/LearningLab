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

### Seed an editable GitHub identity CSV from the Google roster
```bash
node src/cli.mjs seed-identities \
  --config ../catalog/course.config.example.yaml \
  --google-roster ../artifacts/google-roster.learninglab.json \
  --out ../artifacts/github-identities.learninglab.csv
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

### Advance ready repos to the next lab
```bash
node src/cli.mjs advance-ready \
  --config ../catalog/course.config.example.yaml \
  --progress ../artifacts/progress.lab-01.json \
  --from 01 \
  --out ../artifacts/advance.lab-01.json \
  --apply
```

### Reconcile roster, repo map, and GitHub state
```bash
node src/cli.mjs reconcile \
  --config ../catalog/course.config.example.yaml \
  --assignment ../catalog/assignments/lab-01.yaml \
  --roster ../artifacts/joined-roster.learninglab.csv \
  --repo-map ../artifacts/repo-map.lab-01.json \
  --out ../artifacts/reconcile.lab-01.json
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
2. seed-identities when the cohort is in-person and GitHub usernames are not known ahead of time
3. join-identities
4. validate
5. plan
6. provision-github dry-run
7. provision-github apply
8. progress
9. advance-ready
10. reconcile
11. publish-google draft
12. UI check in Classroom
13. publish-google published or patch state
14. monitor first workflows

## In-person / no-email Wednesday flow

Use this when students will join live and you do not have their emails in advance.

1. Create or reuse one GitHub Classroom assignment backed by the public template repo.
2. Share the GitHub Classroom invite link in the room or inside Google Classroom.
3. Ask students to join the Google Classroom course with the class code or invite link.
4. Run `import-google-roster`.
5. Run `seed-identities` to generate a CSV prefilled with Google student names, emails, and user IDs.
6. Fill only the `github_username` column during class.
7. Run `join-identities`.
8. Use the existing GitHub Classroom helper scripts with the exported `accepted_assignments.csv` for `LAB_ID`, progress, and advancement operations.

### Grading
1. progress identifies repos that have passed the current lab
2. advance-ready moves only the passing repos to the next `LAB_ID`
3. reconcile flags repo drift before syncing grades
4. nightly grade sync writes `draftGrade`
5. instructor reviews outliers
6. when ready, rerun with assigned-grade publication enabled

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

### Advancement artifact
Contains:
- apply/dry-run mode
- optional `fromLabId` filter
- counts for advanced vs skipped repos
- per-repo advancement decision and resulting `LAB_ID`

### Reconciliation artifact
Contains:
- joined-roster coverage vs repo-map coverage
- missing or unexpected repo-map entries
- repo existence and repo-name drift
- current vs expected `LAB_ID`
- collaborator presence for the expected GitHub username
- latest workflow state and run URL

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
