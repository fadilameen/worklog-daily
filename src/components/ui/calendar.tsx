"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  showWeekNumber,
  highlightWeek = false,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
  highlightWeek?: boolean
}) {
  const defaultClassNames = getDefaultClassNames()
  const selectedProp = (props as { selected?: unknown }).selected
  const weekStartsOn = (props.weekStartsOn as number | undefined) ?? 0
  const [hoveredDay, setHoveredDay] = React.useState<Date | undefined>(undefined)

  const computeWeekRange = React.useCallback((d: Date | undefined) => {
    if (!d) return undefined
    const day = d.getDay()
    const diff = (day - weekStartsOn + 7) % 7
    const start = new Date(d)
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - diff)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return { from: start, to: end }
  }, [weekStartsOn])

  const sameWeek = React.useMemo(() => {
    if (!highlightWeek) return undefined
    if (!selectedProp || !(selectedProp instanceof Date)) return undefined
    return computeWeekRange(selectedProp as Date)
  }, [highlightWeek, selectedProp, computeWeekRange])

  const hoverWeek = React.useMemo(() => {
    if (!highlightWeek) return undefined
    return computeWeekRange(hoveredDay)
  }, [highlightWeek, hoveredDay, computeWeekRange])

  // Grid template: optional week-number col + 7 day cols
  const gridCols = showWeekNumber
    ? "grid-cols-[var(--cell-size)_repeat(7,minmax(0,1fr))]"
    : "grid-cols-[repeat(7,minmax(0,1fr))]"

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      showWeekNumber={showWeekNumber}
      onDayMouseEnter={highlightWeek ? (d) => setHoveredDay(d) : undefined}
      onDayMouseLeave={highlightWeek ? () => setHoveredDay(undefined) : undefined}
      modifiers={{
        ...(sameWeek ? { week: sameWeek } : {}),
        ...(hoverWeek ? { hoverWeek: hoverWeek } : {}),
        sunday: { dayOfWeek: [0] },
        ...((props.modifiers as object) || {}),
      }}
      modifiersClassNames={{
        week: "bg-accent/10",
        hoverWeek: "bg-accent/5",
        sunday: "text-destructive/50 [&_button]:text-destructive/60",
        ...((props.modifiersClassNames as Record<string, string>) || {}),
      }}
      className={cn(
        "bg-popover text-popover-foreground group/calendar p-3 [--cell-size:2.5rem] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        formatWeekdayName: (date) =>
          date.toLocaleString("default", { weekday: "narrow" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-4 md:flex-row",
          defaultClassNames.months
        ),
        month: cn("flex w-full flex-col gap-3", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1 px-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-8 w-8 select-none p-0 aria-disabled:opacity-50 hover:bg-surface",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-8 w-8 select-none p-0 aria-disabled:opacity-50 hover:bg-surface",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-8 w-full items-center justify-center px-10",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "flex h-8 w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns
        ),
        caption_label: cn(
          "select-none font-semibold tracking-tight text-sm",
          defaultClassNames.caption_label
        ),
        weekdays: cn("grid w-full", gridCols, defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground/70 select-none rounded-md text-[0.7rem] font-mono uppercase tracking-wider flex items-center justify-center h-8",
          defaultClassNames.weekday
        ),
        week: cn("grid w-full mt-0.5", gridCols, defaultClassNames.week),
        week_number_header: cn(
          "select-none flex items-center justify-center h-8",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "text-muted-foreground/60 select-none text-[0.65rem] font-mono flex items-center justify-center",
          defaultClassNames.week_number
        ),
        day: cn(
          "group/day relative aspect-square w-full select-none p-0.5 text-center",
          defaultClassNames.day
        ),
        today: cn(
          "[&_button]:ring-1 [&_button]:ring-accent/50",
          defaultClassNames.today
        ),
        outside: cn(
          "!text-muted-foreground/30 [&_button]:!text-muted-foreground/30",
          defaultClassNames.outside
        ),
        disabled: cn("text-muted-foreground/30 opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => (
          <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />
        ),
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left")
            return <ChevronLeftIcon className={cn("size-4", className)} {...props} />
          if (orientation === "right")
            return <ChevronRightIcon className={cn("size-4", className)} {...props} />
          return <ChevronDownIcon className={cn("size-4", className)} {...props} />
        },
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      className={cn(
        "h-full w-full rounded-md font-normal text-sm aspect-square text-inherit",
        "data-[selected-single=true]:bg-accent data-[selected-single=true]:text-accent-foreground data-[selected-single=true]:font-semibold data-[selected-single=true]:shadow-sm",
        "hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-accent",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
