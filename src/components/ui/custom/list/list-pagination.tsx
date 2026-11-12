import { Button } from '@/components/ui/button'

type ListPaginationProps = {
  /** e.g. "12 tasks" */
  summary: string
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  isLoading?: boolean
}

export function ListPagination({
  summary,
  page,
  pageCount,
  onPageChange,
  isLoading = false,
}: ListPaginationProps) {
  return (
    <nav
      aria-label="Pages"
      className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"
    >
      <span>{summary}</span>
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
