/** Coalesce events; never drop an event received during a local write/read. */
export class RefreshQueue {
  private timer?: ReturnType<typeof setTimeout>;
  private pending = false;
  private running = false;
  private disposed = false;
  constructor(private readonly blocked: () => boolean, private readonly refresh: () => Promise<void>, private readonly delay = 300) {}
  request() {
    if (this.disposed) return;
    this.pending = true;
    this.schedule();
  }
  private schedule() {
    if (this.timer || this.running || this.disposed) return;
    this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, this.delay);
  }
  private async flush() {
    if (this.disposed || !this.pending) return;
    if (this.blocked()) { this.schedule(); return; }
    this.pending = false;
    this.running = true;
    try { await this.refresh(); }
    finally { this.running = false; if (this.pending) this.schedule(); }
  }
  dispose() { this.disposed = true; this.pending = false; clearTimeout(this.timer); }
}
