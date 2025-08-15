import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { Stack } from '@/types'

interface StackSelectorProps {
  stacks: Stack[]
  selectedStackIds: string[]
  onSelectionChange: (stackIds: string[]) => void
  placeholder?: string
  className?: string
}

export const StackSelector: React.FC<StackSelectorProps> = ({
  stacks,
  selectedStackIds,
  onSelectionChange,
  placeholder = 'Selecione as stacks...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedStacks = stacks.filter(stack => selectedStackIds.includes(stack.id))
  const availableStacks = stacks.filter(stack => !selectedStackIds.includes(stack.id))

  const handleStackToggle = (stackId: string) => {
    const newSelection = selectedStackIds.includes(stackId)
      ? selectedStackIds.filter(id => id !== stackId)
      : [...selectedStackIds, stackId]
    onSelectionChange(newSelection)
  }

  const handleRemoveStack = (stackId: string) => {
    const newSelection = selectedStackIds.filter(id => id !== stackId)
    onSelectionChange(newSelection)
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        className="min-h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1 min-h-6">
            {selectedStacks.length > 0 ? (
              selectedStacks.map(stack => (
                <span
                  key={stack.id}
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    !stack.color ? 'bg-blue-100 text-blue-800' : ''
                  }`}
                  style={stack.color ? {
                    backgroundColor: stack.color,
                    color: (() => {
                      const hex = stack.color.replace('#', '')
                      const r = parseInt(hex.substr(0, 2), 16)
                      const g = parseInt(hex.substr(2, 2), 16)
                      const b = parseInt(hex.substr(4, 2), 16)
                      const brightness = (r * 299 + g * 587 + b * 114) / 1000
                      return brightness > 128 ? '#111827' : '#ffffff'
                    })()
                  } : {}}
                >
                  {stack.name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveStack(stack.id)
                    }}
                    className="ml-1.5 inline-flex items-center justify-center w-3 h-3 rounded-full hover:bg-blue-200"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))
            ) : (
              <span className="text-gray-500">{placeholder}</span>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {availableStacks.length > 0 ? (
            availableStacks.map(stack => (
              <div
                key={stack.id}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                onClick={() => handleStackToggle(stack.id)}
              >
                {stack.name}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">
              Todas as stacks já foram selecionadas
            </div>
          )}
        </div>
      )}
    </div>
  )
}
