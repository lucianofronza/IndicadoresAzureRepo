import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, Search, Loader2 } from 'lucide-react'
import api from '@/services/api'

interface PaginatedSelectProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  endpoint: string
  labelKey: string
  valueKey: string
  className?: string
  tabIndex?: number
  disabled?: boolean
  clearValue?: string
}

export const PaginatedSelect: React.FC<PaginatedSelectProps> = ({
  value,
  onChange,
  placeholder,
  endpoint,
  labelKey,
  valueKey,
  className = '',
  tabIndex,
  disabled = false,
  clearValue = ''
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [selectedLabel, setSelectedLabel] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(-1)

  const loadData = useCallback(async (pageNum: number = 1, searchTerm: string = '') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        pageSize: '20',
        sortBy: labelKey,
        sortOrder: 'asc'
      })
      
      if (searchTerm) {
        params.append('search', searchTerm)
      }

      const response = await api.get(`${endpoint}?${params.toString()}`)
      const newData = response.data.data
      const pagination = response.data.pagination
      
      if (pageNum === 1) {
        setData(newData)
      } else {
        setData(prev => [...prev, ...newData])
      }
      
      setHasMore(pagination.hasNext)
      setPage(pageNum)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [endpoint, labelKey])

  useEffect(() => {
    // Reset state when endpoint changes
    setData([])
    setPage(1)
    setHasMore(true)
    setSelectedLabel('')
    loadData(1, search)
  }, [search, loadData])

  useEffect(() => {
    // Set selected label when value changes
    if (value && data.length > 0) {
      const selected = data.find(item => item[valueKey] === value)
      if (selected) {
        setSelectedLabel(selected[labelKey])
      }
    } else {
      setSelectedLabel('')
    }
  }, [value, data, labelKey, valueKey])

  const handleSelect = (item: any) => {
    const value = item ? item[valueKey] : clearValue
    const label = item ? item[labelKey] : ''
    onChange(value)
    setSelectedLabel(label)
    setIsOpen(false)
    setFocusedIndex(-1)
  }

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1
      loadData(nextPage, search)
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className={`flex items-center justify-between px-4 py-2 border border-gray-300 rounded-md ${
          disabled 
            ? 'cursor-not-allowed bg-gray-100 text-gray-500' 
            : 'cursor-pointer bg-white'
        }`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen)
            if (!isOpen) {
              setFocusedIndex(-1)
            }
          }
        }}
        tabIndex={disabled ? -1 : tabIndex}
        onKeyDown={(e) => {
          if (!disabled) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setIsOpen(!isOpen)
            } else if (e.key === 'Escape') {
              setIsOpen(false)
            }
          }
        }}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-disabled={disabled}
      >
        <span className={selectedLabel ? 'text-gray-900' : 'text-gray-500'}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-80 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Options list */}
          <div 
            className="max-h-60 overflow-y-auto"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setFocusedIndex(prev => Math.min(prev + 1, data.length))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setFocusedIndex(prev => Math.max(prev - 1, -1))
              } else if (e.key === 'Enter' && focusedIndex >= 0) {
                e.preventDefault()
                if (focusedIndex === 0) {
                  handleSelect(null)
                } else {
                  handleSelect(data[focusedIndex - 1])
                }
              } else if (e.key === 'Escape') {
                setIsOpen(false)
              }
            }}
            tabIndex={-1}
          >
            {/* Option to clear selection */}
            <div
              className={`px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm font-medium text-gray-600 border-b ${
                focusedIndex === 0 ? 'bg-blue-100' : ''
              }`}
              onClick={() => handleSelect(null)}
              onMouseEnter={() => setFocusedIndex(0)}
            >
              Todos
            </div>
            {data.map((item, index) => (
              <div
                key={item[valueKey]}
                className={`px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm ${
                  focusedIndex === index + 1 ? 'bg-blue-100' : ''
                }`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setFocusedIndex(index + 1)}
              >
                {item[labelKey]}
              </div>
            ))}
            
            {loading && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            
            {hasMore && !loading && (
              <div
                className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 cursor-pointer text-center"
                onClick={handleLoadMore}
              >
                Carregar mais...
              </div>
            )}
            
            {data.length === 0 && !loading && (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                Nenhum resultado encontrado
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsOpen(false)
            setFocusedIndex(-1)
          }}
        />
      )}
    </div>
  )
}
