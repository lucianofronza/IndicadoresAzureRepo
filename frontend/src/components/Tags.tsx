import { X } from 'lucide-react'

interface Tag {
  id: string
  name: string
  color?: string
}

interface TagsProps {
  tags: Tag[]
  onRemove?: (tagId: string) => void
  className?: string
}

export const Tags: React.FC<TagsProps> = ({ tags, onRemove, className = '' }) => {
  const getTagStyle = (tag: Tag) => {
    if (tag.color) {
      // Convert hex color to RGB for brightness calculation
      const hex = tag.color.replace('#', '')
      const r = parseInt(hex.substr(0, 2), 16)
      const g = parseInt(hex.substr(2, 2), 16)
      const b = parseInt(hex.substr(4, 2), 16)
      
      // Calculate brightness to determine text color
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      const textColor = brightness > 128 ? '#111827' : '#ffffff'
      
      return {
        backgroundColor: tag.color,
        color: textColor
      }
    }
    
    // Fallback to default styling
    return {}
  }

  const getTagClasses = (tag: Tag) => {
    if (!tag.color) {
      // Fallback colors if no color is specified
      const colors = [
        'bg-blue-100 text-blue-800',
        'bg-green-100 text-green-800',
        'bg-purple-100 text-purple-800',
        'bg-yellow-100 text-yellow-800',
        'bg-red-100 text-red-800',
        'bg-indigo-100 text-indigo-800',
        'bg-pink-100 text-pink-800',
        'bg-gray-100 text-gray-800',
      ]
      // Simple hash function for consistent color assignment
      let hash = 0
      for (let i = 0; i < tag.id.length; i++) {
        const char = tag.id.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32-bit integer
      }
      return colors[Math.abs(hash) % colors.length]
    }
    
    return ''
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {tags.map((tag) => (
        <span
          key={tag.id}
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTagClasses(tag)}`}
          style={getTagStyle(tag)}
        >
          {tag.name}
          {onRemove && (
            <button
              onClick={() => onRemove(tag.id)}
              className="ml-1.5 inline-flex items-center justify-center w-3 h-3 rounded-full hover:bg-current hover:bg-opacity-20"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </span>
      ))}
    </div>
  )
}
