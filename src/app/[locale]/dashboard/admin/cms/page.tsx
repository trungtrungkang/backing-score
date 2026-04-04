"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  RowData,
} from "@tanstack/react-table";
import { useAuth } from "@/contexts/AuthContext";
import { listProjects, updateProject, listSheetMusic, updateSheetMusic, type ProjectDocument, type SheetMusicDocument } from "@/lib/appwrite";
import { Search, Loader2, Link as LinkIcon } from "lucide-react";
import { Link } from "@/i18n/routing";

// Provide a custom table meta to pass updateData function down to cells
declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
  }
}

// Editable Cell Component
const EditableCell = ({ getValue, row: { index }, column: { id }, table }: any) => {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);

  // When initial value changes outside
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const onBlur = () => {
    table.options.meta?.updateData(index, id, value);
  };

  return (
    <input
      value={(value as string) ?? ""}
      onChange={(e) => setValue(e.target.value)}
      onBlur={onBlur}
      className="w-full bg-transparent border-none p-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded text-sm text-zinc-900 dark:text-zinc-100"
    />
  );
};

export default function AdminCmsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"projects" | "sheets">("projects");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState("");

  const isAdmin = user?.labels?.includes("admin") || user?.labels?.includes("curator");

  useEffect(() => {
    if (!user || !isAdmin) return;
    const load = async () => {
      setLoading(true);
      try {
        if (activeTab === "projects") {
          const response = await listProjects(); 
          setData(response.documents);
        } else {
          const response = await listSheetMusic();
          setData(response.documents);
        }
      } catch (err) {
        console.error("Failed to load items", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, isAdmin, activeTab]);

  const columns = useMemo<ColumnDef<any>[]>(
    () => {
      if (activeTab === "projects") {
        return [
          {
            accessorKey: "name",
            header: "Title",
            cell: EditableCell,
          },
          {
            accessorKey: "difficulty",
            header: "Difficulty",
            cell: EditableCell,
          },
          {
            accessorKey: "mode",
            header: "Mode",
            cell: EditableCell,
          },
          {
            id: "actions",
            header: "Player",
            cell: ({ row }) => (
              <Link
                href={`/play/${row.original.$id}`}
                target="_blank"
                className="text-indigo-500 hover:text-indigo-400 p-1 flex items-center justify-center"
              >
                <LinkIcon className="w-4 h-4" />
              </Link>
            ),
          },
        ];
      } else {
        return [
          {
            accessorKey: "title",
            header: "Tên Sheet",
            cell: EditableCell,
          },
          {
            accessorKey: "composer",
            header: "Author",
            cell: EditableCell,
          },
          {
            accessorKey: "instrument",
            header: "Instrument",
            cell: EditableCell,
          },
          {
            id: "actions",
            header: "Download",
            cell: ({ row }) => (
              <a
                href={`/api/r2/download/${row.original.fileId}`}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-500 hover:text-indigo-400 p-1 flex items-center justify-center"
              >
                <LinkIcon className="w-4 h-4" />
              </a>
            ),
          },
        ];
      }
    },
    [activeTab]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    meta: {
      updateData: async (rowIndex, columnId, value) => {
        setData((old) =>
          old.map((row, index) => {
            if (index === rowIndex) {
              const updatedRow = {
                ...old[rowIndex]!,
                [columnId]: value,
              };
              
              // Optimistically update locally
              return updatedRow;
            }
            return row;
          })
        );
        
        // Push update to backend
        try {
          const docId = data[rowIndex].$id;
          if (activeTab === "projects") {
            await updateProject(docId, {
              [columnId]: columnId === 'difficulty' ? Number(value) || 0 : value,
            });
          } else {
            await updateSheetMusic(docId, {
              [columnId]: value,
            });
          }
        } catch(e) {
          console.error("Auto-save failed", e);
        }
      },
    },
  });

  if (!user || (!isAdmin && !loading)) {
    return <div className="p-10">Access Denied.</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-white dark:bg-zinc-950 p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Master CMS Catalog</h1>
          <p className="text-sm text-zinc-500">Edit raw database values like Excel. Auto-saves on blur.</p>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-md">
            <button
              onClick={() => setActiveTab("projects")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === "projects" ? "bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"}`}
            >
              MusicXML Projects
            </button>
            <button
              onClick={() => setActiveTab("sheets")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === "sheets" ? "bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"}`}
            >
              PDF Sheets
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
            <input
              value={globalFilter ?? ""}
              onChange={e => setGlobalFilter(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-900 border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-950 rounded-md outline-none text-zinc-900 dark:text-white w-64 transition-all"
              placeholder="Search all columns..."
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto border border-zinc-200 dark:border-zinc-800 rounded-lg mx-1">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-zinc-100 dark:bg-zinc-900 sticky top-0 z-10 shadow-sm">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="py-2.5 px-4 font-semibold text-xs tracking-wider uppercase text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-1 px-2 border-r border-zinc-100 dark:border-zinc-800/50 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      <div className="flex items-center justify-between mt-4 text-sm text-zinc-500 flex-shrink-0">
        <span>Showing {table.getRowModel().rows.length} rows</span>
        <div className="flex gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1 bg-zinc-100 dark:bg-zinc-900 rounded disabled:opacity-50"
          >
            Prev
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1 bg-zinc-100 dark:bg-zinc-900 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
