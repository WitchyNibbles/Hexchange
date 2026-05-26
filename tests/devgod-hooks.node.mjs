import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateStop } from "../plugins/devgod/scripts/hook-policy.mjs";
import { readActiveTaskContext } from "../plugins/devgod/scripts/hook-utils.mjs";

async function createHookRepo(prefix, taskId) {
  const repoRoot = await mkdtemp(join(tmpdir(), prefix));
  await mkdir(join(repoRoot, ".devgod", "work", "tasks"), { recursive: true });
  await mkdir(join(repoRoot, ".devgod", "work", "daemon"), { recursive: true });
  await writeFile(
    join(repoRoot, ".devgod", "ACTIVE"),
    `task_id=${taskId}\nworkflow=devgod\nstate=active\n`,
    "utf8"
  );
  await writeFile(
    join(repoRoot, ".devgod", "work", "tasks", `task-${taskId}.md`),
    ["# Task Packet", "", "## Allowed write scope", "", "- `src/runtime`", ""].join("\n"),
    "utf8"
  );
  return repoRoot;
}

test("devgod hook allows explicit external elapsed-time blockers to end the loop", () => {
  const parsed = evaluateStop(
    {
      last_assistant_message: [
        "The real blocker is external elapsed time, not code or setup.",
        "",
        "build-hexchange-mvp cannot be completed yet because the live-readiness rule for Kraken crypto requires 24 observed paper-trading hours.",
        "The remaining blocker is approximately 17.5 more observed hours of Kraken paper validation.",
        "The session is already running and gathering evidence; no further local code change can satisfy that gate until time passes."
      ].join("\n")
    },
    {
      repoRoot: "/tmp/hexchange-hook-test",
      activeTaskId: "task-hook-external-wait",
      allowedWriteScope: ["src/runtime"],
      queueCurrentTaskId: undefined
    }
  );

  assert.equal(parsed, undefined);
});

test("devgod hook infers defer_same_thread from a materialized app automation request", async () => {
  const repoRoot = await createHookRepo("hexchange-hook-app-request-", "task-app-request-intent");

  try {
    await writeFile(
      join(repoRoot, ".devgod", "work", "daemon", "app-automation-request.json"),
      `${JSON.stringify(
        {
          tool: "automation_update",
          request: {
            mode: "suggested_create",
            kind: "heartbeat",
            destination: "thread",
            name: "Devgod same-thread follow-up: task-app-request-intent",
            prompt: "Resume deferred devgod work.\nContinuation intent: defer_same_thread\n",
            rrule: "FREQ=MINUTELY;INTERVAL=30",
            status: "ACTIVE"
          },
          context: {
            provider: "codex_app_thread_automation",
            workspaceSlug: "workspace",
            projectSlug: "project",
            activeRunId: "run-123",
            activeTaskId: "task-app-request-intent",
            targetId: "artifact:resume",
            targetMode: "same_thread",
            generatedAt: "2026-05-26T10:00:00.000Z"
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const context = await readActiveTaskContext({ repoRoot });
    const parsed = evaluateStop(
      { last_assistant_message: "The current turn is complete." },
      context
    );

    assert.equal(context.activeTaskId, "task-app-request-intent");
    assert.equal(context.continuationIntent, "defer_same_thread");
    assert.equal(parsed, undefined);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("devgod hook infers defer_fresh_run from a materialized CLI scheduler request", async () => {
  const repoRoot = await createHookRepo("hexchange-hook-cli-request-", "task-cli-request-intent");

  try {
    await writeFile(
      join(repoRoot, ".devgod", "work", "daemon", "cli-scheduler-request.json"),
      `${JSON.stringify(
        {
          tool: "codex",
          request: {
            subcommand: "exec",
            promptPath: ".devgod/work/daemon/cli-scheduler-prompt.txt",
            outputSchemaPath: ".devgod/work/daemon/cli-scheduler-output-schema.json",
            json: true,
            cwd: repoRoot,
            runnable: true
          },
          scheduler: {
            scheduleKind: "cron",
            schedule: "0 * * * *",
            launcherHints: [],
            manualReviewRequired: false
          },
          context: {
            provider: "codex_cli_exec_scheduler",
            workspaceSlug: "workspace",
            projectSlug: "project",
            activeRunId: "run-456",
            activeTaskId: "task-cli-request-intent",
            targetId: "artifact:fresh-run",
            targetMode: "fresh_run",
            continuationIntent: "defer_fresh_run",
            generatedAt: "2026-05-26T10:00:00.000Z"
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const context = await readActiveTaskContext({ repoRoot });
    const parsed = evaluateStop(
      { last_assistant_message: "The current turn is complete." },
      context
    );

    assert.equal(context.activeTaskId, "task-cli-request-intent");
    assert.equal(context.continuationIntent, "defer_fresh_run");
    assert.equal(parsed, undefined);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
