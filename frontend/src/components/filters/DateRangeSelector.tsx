import { Button } from '@/components/ui/button'

type Preset = 'hoje' | '7dias' | 'quinzenal' | 'mes' | 'bimestre' | 'trimestre' | 'semestre' | 'ano'

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
  const handlePreset = (preset: Preset) => {
    const today = new Date()
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }

    switch (preset) {
      case 'hoje': {
        const d = fmt(today)
        onStartDateChange(d); onEndDateChange(d)
        break
      }
      case '7dias':
        onStartDateChange(fmt(today))
        onEndDateChange(fmt(addDays(today, 6)))
        break
      case 'quinzenal':
        onStartDateChange(fmt(today))
        onEndDateChange(fmt(addDays(today, 14)))
        break
      case 'mes': {
        const first = new Date(today.getFullYear(), today.getMonth(), 1)
        const last = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        onStartDateChange(fmt(first)); onEndDateChange(fmt(last))
        break
      }
      case 'bimestre': {
        const bim = Math.floor(today.getMonth() / 2)
        const first = new Date(today.getFullYear(), bim * 2, 1)
        const last = new Date(today.getFullYear(), bim * 2 + 2, 0)
        onStartDateChange(fmt(first)); onEndDateChange(fmt(last))
        break
      }
      case 'trimestre': {
        const q = Math.floor(today.getMonth() / 3)
        const first = new Date(today.getFullYear(), q * 3, 1)
        const last = new Date(today.getFullYear(), q * 3 + 3, 0)
        onStartDateChange(fmt(first)); onEndDateChange(fmt(last))
        break
      }
      case 'semestre': {
        const sem = today.getMonth() < 6 ? 0 : 1
        const first = new Date(today.getFullYear(), sem * 6, 1)
        const last = new Date(today.getFullYear(), sem * 6 + 6, 0)
        onStartDateChange(fmt(first)); onEndDateChange(fmt(last))
        break
      }
      case 'ano': {
        onStartDateChange(fmt(new Date(today.getFullYear(), 0, 1)))
        onEndDateChange(fmt(new Date(today.getFullYear(), 11, 31)))
        break
      }
    }
  }

  const presets: { key: Preset; label: string }[] = [
    { key: 'hoje',      label: 'Hoje'      },
    { key: '7dias',     label: '7 Dias'    },
    { key: 'quinzenal', label: 'Quinzenal' },
    { key: 'mes',       label: 'Este Mês'  },
    { key: 'bimestre',  label: 'Bimestre'  },
    { key: 'trimestre', label: 'Trimestre' },
    { key: 'semestre',  label: 'Semestre'  },
    { key: 'ano',       label: 'Este Ano'  },
  ]

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Período</span>

      <div className="grid grid-cols-2 gap-1">
        {presets.map(({ key, label }) => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            className="h-7 text-[10px] px-1 rounded-md"
            onClick={() => handlePreset(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex flex-col flex-1 gap-1">
          <span className="text-[10px] text-muted-foreground ml-1">De</span>
          <input
            type="date"
            style={{ colorScheme: 'dark' }}
            className="w-full h-9 px-2 rounded-lg border bg-background text-xs text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>
        <div className="flex flex-col flex-1 gap-1">
          <span className="text-[10px] text-muted-foreground ml-1">Até</span>
          <input
            type="date"
            style={{ colorScheme: 'dark' }}
            className="w-full h-9 px-2 rounded-lg border bg-background text-xs text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
