# RSAC Attendee Quick Start

Use GitHub Codespaces. Do not spend the first 10 minutes on local setup.

## What you need

- A GitHub account
- The GitHub Classroom invite link shared by the instructors
- A modern browser

Google Classroom is optional for this lab. Your repo and coding environment come from GitHub Classroom and GitHub Codespaces.

## Recommended path: GitHub Codespaces

1. Open the GitHub Classroom invite and accept the assignment.
2. Open the new repository GitHub creates for you.
3. Click `Code` -> `Codespaces` -> `Create codespace on main`.
4. Wait for the Codespace setup to finish.
   - This repo's dev container already runs `pnpm install -r --frozen-lockfile` and `pnpm env:setup`.
5. In the Codespaces terminal, run:

```bash
pnpm dev
```

6. Open the forwarded ports for:
   - `3001` (`Issuer`)
   - `3002` (`Verifier`)
7. Open [labs/README-lab-00-start.md](labs/README-lab-00-start.md) and follow Lab 00.

## First 10 minutes checklist

- Your GitHub Classroom repo exists under your GitHub account.
- Your Codespace is running on `main`.
- `pnpm dev` is running without errors.
- You can open both forwarded app ports.
- You have Lab 00 open in another tab.

## If you get stuck

- Bring a facilitator your repo URL and the exact terminal error.
- If the Codespace creation button is unavailable, make sure you are in your own assignment repo, not the starter template.
- If a port does not open, confirm `pnpm dev` is still running.

## Facilitator support lane

Use this order for quick triage:

1. Confirm the student accepted the correct GitHub Classroom invite.
2. Confirm they are in their own assignment repo, not the template repo.
3. Confirm the Codespace finished booting before they ran anything manually.
4. Confirm `pnpm dev` is running and ports `3001` and `3002` are forwarded.
5. If the student is still blocked, keep them on Lab 00 and pair them with a facilitator instead of switching them to local setup.
