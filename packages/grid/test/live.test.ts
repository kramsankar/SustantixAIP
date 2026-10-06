// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import type { ChangeFeed, ChangeFeedItem } from "../src/contract.ts";
import { LiveFeed } from "../src/ui/live.ts";
import { cells, FakeApi, flush, mount, sample } from "./helpers.ts";

const item = (changeSet: string, code: string, op: ChangeFeedItem["op"] = "update", entity = "work_order"): ChangeFeedItem => ({ changeSet, entity, code, op, at: "2026-10-06T00:00:00Z" });

/** A host feed scripted answer by answer, recording each `since`. */
class ScriptedFeed {
  calls: Array<string | null> = [];
  answers: Array<ChangeFeed | Error> = [];
  async changes(since: string | null): Promise<ChangeFeed> {
    this.calls.push(since);
    const a = this.answers.shift() ?? { cursor: `c${this.calls.length}`, items: [], truncated: false };
    if (a instanceof Error) throw a;
    return a;
  }
}

/** Timers run only when the test says so. */
function clock() {
  const queue: Array<{ fn: () => void; ms: number }> = [];
  return {
    queue,
    setTimer: (fn: () => void, ms: number) => (queue.push({ fn, ms }), queue.length),
    clearTimer: () => void queue.splice(0),
    async tick() {
      const t = queue.shift();
      t?.fn();
      for (let i = 0; i < 5; i++) await flush();
      return t?.ms;
    },
  };
}

beforeEach(() => document.body.replaceChildren());

describe("live feed", () => {
  it("places its cursor first, then tells each entity's listeners only of change sets not seen before", async () => {
    const host = new ScriptedFeed();
    const feed = new LiveFeed(host, { setTimer: () => 0, clearTimer: () => undefined });
    const wo: ChangeFeedItem[][] = [];
    const sites: ChangeFeedItem[][] = [];
    feed.subscribe("work_order", (items) => wo.push(items));
    feed.subscribe("site", (items) => sites.push(items));
    host.answers.push({ cursor: "t1", items: [item("cs0", "WO-0001")], truncated: false });
    await feed.poll();
    expect(wo).toEqual([]); // what changed before the page opened is already on screen
    host.answers.push({ cursor: "t2", items: [item("cs1", "WO-0002"), item("cs2", "SP-01", "insert", "site")], truncated: false });
    await feed.poll();
    // The host re-sends an overlap after the cursor; a change set already told is not told twice.
    feed.ignore("cs4");
    host.answers.push({ cursor: "t3", items: [item("cs1", "WO-0002"), item("cs3", "WO-0003", "delete"), item("cs4", "WO-0004")], truncated: false });
    await feed.poll();
    expect(host.calls).toEqual([null, "t1", "t2"]);
    expect(wo.map((x) => x.map((i) => i.code))).toEqual([["WO-0002"], ["WO-0003"]]);
    expect(sites.map((x) => x.map((i) => i.code))).toEqual([["SP-01"]]);
  });

  it("tells every listener to reload when the host's answer overflowed", async () => {
    const host = new ScriptedFeed();
    const feed = new LiveFeed(host, { setTimer: () => 0, clearTimer: () => undefined });
    const seen: boolean[] = [];
    feed.subscribe("work_order", (_i, truncated) => seen.push(truncated));
    await feed.poll();
    host.answers.push({ cursor: "t2", items: [], truncated: true });
    await feed.poll();
    expect(seen).toEqual([true]);
  });

  it("polls while anyone listens and the page is shown, backing off while the host is unreachable", async () => {
    const host = new ScriptedFeed();
    const c = clock();
    let shown = true;
    const feed = new LiveFeed(host, { intervalMs: 1000, visible: () => shown, setTimer: c.setTimer, clearTimer: c.clearTimer });
    const off = feed.subscribe("work_order", () => undefined);
    expect(await c.tick()).toBe(0);
    expect(host.calls).toHaveLength(1);
    host.answers.push(new Error("offline"), new Error("offline"));
    await c.tick();
    expect(c.queue[0]!.ms).toBe(2000);
    await c.tick();
    expect(c.queue[0]!.ms).toBe(4000);
    await c.tick(); // answers again: back to the normal interval
    expect(c.queue[0]!.ms).toBe(1000);
    shown = false;
    await c.tick();
    expect(host.calls).toHaveLength(4); // hidden: no call, but still scheduled
    expect(c.queue).toHaveLength(1);
    off();
    expect(c.queue).toHaveLength(0);
  });

  it("is inert when the host publishes no feed", () => {
    const feed = new LiveFeed({});
    expect(feed.available).toBe(false);
    expect(typeof feed.subscribe("work_order", () => undefined)).toBe("function");
  });
});

