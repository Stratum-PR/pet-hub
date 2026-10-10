#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json → ignoreCommand).
# Exit 0 = skip this deployment, exit 1 = build it.
# Goal: stay under the free plan's deployment storage. Each deployment stores the full build (~30 MB),
# so only main (grumi.pet) and dev (dev.grumi.pet) deploy, and only when something the site uses changed.

branch="${VERCEL_GIT_COMMIT_REF:-}"

if [[ "$branch" != "main" && "$branch" != "dev" ]]; then
  echo "Skip: branch '$branch' doesn't deploy (only main and dev). Test locally with npm run dev."
  exit 0
fi

# Compare with the previous deployed commit when Vercel gives it, else with the parent commit.
base="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
if ! git cat-file -e "$base" 2>/dev/null; then
  echo "Build: can't see the previous commit, building to be safe."
  exit 1
fi

# Paths that never change the website.
if git diff --quiet "$base" HEAD -- . \
  ':(exclude)docs' ':(exclude)*.md' ':(exclude)designs' ':(exclude)supabase' \
  ':(exclude)test-env' ':(exclude)e2e' ':(exclude)reports' ':(exclude).github' ':(exclude)scripts/prod-checks'; then
  echo "Skip: only docs, database or test files changed."
  exit 0
fi

echo "Build: site files changed on $branch."
exit 1
