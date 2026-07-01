---
name: 5 Whys
description: Repeatedly ask "Why?" to drill down past symptoms and find the root cause of a problem.
---

# 5 Whys

## When to Use This Skill
Use when analyzing a bug, an operational failure, or a recurring issue to find the underlying root cause.

## When Not to Use This Skill
Avoid when the problem is extremely complex, involves many interacting variables (requires fishbone/Ishikawa diagram), or when you just need a quick patch.

## Goal
Identify the fundamental systemic cause of an issue rather than just treating the surface-level symptoms.

## Workflow
1. State the problem clearly.
2. Ask "Why did this happen?" and record the answer.
3. For the answer given, ask "Why?" again.
4. Repeat this process until you reach a systemic or fundamental cause (usually around 5 times).
5. Propose a countermeasure or fix for the root cause.

## Validation
- The final "Why" addresses a systemic process or policy, not just a technical glitch or human error.
- The proposed solution prevents the issue from recurring.

## Safety Rules
- Do not blame individuals; focus on process failures.
- Do not stop at the first technical reason.

## Output Format
A root-cause analysis document listing the problem, the chain of "Whys," and the recommended systemic fix.

## References
- Incident reports, error logs.

## Stop and Escalate If
- The trail leads to a department or system outside of your scope/control.
- More than 5 "Whys" still do not reveal a clear root cause.