describe("grid live refresh", () => {
  async function live(rows = 5) {
    const api = new FakeApi(sample(rows));
    const host = new ScriptedFeed();
    const feed = new LiveFeed(host, { setTimer: () => 0, clearTimer: () => undefined });
    const g = await mount(api, {}, { live: feed });
    await feed.poll(); // cursor
    return { api, host, feed, g };
  }

  it("merges others' changes to its entity, fetching only the changed records", async () => {
    const { api, host, feed, g } = await live();
    api.data[1]!.sla_hours = 99;
    api.data.splice(2, 1);
    api.data.push({ ...api.data[0]!, code: "WO-0099", sla_hours: 7 });
    const before = api.rowsCalls.length;
    host.answers.push({ cursor: "t2", items: [item("cs1", "WO-0002"), item("cs2", "WO-0003", "delete"), item("cs3", "WO-0099", "insert")], truncated: false });
    await feed.poll();
    await flush();
    await flush();
    expect(api.rowsCalls.slice(before)).toEqual([expect.objectContaining({ filters: [{ field: "code", op: "in", value: ["WO-0002", "WO-0003", "WO-0099"] }] })]);
    expect(cells(g, 0)).toEqual(["WO-0001", "WO-0002", "WO-0004", "WO-0005", "WO-0099"]);
    expect(cells(g, 2)[1]).toBe("99");
    expect(g.el.querySelector(".sxg-status")!.textContent).toContain("3 records updated by others");
  });

  it("does not echo its own save, and keeps unsaved edits through an update", async () => {
    const { api, host, feed, g } = await live();
    g.el.querySelector<HTMLElement>('.sxg-body [data-r="0"][data-c="2"]')!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const editor = g.el.querySelector<HTMLInputElement>(".sxg-editor")!;
    editor.value = "12";
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    api.data[3]!.sla_hours = 41;
    host.answers.push({ cursor: "t2", items: [item("cs-other", "WO-0004")], truncated: false });
    await feed.poll();
    await flush();
    await flush();
    expect(g.pendingCount()).toBe(1);
    expect(cells(g, 2)[0]).toBe("12");
    expect(cells(g, 2)[3]).toBe("41");
    expect(g.el.querySelector(".sxg-status")!.textContent).toContain("your unsaved edits are kept");
    expect(await g.save()).toBe(true);
    const mine = api.changeSets[0]!.id;
    const before = api.rowsCalls.length;
    host.answers.push({ cursor: "t3", items: [item(mine, "WO-0001")], truncated: false });
    await feed.poll();
    await flush();
    expect(api.rowsCalls.length).toBe(before);
  });

  it("holds an update while a cell is being edited, and applies it after", async () => {
    const { api, host, feed, g } = await live();
    g.el.querySelector<HTMLElement>('.sxg-body [data-r="0"][data-c="2"]')!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    api.data[4]!.sla_hours = 3;
    host.answers.push({ cursor: "t2", items: [item("cs1", "WO-0005")], truncated: false });
    await feed.poll();
    await flush();
    expect(g.el.querySelector(".sxg-editor")).not.toBeNull(); // the editor stays open
    expect(cells(g, 2)[4]).not.toBe("3");
    g.el.querySelector<HTMLInputElement>(".sxg-editor")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    for (let i = 0; i < 4; i++) await flush();
    expect(cells(g, 2)[4]).toBe("3");
  });

  it("stops listening when destroyed", async () => {
    const { api, host, feed, g } = await live();
    g.destroy();
    const before = api.rowsCalls.length;
    host.answers.push({ cursor: "t2", items: [item("cs1", "WO-0001")], truncated: false });
    await feed.poll();
    await flush();
    expect(api.rowsCalls.length).toBe(before);
  });
});
