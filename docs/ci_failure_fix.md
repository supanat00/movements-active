---
name: CI Failure Fix
description: Diagnose and resolve failures in the Continuous Integration (CI) pipeline.
---

# CI Failure Fix

## When to Use This Skill
Use when a CI build, test suite, or linting job fails on a branch or Pull Request.

## When Not to Use This Skill
Do not use when the failure is caused by external infrastructure outages (e.g., GitHub Actions being down) or missing secrets.

## Goal
Restore the CI pipeline to a passing state quickly and correctly.

## Workflow
1. Read the CI error logs to identify the exact step that failed.
2. Determine the root cause (e.g., compile error, test failure, lint violation).
3. Formulate and apply the necessary code fix.
4. Run the failing check locally (if possible) to verify the fix.
5. Commit and push the fix to trigger the CI again.

## Validation
- The CI pipeline completes successfully after the fix is applied.
- No existing functionality is broken by the fix.

## Safety Rules
- Do not disable failing tests just to make the CI pass.
- Do not bypass security or formatting checks.
- Do not modify CI configuration files unless the configuration itself is broken.

## Output Format
Fixed code committed to the branch, along with a brief explanation of the root cause and the applied solution.

## References
- CI configuration files (e.g., `.github/workflows`).
- Local testing and linting scripts.

## Stop and Escalate If
- The failure requires modifying core infrastructure, permissions, or secrets.
- The root cause is a flaky test that cannot be reliably reproduced.
