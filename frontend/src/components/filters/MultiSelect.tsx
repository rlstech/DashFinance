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
      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{label}</span>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'flex items-center justify-between w-full h-9 px-3 border-2 text-xs font-bold uppercase text-dark bg-white transition-colors hover:bg-bgBase focus:outline-none',
            open ? 'border-brand' : 'border-dark'
          )}
        >
          <span className="truncate">{displayText}</span>
          <ChevronDown className={cn('h-3.5 w-3.5 ml-2 text-muted-foreground transition-transform duration-200 shrink-0', open && 'rotate-180')} />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-white block-border shadow-hard max-h-[280px] overflow-auto">
            <div className="p-1">
              <button
                onClick={() => { onChange([]); setOpen(false) }}
                className={cn(
                  'flex items-center gap-2.5 w-full px-2 py-2 text-xs font-bold uppercase hover:bg-bgBase transition-colors',
                  selected.length === 0 && 'text-brand'
                )}
              >
                <div className={cn(
                  'h-3.5 w-3.5 border-2 flex items-center justify-center shrink-0',
                  selected.length === 0 ? 'bg-brand border-brand' : 'border-dark'
                )}>
                  {selected.length === 0 && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                {allLabel}
              </button>

              {options.length > 0 && <div className="h-px bg-grid mx-1 my-1" />}

              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => toggle(opt)}
                  className="flex items-center gap-2.5 w-full px-2 py-2 text-xs font-bold uppercase hover:bg-bgBase transition-colors"
                >
                  <div className={cn(
                    'h-3.5 w-3.5 border-2 flex items-center justify-center shrink-0',
                    selected.includes(opt) ? 'bg-brand border-brand' : 'border-dark'
                  )}>
                    {selected.includes(opt) && <Check className="h-2.5 w-2.5 text-white" />}
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
