import type React from "react";

export type Accessor<T> = (row: T) => number | string | null | undefined;

export type HeatScaleId = "val" | "ps" | "md";

export type ColumnDef<T> = {
  id: string;
  header: string;
  accessor: Accessor<T>;
  sortable?: boolean;
  sortAs?: "number" | "string";
  nulls?: "first" | "last";
  width?: string; // optional fixed col width
  className?: string;
  heat?: { scale: HeatScaleId }; // e.g. VAL/PS/MD overlays
  render?: (value: ReturnType<Accessor<T>>, row: T) => React.ReactNode;
  defaultDir?: "asc" | "desc";
};

export type ColumnGroup<T> = {
  header: string;
  children: ColumnDef<T>[];
};

export type TablePreset<T> = ColumnGroup<T>[];
