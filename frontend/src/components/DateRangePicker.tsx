import React, { useState, useRef, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval, startOfWeek, endOfWeek, addMonths, subMonths, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onDateChange: (startDate: string, endDate: string) => void
  className?: string
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onDateChange,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null)
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(
    startDate ? new Date(startDate) : null
  )
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(
    endDate ? new Date(endDate) : null
  )
  
  const calendarRef = useRef<HTMLDivElement>(null)

  // Fechar calendário quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Atualizar datas quando props mudarem
  useEffect(() => {
    setSelectedStartDate(startDate ? new Date(startDate) : null)
    setSelectedEndDate(endDate ? new Date(endDate) : null)
  }, [startDate, endDate])

  const getDaysInMonth = (date: Date) => {
    const start = startOfWeek(startOfMonth(date), { locale: ptBR })
    const end = endOfWeek(endOfMonth(date), { locale: ptBR })
    return eachDayOfInterval({ start, end })
  }

  const handleDateClick = (date: Date) => {
    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      // Primeira seleção ou nova seleção
      setSelectedStartDate(date)
      setSelectedEndDate(null)
    } else {
      // Segunda seleção
      if (date < selectedStartDate) {
        setSelectedEndDate(selectedStartDate)
        setSelectedStartDate(date)
      } else {
        setSelectedEndDate(date)
      }
    }
  }

  const handleDateHover = (date: Date) => {
    if (selectedStartDate && !selectedEndDate) {
      setHoveredDate(date)
    }
  }

  const handleDateLeave = () => {
    setHoveredDate(null)
  }

  const isInRange = (date: Date) => {
    if (!selectedStartDate) return false
    
    if (selectedEndDate) {
      return isWithinInterval(date, { start: selectedStartDate, end: selectedEndDate })
    }
    
    if (hoveredDate && selectedStartDate) {
      const start = selectedStartDate < hoveredDate ? selectedStartDate : hoveredDate
      const end = selectedStartDate < hoveredDate ? hoveredDate : selectedStartDate
      return isWithinInterval(date, { start, end })
    }
    
    return false
  }

  const isRangeStart = (date: Date) => {
    return selectedStartDate && isSameDay(date, selectedStartDate)
  }

  const isRangeEnd = (date: Date) => {
    return selectedEndDate && isSameDay(date, selectedEndDate)
  }

  const applySelection = () => {
    if (selectedStartDate && selectedEndDate) {
      onDateChange(
        format(selectedStartDate, 'yyyy-MM-dd'),
        format(selectedEndDate, 'yyyy-MM-dd')
      )
      setIsOpen(false)
    }
  }

  const clearSelection = () => {
    setSelectedStartDate(null)
    setSelectedEndDate(null)
    onDateChange('', '')
    setIsOpen(false)
  }

  const quickSelect = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    
    setSelectedStartDate(start)
    setSelectedEndDate(end)
    onDateChange(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'))
    setIsOpen(false)
  }

  const days = getDaysInMonth(currentMonth)
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <div className={`relative ${className}`}>
      {/* Input trigger */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between p-2 border border-gray-300 rounded-md bg-white cursor-pointer hover:border-gray-400 transition-colors"
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-700">
            {selectedStartDate && selectedEndDate
              ? `${format(selectedStartDate, 'dd/MM/yyyy', { locale: ptBR })} - ${format(selectedEndDate, 'dd/MM/yyyy', { locale: ptBR })}`
              : 'Selecionar período'}
          </span>
        </div>
        <ChevronRight className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </div>

      {/* Calendar dropdown */}
      {isOpen && (
        <div
          ref={calendarRef}
          className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[320px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="text-sm font-medium">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h3>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Quick select buttons */}
          <div className="p-3 border-b border-gray-200">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => quickSelect(7)}
                className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
              >
                7 dias
              </button>
              <button
                onClick={() => quickSelect(30)}
                className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
              >
                30 dias
              </button>
              <button
                onClick={() => quickSelect(90)}
                className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
              >
                90 dias
              </button>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="p-4">
            {/* Week days header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div key={day} className="text-xs font-medium text-gray-500 text-center py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isSelected = isRangeStart(day) || isRangeEnd(day)
                const isInRangeSelection = isInRange(day)
                const isTodayDate = isToday(day)

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => handleDateClick(day)}
                    onMouseEnter={() => handleDateHover(day)}
                    onMouseLeave={handleDateLeave}
                    className={`
                      h-8 w-8 text-xs rounded-full flex items-center justify-center transition-colors
                      ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-100'}
                      ${isTodayDate ? 'font-bold text-blue-600' : ''}
                      ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                      ${isInRangeSelection && !isSelected ? 'bg-blue-100 text-blue-700' : ''}
                    `}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex justify-between p-4 border-t border-gray-200">
            <button
              onClick={clearSelection}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
            >
              Limpar
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={applySelection}
                disabled={!selectedStartDate || !selectedEndDate}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
