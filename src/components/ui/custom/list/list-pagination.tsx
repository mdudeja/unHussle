import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LIST_PAGE_SIZE } from '@/lib/list-view'
import { useState } from 'react'

type ListPaginationProps = {
  /** e.g. "12 tasks" */
  summary: string
  total: number
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  isLoading?: boolean
}

const pageOptions = [10, 20, 50, 100]

export function ListPagination({
  summary,
  total,
  page,
  pageCount,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
}: ListPaginationProps) {
  const [selectedSize, setSelectedSize] = useState(
    `${total < LIST_PAGE_SIZE ? 'All' : LIST_PAGE_SIZE}`,
  )

  return (
    <nav
      aria-label="Pages"
      className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"
    >
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Select page size"
              />
            }
          >
            Show: {selectedSize}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-auto">
            {['All', ...pageOptions].map((size) => (
              <DropdownMenuItem
                key={size}
                onClick={() => {
                  setSelectedSize(String(size))
                  onPageSizeChange(size === 'All' ? total : (size as number))
                }}
              >
                {size}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span>{summary}</span>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <span>
            Page {page} of {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount || isLoading}
          >
            Next
          </Button>
        </div>
      )}
    </nav>
  )
}
