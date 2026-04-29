"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Column<T> {
  key: keyof T | string;
  header: string;
  // Optional formatter for the cell (e.g. number formatting). Defaults to String(value).
  format?: (row: T) => string | number | null | undefined;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  filename: string;
  label?: string;
  disabled?: boolean;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Escape per RFC 4180 — wrap in quotes if contains comma, quote, newline, or
  // semicolon (Arabic Excel may use semicolon as list separator).
  if (/[",;\n\r\t]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function ExportCsvButton<T>({
  rows,
  columns,
  filename,
  label = "تصدير Excel",
  disabled,
}: Props<T>) {
  const handleClick = () => {
    const header = columns.map((c) => csvCell(c.header)).join(",");
    const body = rows
      .map((row) =>
        columns
          .map((c) => {
            const raw = c.format
              ? c.format(row)
              : (row as Record<string, unknown>)[c.key as string];
            return csvCell(raw);
          })
          .join(","),
      )
      .join("\r\n");

    // UTF-8 BOM so Excel renders Arabic correctly.
    const csv = "﻿" + header + "\r\n" + body;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={disabled || rows.length === 0}
    >
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );
}
