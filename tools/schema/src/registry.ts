/** The AIP data contract, derived from the governed workbook and shared by every backend. */

export type ColumnKind = "text" | "memo" | "url" | "integer" | "bigint" | "decimal" | "money" | "date" | "datetime" | "boolean";

export interface ColumnDef {
  /** Header exactly as it appears in the governed workbook. */
  source: string;
  /** Backend-neutral snake_case name (no publisher prefix). */
  name: string;
  label: string;
  kind: ColumnKind;
  maxLength?: number;
  /** Decimal places for decimal / money. */
  precision?: number;
  /** ISO-4217 code of the source values for money columns. */
  currency?: string;
  nullable: boolean;
}

export interface TableDef {
  sheet: string;
  /** snake_case table name (no prefix). */
  name: string;
  label: string;
  pluralLabel: string;
  domain: string;
  /** Source headers forming the business key; empty = synthetic row key. */
  key: string[];
  columns: ColumnDef[];
  rowCount: number;
}

export interface Registry {
  version: 1;
  source: string;
  sourceSha256: string;
  defaultCurrency: string;
  tables: TableDef[];
}

/** Longest name (without prefix) accepted so every backend's identifier limit holds. */
export const MAX_NAME = 40;
