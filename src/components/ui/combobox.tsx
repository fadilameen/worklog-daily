'use client'

import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface ComboboxItem {
  value: string
  label: string
}

interface ComboboxProps {
  items: ComboboxItem[]
  value: string | null
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  recentValues?: string[]
}

export function Combobox({
  items,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results.',
  disabled,
  className,
  recentValues = [],
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const selected = items.find((i) => i.value === value)

  const { recentItems, restItems } = React.useMemo(() => {
    if (!recentValues.length) return { recentItems: [], restItems: items }
    const recentSet = new Set(recentValues)
    const recentMap = new Map(items.map((i) => [i.value, i]))
    const recent: ComboboxItem[] = []
    for (const v of recentValues) {
      const it = recentMap.get(v)
      if (it) recent.push(it)
    }
    const rest = items.filter((i) => !recentSet.has(i.value))
    return { recentItems: recent, restItems: rest }
  }, [items, recentValues])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-72">
            <CommandEmpty>{emptyText}</CommandEmpty>
            {recentItems.length > 0 && (
              <CommandGroup heading="Recent">
                {recentItems.map((item) => (
                  <CommandItem
                    key={`recent-${item.value}`}
                    value={item.label}
                    onSelect={() => {
                      onChange(item.value)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === item.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading={recentItems.length > 0 ? 'All' : undefined}>
              {restItems.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.label}
                  onSelect={() => {
                    onChange(item.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === item.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
