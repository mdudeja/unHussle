import { Tag } from '@c/types'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { getEntityItemRoute } from '@/lib/entityRoutes'

export default function TagsView({ tags }: { tags: Tag['Read'][] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag, idx) => (
        <Link
          key={tag.id ?? idx}
          to={`${getEntityItemRoute('tags', tag.id)}&related=1`}
          onClick={(e) => e.stopPropagation()}
        >
          <Badge
            variant="outline"
            style={{
              borderColor: tag.color ?? undefined,
              color: tag.color ?? undefined,
              cursor: 'pointer',
            }}
          >
            #{tag.title.trim()}
          </Badge>
        </Link>
      ))}
    </div>
  )
}
