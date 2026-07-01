---
name: PR Review
description: Review a Pull Request for code quality, potential bugs, and adherence to style guidelines.
---

# PR Review

## When to Use This Skill
Use when a new Pull Request is opened or updated and requires a thorough code review before merging.

## When Not to Use This Skill
Do not use for massive architectural overhauls or PRs that lack a clear description of the problem being solved.

## Goal
Ensure code quality, catch bugs early, enforce coding standards, and provide constructive feedback to the author.

## Workflow
1. Read the PR description and understand the context and objectives.
2. Review the code diffs carefully, focusing on logic, security, and performance.
3. Check if adequate tests have been added or updated.
4. Verify that the code adheres to the team's style guide.
5. Leave clear, actionable, and respectful inline comments.

## Validation
- All feedback is actionable and specific.
- Critical logic paths have been scrutinized.
- No false positives or overly pedantic complaints.

## Safety Rules
- Do not approve code with obvious security vulnerabilities.
- Do not be disrespectful or dismissive in comments.
- Do not push direct commits to the author's branch without permission.

## Output Format
A structured PR review summary and inline comments on specific lines of code.

## References
- Internal coding guidelines and style guide.
- Project architecture documentation.

## Stop and Escalate If
- The PR is too large to review effectively (e.g., >500 lines of complex logic).
- The PR introduces fundamental architectural changes that need team discussion.
