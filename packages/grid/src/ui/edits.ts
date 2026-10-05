/**
 * Pending edits: cell changes, new rows and deletions, held in the grid until the user saves them as one change set.
 * Every edited row remembers the row_version it was read at, so a concurrent change is detected, never overwritten.
 */
import type { ChangeItem, ChangeSetRequest } from "../contract.ts";

type Row = Record<string, unknown>;

interface Pending {
  op: "insert" | "update" | "delete";
  code: string;
  baseVersion?: number;
  values: Record<string, unknown>;
}

export class EditBuffer {
  private readonly pending = new Map<string, Pending>();
  /** Fixed per pending set, so a retried save replays instead of applying twice. */
  private setId: string | null = null;

  constructor(private readonly entity: string, private readonly newId: () => string = () => crypto.randomUUID()) {}

  get size(): number {
    return this.pending.size;
  }

  has(code: string): boolean {
    return this.pending.has(code);
  }

  /** The value to show for a cell: the pending edit when there is one. */
  value(row: Row, field: string): unknown {
    const p = this.pending.get(String(row.code));
    return p && field in p.values ? p.values[field] : row[field];
  }

  isDirty(code: string, field: string): boolean {
    return !!this.pending.get(code)?.values && field in this.pending.get(code)!.values;
  }

  isDeleted(code: string): boolean {
    return this.pending.get(code)?.op === "delete";
  }

  isNew(code: string): boolean {
    return this.pending.get(code)?.op === "insert";
  }

  set(row: Row, field: string, value: unknown): void {
    const code = String(row.code);
    let p = this.pending.get(code);
    if (!p) {
      p = { op: "update", code, baseVersion: Number(row.row_version), values: {} };
      this.pending.set(code, p);
    }
    if (p.op === "delete") return;
    // Setting a cell back to what was read drops the edit.
    if (p.op === "update" && sameValue(row[field], value)) delete p.values[field];
    else p.values[field] = value;
    if (p.op === "update" && !Object.keys(p.values).length) this.pending.delete(code);
    this.setId = null;
  }

  insert(code: string, values: Record<string, unknown> = {}): void {
    if (this.pending.has(code)) throw new Error(`${code} is already pending`);
    this.pending.set(code, { op: "insert", code, values: { ...values } });
    this.setId = null;
  }

  remove(row: Row): void {
    const code = String(row.code);
    if (this.pending.get(code)?.op === "insert") this.pending.delete(code);
    else this.pending.set(code, { op: "delete", code, baseVersion: Number(row.row_version), values: {} });
    this.setId = null;
  }

  /** Re-bases an edited row on the current version after the user chose to keep their edit over a conflict. */
  rebase(code: string, rowVersion: number): void {
    const p = this.pending.get(code);
    if (p && p.op !== "insert") p.baseVersion = rowVersion;
    this.setId = null;
  }

  discard(code?: string): void {
    if (code === undefined) this.pending.clear();
    else this.pending.delete(code);
    this.setId = null;
  }

  pendingCodes(): string[] {
    return [...this.pending.keys()];
  }

  toChangeSet(): ChangeSetRequest | null {
    if (!this.pending.size) return null;
    this.setId ??= this.newId();
    const items: ChangeItem[] = [...this.pending.values()].map((p) => ({
      entity: this.entity,
      op: p.op,
      code: p.code,
      ...(p.op !== "insert" ? { baseVersion: p.baseVersion } : {}),
      ...(p.op !== "delete" ? { values: { ...p.values } } : {}),
    }));
    return { id: this.setId, source: "grid", items };
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  if ((a === null || a === undefined || a === "") && (b === null || b === undefined || b === "")) return true;
  return String(a) === String(b);
}
