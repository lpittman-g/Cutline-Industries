# Auto-approve Cursor PRs

Cutline Industries can merge Cloud Agent PRs without a human click once this workflow is on `main`.

## What it does

Workflow: [`.github/workflows/auto-approve-cursor-prs.yml`](../.github/workflows/auto-approve-cursor-prs.yml)

For PRs whose head branch starts with `cursor/`:

1. Runs lint → typecheck → test → build  
2. Marks the PR ready for review (undrafts)  
3. Approves as `github-actions`  
4. Squash-merges and deletes the branch  

## One-time setup (repo owner)

Do this once in GitHub → **Settings**:

1. **General → Pull Requests**  
   - Enable **Allow squash merging**  
   - Enable **Allow auto-merge** (fallback if immediate merge is blocked)

2. Optional — if approve/merge fails under branch protection:  
   - Create a fine-grained PAT with `pull_requests: write` + `contents: write`  
   - Add repo secret **`AUTO_APPROVE_TOKEN`**

3. Merge the PR that adds this workflow to `main`. After that, future `cursor/*` PRs auto-merge when green.

## Scope

| Included | Excluded |
|----------|----------|
| `cursor/**` branches | Other branch prefixes |
| Same-repo PRs | External forks (token limits) |

## Manual override

Close the PR or push a failing check to stop the merge. Rename the branch off `cursor/` to skip the workflow.
