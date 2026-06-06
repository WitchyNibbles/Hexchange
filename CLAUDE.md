<!-- BEGIN ARCHON MANAGED -->
## archon

- treat `archon` as implicitly invoked on every prompt unless the user explicitly opts out
- treat substantive requests as archon work unless the user opts out
- use `archon-intake` as the default first skill for substantive work

## Workflow contract

Canonical runtime contract:

<!-- archon-workflow-contract:start -->
workflow=archon
workflow_runtime=postgres
active_run_pointer=project_runtime_state.active_run_id
active_task_pointer=project_runtime_state.active_task_id
workflow_documents=workflow_documents
task_queue=project_runtime_state.task_queue
product_state=project_runtime_state.product_state
required_review_roles=reviewer,qa_engineer,security_reviewer
release_candidate_quality_gate=release_readiness_required
review_authority=runtime_authenticated_only
workflow_check=node --experimental-strip-types ./node_modules/archon/src/admin/archon.ts workflow-proof --run-id latest --task-id <task-id>
workflow_check_scope=runtime_authority_only
review_artifact_trust=runtime_records_only
ci_scope=runtime_contract_and_export_regressions
local_live_check=bash scripts/check-archon-workflow-live.sh [--task-id <task-id>]
<!-- archon-workflow-contract:end -->

## Department Workflow

- root thread is engineering manager
- manager/root stays shallow: two inspections max before trivial handling or bounded investigation
- clarify ambiguous intent before planning with targeted questions or explicit assumptions
- on first ask, clarify outcome, constraints, and done criteria unless assumptions are enough
- require Design and Architecture Council review for substantive roadmap, governance, architecture-significant, or user-flow-heavy plan work unless the task is trivial or inherits an approved decision
- keep the council lean, rotating, and time-bounded with a named dissent owner
- inherited task packets must carry explicit workflow artifact refs; use `review_exports=runtime_optional` only when runtime authority covers the gate
- keep `archon` as the default workflow controller even when other tools are available
- when repo-local Grafana configuration is present, use Grafana logs as broader debugging and research evidence; if config is partial or unavailable, say so
- avoid strong negative claims from a narrow pass; gather broader evidence or test an alternate hypothesis first
- route evidence to `solution_architect`, then `planner`, then specialist owner
- use `git_operator` for staging, commit slicing, and commit-message prep when git work is required
- use runtime-backed archon commands for proof, status, and advancement
- substantive work completes only after `reviewer`, `qa_engineer`, and `security_reviewer` gates plus runtime workflow proof

## Autonomy Loop

- for full-project or multi-phase requests, `archon` must operate as a continuing delivery loop
- the manager must not stop after intake, planning, or one implementation slice unless product-level acceptance is complete, a real blocker needs user input, verification is blocked after repair attempts, or the user asked for planning only
- scale, latency, or item volume are not blockers by themselves when the work can be chunked, checkpointed, and resumed
- do not wait for the user to say continue between internal tasks; keep executing until the product-level stop condition is met
- long-running but tractable work must persist concrete progress and continue instead of stopping with a partial-summary handoff
- after each completed task, update runtime product state, update runtime task queue, advance the active task pointer, select the next unblocked task, and continue execution
- a completed phase is not a completed product

## Git hygiene

- branch from updated `origin/main` before task or plan work
- default branch prefixes are `feature/`, `bugfix/`, `hotfix/`, `release/`, `chore/`, `refactor/`, `docs/`, `test/`, `ci/`, and `perf/`
- this git-flow-style default overrides GitHub MCP naming suggestions unless a consuming repo's higher-precedence guideline says otherwise
- in consuming repos, `git_operator` must not stage `.archon/`, `.agents/`, `.claude/`, or `CLAUDE.md` unless the task explicitly targets archon/control-layer installation or maintenance
- do not use `codex` in branch names, commit subjects, PR titles, or PR bodies
- keep commits atomic and briefly named

<!-- END ARCHON MANAGED -->