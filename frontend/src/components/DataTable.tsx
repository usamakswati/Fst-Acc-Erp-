import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { 
  ChevronDown, 
  ChevronUp, 
  ChevronsUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2
} from 'lucide-react';

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  searchPlaceholder?: string;
  searchColumnId?: string;
  bulkActions?: (selectedRows: TData[]) => React.ReactNode;
}

export default function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = 'Search records...',
  searchColumnId,
  bulkActions,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState({});

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      rowSelection,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const selectedRows = table.getSelectedRowModel().flatRows.map((r) => r.original);

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        {searchColumnId && (
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9 pr-4 py-2 w-full bg-slate-900 border border-brand-800 text-slate-100 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        )}
        
        {/* Bulk Action Renderer */}
        {selectedRows.length > 0 && bulkActions && (
          <div className="flex items-center gap-3 bg-brand-900/30 px-3 py-1.5 border border-brand-800/40 rounded-lg animate-fade-in w-full sm:w-auto justify-between sm:justify-start">
            <span className="text-xs text-indigo-400 font-medium">
              {selectedRows.length} record(s) selected
            </span>
            <div className="flex items-center gap-2">
              {bulkActions(selectedRows)}
            </div>
          </div>
        )}
      </div>

      {/* Grid Container */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-brand-800 bg-brand-950/50">
                  {headerGroup.headers.map((header) => (
                    <th 
                      key={header.id} 
                      className="px-4 py-3 font-semibold text-slate-300 select-none"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={`flex items-center gap-1 ${
                            header.column.getCanSort() ? 'cursor-pointer select-none hover:text-slate-100' : ''
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getCanSort() && (
                            <span>
                              {{
                                asc: <ChevronUp size={14} />,
                                desc: <ChevronDown size={14} />,
                              }[header.column.getIsSorted() as string] ?? <ChevronsUpDown size={14} className="opacity-50" />}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <tr 
                    key={row.id} 
                    className="interactive-tr"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3.5 text-slate-300">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td 
                    colSpan={columns.length} 
                    className="px-4 py-8 text-center text-slate-500 font-medium bg-brand-950/20"
                  >
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Panel */}
        {table.getPageCount() > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-brand-950/40 border-t border-brand-800/40">
            <span className="text-xs text-slate-400">
              Page <strong>{table.getState().pagination.pageIndex + 1}</strong> of <strong>{table.getPageCount()}</strong>
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="p-1.5 rounded bg-brand-900 border border-brand-800 text-slate-400 hover:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="p-1.5 rounded bg-brand-900 border border-brand-800 text-slate-400 hover:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
