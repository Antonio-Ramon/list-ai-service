---
name: create-commit
description: 'Analyze the current git diff and create one or more conventional commits, grouping files by domain context. Use when the user says "create commit", "commit my changes", or "/create-commit".'
---

# Create Commit Skill

Analyze the current git diff and create one or more conventional commits, grouping files by domain context. All commit messages must be in **English**.

## Steps

### Step 1 — Gather changes

Run these in parallel:
- `git status --short` — list all changed/untracked files
- `git diff HEAD` — full diff of staged + unstaged changes

If there are no changes, stop and tell the user there is nothing to commit.

### Step 2 — Group files by context

Map each changed file to a domain group using the path as the key signal:

| Path prefix | Group name |
|---|---|
| `features/auth/` | auth |
| `features/broker/` | broker |
| `features/strategy/` | strategy |
| `features/trading/` | trading |
| `features/modedev/` | modedev |
| `features/marketplace/` | marketplace |
| `features/live-monitor/` | live-monitor |
| `features/trial/` | trial |
| `features/quota/` | quota |
| `features/feedback/` | feedback |
| `features/<other>/` | `<other>` |
| `services/` | services |
| `ServerActions/` | server-actions |
| `app/api/` | api |
| `app/` (pages) | app |
| `lib/providers/` | providers |
| `lib/utils/` | utils |
| `lib/hooks/` | hooks |
| `components/` | ui |
| `styles/` | styles |
| `supabase/` | db |
| `public/` | assets |
| Root config files (`*.config.*`, `*.json`, `*.yaml`, `.env*`, `tsconfig*`) | config |
| `docs/`, `*.md` | docs |
| `src/middleware/` | middleware |
| `src/routes/` | routes |
| `src/` (other) | src |

Files that span multiple unrelated groups stay in their own group. If a group has only one or two files and they logically belong together with another group, merge them.

If `$ARGUMENTS` is provided, use it as additional context (ticket, scope override, etc.) for the commit message.

### Step 3 — Determine commit type per group

- `feat` — new feature or capability
- `fix` — bug fix
- `refactor` — restructuring without behavior change
- `chore` — tooling, dependencies, config, build
- `style` — formatting, CSS, visual-only changes
- `docs` — documentation only
- `perf` — performance improvement
- `test` — adding or fixing tests

### Step 4 — Write the commit message

Format: `type(scope): short description`

Rules:
- English only
- Imperative mood: "add", "fix", "remove", "update"
- Max 72 characters
- No period at the end
- No vague words like "various", "misc", "changes", "updates"

### Step 5 — Commit each group

Commit order: `config`/`db` → `src`/`middleware`/`routes` → `features` → `app`/`ui`

For each group:
```
git add <file1> <file2> ...   # NEVER use git add . or -A
git commit -m "type(scope): description"
```

After all commits, display `git log --oneline -10`.
