import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MultiSelectProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  allLabel?: string
}

export function MultiSelect({ label, options, selected, onChange, allLabel = 'Todos' }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val])
  }

  const displayText = selected.length === 0 ? allLabel : selected.length === 1 ? selected[0] : `${selected.length} selecionados`

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'flex items-center justify-between w-full min-w-[140px] h-9 px-3 rounded-md border text-sm bg-background transition-colors',
            open && 'border-primary'
          )}
        >
          <span className="truncate">{displayText}</span>
          <ChevronDown className={cn('h-3.5 w-3.5 ml-2 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full min-w-[180px] rounded-md border bg-popover p-1 shadow-md max-h-[280px] overflow-auto">
            <button
              onClick={() => onChange([])}
              className={cn(
                'flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent',
                selected.length === 0 && 'text-primary font-medium'
              )}
            >
              <div className={cn('h-4 w-4 rounded border flex items-center justify-center', selected.length === 0 && 'bg-primary border-primary')}>
                {selected.length === 0 && <span className="text-white text-xs">&#10003;</span>}
              </div>
              {allLabel}
            </button>
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent"
              >
                <div className={cn('h-4 w-4 rounded border flex items-center justify-center', selected.includes(opt) && 'bg-primary border-primary')}>
                  {selected.includes(opt) && <span className="text-white text-xs">&#10003;</span>}
                </div>
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
