import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
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
    <div className="flex flex-col gap-1.5" ref={ref}>
      <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'flex items-center justify-between w-full h-10 px-3 rounded-lg border text-sm bg-background transition-all hover:bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary',
            open ? 'border-primary ring-1 ring-primary' : 'border-input'
          )}
        >
          <span className="truncate">{displayText}</span>
          <ChevronDown className={cn('h-4 w-4 ml-2 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
        </button>
        {open && (
          <div className="absolute z-50 mt-2 w-full min-w-[200px] rounded-xl border bg-popover shadow-lg max-h-[300px] overflow-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-1.5 space-y-0.5">
              <button
                onClick={() => {
                  onChange([])
                  setOpen(false)
                }}
                className={cn(
                  'flex items-center gap-2.5 w-full px-2 py-2 text-sm rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground',
                  selected.length === 0 && 'font-medium'
                )}
              >
                <div className={cn('h-4 w-4 rounded-sm border flex items-center justify-center transition-colors', selected.length === 0 ? 'bg-primary border-primary text-primary-foreground' : 'border-input')}>
                  {selected.length === 0 && <Check className="h-3 w-3" />}
                </div>
                {allLabel}
              </button>
              
              {options.length > 0 && <div className="h-px bg-muted mx-1 my-1" />}
              
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => toggle(opt)}
                  className="flex items-center gap-2.5 w-full px-2 py-2 text-sm rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <div className={cn('h-4 w-4 rounded-sm border flex items-center justify-center transition-colors', selected.includes(opt) ? 'bg-primary border-primary text-primary-foreground' : 'border-input')}>
                    {selected.includes(opt) && <Check className="h-3 w-3" />}
                  </div>
                  <span className="text-left truncate">{opt}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
