import { useMemo } from 'react'

type Preset = 'hoje' | '7dias' | 'quinzenal' | 'mes' | 'bimestre' | 'trimestre' | 'semestre' | 'ano'

interface DateRangeSelectorProps {
  startDate: string
  endDate: string
  onStartDateChange: (val: string) => void
  onEndDateChange: (val: string) => void
}

function getPresetRange(preset: Preset): [string, string] {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }

  switch (preset) {
    case 'hoje': { const d = fmt(today); return [d, d] }
    case '7dias': return [fmt(today), fmt(addDays(today, 6))]
    case 'quinzenal': return [fmt(today), fmt(addDays(today, 14))]
    case 'mes': return [
      fmt(new Date(today.getFullYear(), today.getMonth(), 1)),
      fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    ]
    case 'bimestre': { const b = Math.floor(today.getMonth() / 2); return [
      fmt(new Date(today.getFullYear(), b * 2, 1)),
      fmt(new Date(today.getFullYear(), b * 2 + 2, 0)),
    ]}
    case 'trimestre': { const q = Math.floor(today.getMonth() / 3); return [
      fmt(new Date(today.getFullYear(), q * 3, 1)),
      fmt(new Date(today.getFullYear(), q * 3 + 3, 0)),
    ]}
    case 'semestre': { const s = today.getMonth() < 6 ? 0 : 1; return [
      fmt(new Date(today.getFullYear(), s * 6, 1)),
      fmt(new Date(today.getFullYear(), s * 6 + 6, 0)),
    ]}
    case 'ano': return [
      fmt(new Date(today.getFullYear(), 0, 1)),
      fmt(new Date(today.getFullYear(), 11, 31)),
    ]
  }
}

export function DateRangeSelector({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DateRangeSelectorProps) {
  const handlePreset = (preset: Preset) => {
    const [s, e] = getPresetRange(preset)
    onStartDateChange(s)
    onEndDateChange(e)
  }

  const activePreset = useMemo<Preset | null>(() => {
    const presets: Preset[] = ['hoje', '7dias', 'quinzenal', 'mes', 'bimestre', 'trimestre', 'semestre', 'ano']
    for (const p of presets) {
      const [s, e] = getPresetRange(p)
      if (s === startDate && e === endDate) return p
    }
    return null
  }, [startDate, endDate])

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
    <div className="flex flex-col gap-3 block-border-b pb-5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Período</span>

      <div className="grid grid-cols-2 gap-1">
        {presets.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handlePreset(key)}
            className={`h-7 text-[10px] font-black uppercase tracking-wide px-1 border-2 transition-colors ${
              activePreset === key
                ? 'bg-dark text-white border-dark'
                : 'bg-white text-dark border-dark hover:bg-bgBase'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground font-black uppercase">De</span>
          <input
            type="date"
            style={{ colorScheme: 'light' }}
            className="w-full h-8 px-2 border-2 border-dark bg-white text-xs text-dark font-bold focus:outline-none focus:border-brand"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground font-black uppercase">Até</span>
          <input
            type="date"
            style={{ colorScheme: 'light' }}
            className="w-full h-8 px-2 border-2 border-dark bg-white text-xs text-dark font-bold focus:outline-none focus:border-brand"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
