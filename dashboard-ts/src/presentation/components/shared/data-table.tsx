import { useState, useMemo, type ReactNode } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react"
import { Button } from "@/presentation/components/ui/button"
import { cn } from "@/lib/utils"

export interface Column<T> {
  key: string
  header: string
  render?: (item: T) => ReactNode
  sortable?: boolean
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T) => string | number
  pageSize?: number
  filterableColumns?: (keyof T & string)[]
  loading?: boolean
  emptyMessage?: string
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  pageSize = 10,
  filterableColumns,
  loading = false,
  emptyMessage = "Sin datos",
}: DataTableProps<T>) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([])

  const filterableSet = useMemo(() => new Set(filterableColumns), [filterableColumns])

  const columnDefs: ColumnDef<T>[] = useMemo(
    () =>
      columns.map((col) => ({
        id: col.key,
        header: col.header,
        accessorFn: (row: T) => (row as Record<string, unknown>)[col.key],
        enableSorting: col.sortable ?? false,
        enableColumnFilter: filterableSet.has(col.key as keyof T & string),
        cell: ({ row: r }) => {
          const item = r.original
          if (col.render) return col.render(item)
          const val = (item as Record<string, unknown>)[col.key]
          return val != null ? String(val) : ""
        },
        meta: { className: col.className },
      })),
    [columns, filterableSet],
  )

  const table = useReactTable({
    data,
    columns: columnDefs,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    globalFilterFn: "includesString",
  })

  const rows = table.getRowModel().rows
  const totalRows = table.getFilteredRowModel().rows.length

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-glass-border glass">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-glass-border">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  const canFilter = header.column.getCanFilter()
                  const filterValue = (header.column.getFilterValue() ?? "") as string
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "px-4 py-3 text-left font-medium text-muted-foreground",
                        canSort && "cursor-pointer select-none hover:text-foreground",
                        (header.column.columnDef.meta as Record<string, unknown> | undefined)?.className as string,
                      )}
                    >
                      <div className="flex items-center gap-1" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          sorted === "asc" ? <ArrowUp className="h-3.5 w-3.5" />
                            : sorted === "desc" ? <ArrowDown className="h-3.5 w-3.5" />
                            : <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </div>
                      {canFilter && (
                        <div className="relative mt-1.5" onClick={(e) => e.stopPropagation()}>
                          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                          <input
                            placeholder="Filtrar..."
                            value={filterValue}
                            onChange={(e) => {
                              header.column.setFilterValue(e.target.value)
                              table.setPageIndex(0)
                            }}
                            className="flex h-7 w-full rounded border border-glass-border bg-glass-bg px-1.5 pl-6 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">
                  Cargando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={keyExtractor(row.original)}
                  className="border-b border-glass-border transition-colors last:border-0 hover:bg-glass-bg-hover"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-4 py-3",
                        (cell.column.columnDef.meta as Record<string, unknown> | undefined)?.className as string,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalRows} registro{(totalRows !== 1) ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm tabular-nums">
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
