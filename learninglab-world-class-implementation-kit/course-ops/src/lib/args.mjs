export function parseArgs(argv) {
  const [command, ...rest] = argv
  const flags = {
    command: command || 'help',
    apply: false,
    dryRun: true,
    state: null,
    config: null,
    assignment: null,
    roster: null,
    googleRoster: null,
    identities: null,
    repoMap: null,
    coursework: null,
    courseworkId: null,
    reportOut: null,
    out: null,
    help: false
  }

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i]
    if (arg === '--help' || arg === '-h') flags.help = true
    else if (arg === '--apply') {
      flags.apply = true
      flags.dryRun = false
    } else if (arg === '--dry-run') {
      flags.apply = false
      flags.dryRun = true
    } else if (arg === '--config') flags.config = rest[++i]
    else if (arg.startsWith('--config=')) flags.config = arg.split('=')[1]
    else if (arg === '--assignment') flags.assignment = rest[++i]
    else if (arg.startsWith('--assignment=')) flags.assignment = arg.split('=')[1]
    else if (arg === '--roster') flags.roster = rest[++i]
    else if (arg.startsWith('--roster=')) flags.roster = arg.split('=')[1]
    else if (arg === '--google-roster') flags.googleRoster = rest[++i]
    else if (arg.startsWith('--google-roster=')) flags.googleRoster = arg.split('=')[1]
    else if (arg === '--identities') flags.identities = rest[++i]
    else if (arg.startsWith('--identities=')) flags.identities = arg.split('=')[1]
    else if (arg === '--repo-map') flags.repoMap = rest[++i]
    else if (arg.startsWith('--repo-map=')) flags.repoMap = arg.split('=')[1]
    else if (arg === '--coursework') flags.coursework = rest[++i]
    else if (arg.startsWith('--coursework=')) flags.coursework = arg.split('=')[1]
    else if (arg === '--coursework-id') flags.courseworkId = rest[++i]
    else if (arg.startsWith('--coursework-id=')) flags.courseworkId = arg.split('=')[1]
    else if (arg === '--report-out') flags.reportOut = rest[++i]
    else if (arg.startsWith('--report-out=')) flags.reportOut = arg.split('=')[1]
    else if (arg === '--out') flags.out = rest[++i]
    else if (arg.startsWith('--out=')) flags.out = arg.split('=')[1]
    else if (arg === '--state') flags.state = rest[++i]
    else if (arg.startsWith('--state=')) flags.state = arg.split('=')[1]
    else throw new Error(`Unknown argument: ${arg}`)
  }

  return flags
}

export function usage() {
  return `
Usage:
  node src/cli.mjs import-google-roster --config <file> [--out <file>]
  node src/cli.mjs join-identities --config <file> --google-roster <file> --identities <file> [--out <file>] [--report-out <file>]
  node src/cli.mjs validate --config <file> --assignment <file> [--roster <file>]
  node src/cli.mjs plan --config <file> --assignment <file> --roster <file> [--out <file>]
  node src/cli.mjs provision-github --config <file> --assignment <file> --roster <file> [--out <file>] [--apply]
  node src/cli.mjs progress --config <file> --repo-map <file> [--out <file>]
  node src/cli.mjs publish-google --config <file> --assignment <file> [--out <file>] [--state DRAFT|PUBLISHED] [--apply]
  node src/cli.mjs patch-google --config <file> --assignment <file> (--coursework <file> | --coursework-id <id>) [--out <file>] [--state DRAFT|PUBLISHED] [--apply]
  node src/cli.mjs sync-grades --config <file> --assignment <file> --repo-map <file> (--coursework <file> | --coursework-id <id>) [--out <file>] [--apply]

Notes:
  - all mutating commands default to dry-run
  - add --apply to make changes
`
}
