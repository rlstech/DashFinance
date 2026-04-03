import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface DateRangeSelectorProps {
  startDate: string
  endDate: string
  onStartDateChange: (val: string) => void
  onEndDateChange: (val: string) => void
}

export function DateRangeSelector({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DateRangeSelectorProps) {
  const handlePreset = (preset: 'hoje' | '7dias' | 'mes' | 'ano') => {
    const today = new Date()
    
    // Get YYYY-MM-DD
    const formatDate = (date: Date) => date.toISOString().split('T')[0]

    if (preset === 'hoje') {
      const d = formatDate(today)
      onStartDateChange(d)
      onEndDateChange(d)
      return
    }

    if (preset === '7dias') {
      const past = new Date(today)
      past.setDate(past.getDate() - 7)
      onStartDateChange(formatDate(past))
      onEndDateChange(formatDate(today))
      return
    }

    if (preset === 'mes') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      onStartDateChange(formatDate(firstDay))
      onEndDateChange(formatDate(lastDay))
      return
    }

    if (preset === 'ano') {
      const firstDay = new Date(today.getFullYear(), 0, 1)
      const lastDay = new Date(today.getFullYear(), 11, 31)
      onStartDateChange(formatDate(firstDay))
      onEndDateChange(formatDate(lastDay))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Label and Presets */}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Período</span>
        
        <div className="grid grid-cols-4 gap-1">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-[10px] px-1 rounded-md" 
            onClick={() => handlePreset('hoje')}
          >
            Hoje
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-[10px] px-1 rounded-md" 
            onClick={() => handlePreset('7dias')}
          >
            7 Dias
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-[10px] px-1 rounded-md" 
            onClick={() => handlePreset('mes')}
          >
            Este Mês
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-[10px] px-1 rounded-md" 
            onClick={() => handlePreset('ano')}
          >
            Este Ano
          </Button>
        </div>
      </div>

      {/* Date Inputs */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col flex-1 gap-1">
          <span className="text-[10px] text-muted-foreground ml-1">De</span>
          <input
            type="date"
            className="w-full h-9 px-2 rounded-lg border bg-background text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>
        <div className="flex flex-col flex-1 gap-1">
          <span className="text-[10px] text-muted-foreground ml-1">Até</span>
          <input
            type="date"
            className="w-full h-9 px-2 rounded-lg border bg-background text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
