import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EventStore } from "../../../src/server/audit/event-store";

describe("event store", () => {
  it("supports concurrent appends and reads without exposing partial JSON", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "hexchange-events-"));
    const store = new EventStore(path.join(dir, "events.json"));
    await store.ensureReady();

    const event = {
      id: "event-test",
      kind: "system",
      title: "Validation resumed",
      body: "Kraken paper validation resumed.",
      severity: "info",
      createdAt: new Date().toISOString(),
    } as const;

    const [lists] = await Promise.all([
      Promise.all(Array.from({ length: 25 }, () => store.list())),
      Promise.all(Array.from({ length: 10 }, () => store.append(event))),
    ]);

    expect(lists.every((items) => Array.isArray(items))).toBe(true);
    const finalEvents = await store.list();
    expect(finalEvents[0]).toEqual(event);
  });
});
