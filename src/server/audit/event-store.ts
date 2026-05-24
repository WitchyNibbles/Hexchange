import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EventLogRecord } from "../domain/trade-log";

export class EventStore {
  constructor(private readonly filePath: string) {}

  async ensureReady(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await readFile(this.filePath, "utf8");
    } catch {
      await writeFile(this.filePath, "[]", "utf8");
    }
  }

  async list(): Promise<EventLogRecord[]> {
    await this.ensureReady();
    const raw = await readFile(this.filePath, "utf8");
    return JSON.parse(raw) as EventLogRecord[];
  }

  async append(event: EventLogRecord): Promise<void> {
    const events = await this.list();
    events.unshift(event);
    await writeFile(this.filePath, JSON.stringify(events.slice(0, 200), null, 2), "utf8");
  }
}
