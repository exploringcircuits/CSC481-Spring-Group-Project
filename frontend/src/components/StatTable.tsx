import { useMemo, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronUp } from "lucide-react"

export interface ColumnDef<Row> {
  key: string
  header: ReactNode
  accessor: (row: Row) => ReactNode
  sortValue?: (row: Row) => number | string
  align?: "left" | "right" | "center"
  width?: string | number
  isStat?: boolean
  className?: string
}

export interface SortState {
  key: string
  dir: "asc" | "desc"
}

interface Props<Row> {
  columns: ColumnDef<Row>[]
  rows: Row[]
  sort?: SortState | null
  onSortChange?: (next: SortState | null) => void
  rowKey: (row: Row, index: number) => string | number
  onRowClick?: (row: Row) => void
  dense?: boolean
  sticky?: boolean
  emptyMessage?: ReactNode
  className?: string
}

export function StatTable<Row>({
  columns,
  rows,
  sort,
  onSortChange,
  rowKey,
  onRowClick,
  dense = false,
  sticky = true,
  emptyMessage = "No data.",
  className,
}: Props<Row>) {
  const sortedRows = useMemo(() => {
    if (!sort) return rows
    const col = columns.find(c => c.key === sort.key)
    if (!col?.sortValue) return rows
    const dir = sort.dir === "asc" ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a)
      const bv = col.sortValue!(b)
      if (av === bv) return 0
      return av > bv ? dir : -dir
    })
  }, [rows, sort, columns])

  const handleHeaderClick = (col: ColumnDef<Row>) => {
    if (!col.sortValue || !onSortChange) return
    if (!sort || sort.key !== col.key) {
      onSortChange({ key: col.key, dir: col.isStat ? "desc" : "asc" })
    } else if (sort.dir === "desc") {
      onSortChange({ key: col.key, dir: "asc" })
    } else {
      onSortChange(null)
    }
  }

  const padding = dense ? "py-1.5" : "py-2.5"

  return (
    <div className={cn("relative overflow-auto rounded-lg border border-border bg-card", className)}>
      <table className="w-full text-sm">
        <thead className={cn(sticky && "sticky top-0 z-10 bg-card")}>
          <tr className="border-b border-border bg-muted/40">
            {columns.map(col => {
              const isSortable = !!col.sortValue
              const isSorted = sort?.key === col.key
              const align = col.align ?? (col.isStat ? "right" : "left")
              return (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  onClick={isSortable ? () => handleHeaderClick(col) : undefined}
                  className={cn(
                    "px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap",
                    padding,
                    align === "right" && "text-right",
                    align === "center" && "text-center",
                    isSortable && "cursor-pointer select-none hover:text-foreground",
                    col.className,
                  )}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {col.header}
                    {isSortable && (
                      <span className="inline-flex flex-col -ml-0.5 leading-none">
                        {isSorted ? (
                          sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3 opacity-30" />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-12 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedRows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-border/40 last:border-0 transition-colors",
                  i % 2 === 1 && "bg-muted/20",
                  onRowClick && "cursor-pointer hover:bg-primary/5",
                )}
              >
                {columns.map(col => {
                  const align = col.align ?? (col.isStat ? "right" : "left")
                  return (
                    <td
                      key={col.key}
                      className={cn(
                        "px-3 align-middle whitespace-nowrap",
                        padding,
                        align === "right" && "text-right",
                        align === "center" && "text-center",
                        col.isStat && "stat-num",
                        col.className,
                      )}
                    >
                      {col.accessor(row)}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
