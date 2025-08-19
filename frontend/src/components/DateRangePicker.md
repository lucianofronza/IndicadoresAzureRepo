# DateRangePicker Component

Um componente de calendário nativo do React para seleção de intervalo de datas, construído com `date-fns` e `lucide-react`.

## Características

- ✅ Interface intuitiva de calendário
- ✅ Seleção de intervalo de datas com hover preview
- ✅ Botões de seleção rápida (7, 30, 90 dias)
- ✅ Localização em português brasileiro
- ✅ Responsivo e acessível
- ✅ Fecha automaticamente ao clicar fora
- ✅ Validação de datas
- ✅ Formatação automática das datas

## Uso

```tsx
import { DateRangePicker } from '@/components/DateRangePicker'

function MyComponent() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
  }

  return (
    <DateRangePicker
      startDate={startDate}
      endDate={endDate}
      onDateChange={handleDateChange}
      className="w-full"
    />
  )
}
```

## Props

| Prop | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| `startDate` | `string` | ✅ | Data de início no formato 'YYYY-MM-DD' |
| `endDate` | `string` | ✅ | Data de fim no formato 'YYYY-MM-DD' |
| `onDateChange` | `(startDate: string, endDate: string) => void` | ✅ | Callback chamado quando as datas mudam |
| `className` | `string` | ❌ | Classes CSS adicionais |

## Funcionalidades

### Seleção de Datas
- Clique na primeira data para iniciar a seleção
- Clique na segunda data para completar o intervalo
- O componente automaticamente ordena as datas (menor para maior)

### Seleção Rápida
- **7 dias**: Últimos 7 dias
- **30 dias**: Últimos 30 dias  
- **90 dias**: Últimos 90 dias

### Navegação
- Use as setas para navegar entre os meses
- O calendário mostra o mês atual por padrão

### Ações
- **Aplicar**: Confirma a seleção e fecha o calendário
- **Cancelar**: Fecha o calendário sem aplicar mudanças
- **Limpar**: Remove todas as datas selecionadas

## Estilização

O componente usa Tailwind CSS e pode ser customizado através da prop `className`:

```tsx
<DateRangePicker
  startDate={startDate}
  endDate={endDate}
  onDateChange={handleDateChange}
  className="w-full max-w-md"
/>
```

## Dependências

- `date-fns`: Para manipulação de datas
- `lucide-react`: Para ícones
- `react`: Framework base

## Exemplo Completo

```tsx
import { useState } from 'react'
import { DateRangePicker } from '@/components/DateRangePicker'

export const DashboardFilters = () => {
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  })

  const handleDateChange = (startDate: string, endDate: string) => {
    setFilters(prev => ({ ...prev, startDate, endDate }))
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-medium text-gray-900">Filtros</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Período
          </label>
          <DateRangePicker
            startDate={filters.startDate}
            endDate={filters.endDate}
            onDateChange={handleDateChange}
          />
        </div>
        
        {/* Outros filtros... */}
      </div>
    </div>
  )
}
```
