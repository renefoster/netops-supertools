import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize = 10,
  onPageChange,
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems <= pageSize && totalPages <= 1) {
    return (
      <div className={`flex items-center justify-between px-4 py-2.5 bg-[#0f1522] border-t border-[#1e2d45] text-xs text-[#8892a4] ${className}`}>
        <span>Showing {totalItems} of {totalItems} entries</span>
        <span className="font-mono text-[11px]">Page 1 of 1</span>
      </div>
    );
  }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-2.5 bg-[#0f1522] border-t border-[#1e2d45] text-xs text-[#8892a4] ${className}`}>
      <div>
        Showing <span className="font-mono font-semibold text-white">{startItem}</span> to{' '}
        <span className="font-mono font-semibold text-white">{endItem}</span> of{' '}
        <span className="font-mono font-semibold text-white">{totalItems}</span> entries
      </div>

      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-1 rounded-md bg-[#151d2e] hover:bg-[#1a2438] text-[#8892a4] hover:text-white disabled:opacity-40 disabled:pointer-events-none transition border border-[#1e2d45]"
          title="First Page"
          aria-label="First Page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* Previous Page */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1 rounded-md bg-[#151d2e] hover:bg-[#1a2438] text-[#8892a4] hover:text-white disabled:opacity-40 disabled:pointer-events-none transition border border-[#1e2d45]"
          title="Previous Page"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Number buttons */}
        <div className="flex items-center gap-1 mx-1">
          {getPageNumbers().map((p, idx) => {
            if (typeof p === 'string') {
              return (
                <span key={`dots-${idx}`} className="px-1 text-[#8892a4] font-mono">
                  ...
                </span>
              );
            }
            const isActive = p === currentPage;
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`min-w-[26px] h-[26px] px-1.5 rounded-md font-mono text-xs transition flex items-center justify-center ${
                  isActive
                    ? 'bg-emerald-500 text-black font-bold shadow-sm'
                    : 'bg-[#151d2e] hover:bg-[#1a2438] text-[#8892a4] hover:text-white border border-[#1e2d45]'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1 rounded-md bg-[#151d2e] hover:bg-[#1a2438] text-[#8892a4] hover:text-white disabled:opacity-40 disabled:pointer-events-none transition border border-[#1e2d45]"
          title="Next Page"
          aria-label="Next Page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last Page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-1 rounded-md bg-[#151d2e] hover:bg-[#1a2438] text-[#8892a4] hover:text-white disabled:opacity-40 disabled:pointer-events-none transition border border-[#1e2d45]"
          title="Last Page"
          aria-label="Last Page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
