/**
 * Live refresh. Every host publishes the change sets applied in the tenant as a feed: business codes and operations
 * only, never who made them or the values. One LiveFeed per page polls it while the page is visible and tells each
 * open grid which of its records changed, so a grid shows a colleague's or an integration's change without a reload.
 * Change sets this page applied itself are skipped: the grid that saved them has already reloaded.
 */
import type { ChangeFeedItem } from "../contract.ts";
import type { GridApi } from "./api.ts";

export type { ChangeFeed, ChangeFeedItem } from "../contract.ts";

export type LiveListener = (items: ChangeFeedItem[], truncated: boolean) => void;

export interface LiveFeedOptions {
  intervalMs?: number;
  /** True while the page is shown; polling pauses otherwise. */
  visible?: () => boolean;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export const LIVE_INTERVAL_MS = 15_000;
/** Change-set ids remembered to drop the host's overlap; far more than one overlap window ever carries. */
const SEEN_MAX = 5000;

export class LiveFeed {
  private cursor: string | null = null;
  private readonly seen = new Set<string>();
  private readonly listeners = new Map<string, Set<LiveListener>>();
  private timer: unknown = null;
  private running = false;
  private failures = 0;
  private stopped = false;
  private readonly interval: number;
  private readonly visible: () => boolean;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  constructor(
    private readonly api: Pick<GridApi, "changes">,
    opts: LiveFeedOptions = {},
  ) {
    this.interval = opts.intervalMs ?? LIVE_INTERVAL_MS;
    this.visible = opts.visible ?? (() => typeof document === "undefined" || document.visibilityState !== "hidden");
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  /** Whether the host publishes a feed at all. */
  get available(): boolean {
    return typeof this.api.changes === "function";
  }

  /** Calls `fn` with the changes to `entity`; returns the unsubscribe. Polling runs while anyone listens. */
  subscribe(entity: string, fn: LiveListener): () => void {
    if (!this.available) return () => undefined;
    const set = this.listeners.get(entity) ?? new Set();
    set.add(fn);
    this.listeners.set(entity, set);
    this.schedule(0);
    return () => {
      set.delete(fn);
      if (!set.size) this.listeners.delete(entity);
      if (!this.listeners.size) this.halt();
    };
  }

  /** A change set this page applied: not news to anyone here. */
  ignore(changeSet: string): void {
    this.remember(changeSet);
  }

  stop(): void {
    this.stopped = true;
    this.halt();
  }

  /** One poll now (tests, and a page coming back into view). */
  async poll(): Promise<void> {
    if (this.running || !this.api.changes || this.stopped) return;
    this.running = true;
    try {
      const feed = await this.api.changes(this.cursor);
      const first = this.cursor === null;
      this.cursor = feed.cursor;
      this.failures = 0;
      // The first answer only places the cursor: what changed before the page opened is already on screen.
      if (first) return;
      const fresh = feed.items.filter((i) => !this.seen.has(i.changeSet));
      for (const i of feed.items) this.remember(i.changeSet);
      if (feed.truncated) {
        for (const set of this.listeners.values()) for (const fn of set) fn([], true);
        return;
      }
      const byEntity = new Map<string, ChangeFeedItem[]>();
      for (const i of fresh) byEntity.set(i.entity, [...(byEntity.get(i.entity) ?? []), i]);
      for (const [entity, items] of byEntity) for (const fn of this.listeners.get(entity) ?? []) fn(items, false);
    } catch {
      // A host that is briefly unreachable is asked again later, less often.
      this.failures = Math.min(this.failures + 1, 6);
    } finally {
      this.running = false;
    }
  }

  private remember(id: string): void {
    this.seen.delete(id);
    this.seen.add(id);
    if (this.seen.size > SEEN_MAX) this.seen.delete(this.seen.values().next().value as string);
  }

  private schedule(ms: number): void {
    if (this.timer !== null || this.stopped || !this.listeners.size) return;
    this.timer = this.setTimer(() => {
      this.timer = null;
      const run = this.visible() ? this.poll() : Promise.resolve();
      void run.then(() => this.schedule(this.interval * 2 ** this.failures));
    }, ms);
  }

  private halt(): void {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }
}
