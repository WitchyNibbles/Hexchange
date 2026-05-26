import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EventLogRecord } from "../domain/trade-log";

export class EventStore {
  private writeQueue: Promise<void> = Promise.resolve();

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
    await this.writeQueue;
    return this.readEvents();
  }

  async append(event: EventLogRecord): Promise<void> {
    const writeTask = this.writeQueue.then(async () => {
      const events = await this.readEvents();
      events.unshift(event);
      await this.writeEvents(events.slice(0, 200));
    });

    this.writeQueue = writeTask.catch(() => {});
    await writeTask;
  }

  private async readEvents(): Promise<EventLogRecord[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return raw.trim() ? (JSON.parse(raw) as EventLogRecord[]) : [];
    } catch (error) {
      if (error instanceof SyntaxError) {
        await this.writeEvents([]);
        return [];
      }
      throw error;
    }
  }

  private async writeEvents(events: EventLogRecord[]): Promise<void> {
    const tempPath = `${this.filePath}.tmp`;
    await writeFile(tempPath, JSON.stringify(events, null, 2), "utf8");
    await rename(tempPath, this.filePath);
  }
}
