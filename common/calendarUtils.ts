import { Temporal } from 'temporal-polyfill'

/** Parses and validates a calendar date without applying a timezone. */
export const parseCalendarDate = (
  date: Parameters<typeof Temporal.PlainDate.from>[0],
) => Temporal.PlainDate.from(date)

/** Adds calendar days, preserving date arithmetic across month/year boundaries. */
export const addDaysToDate = (
  date: Parameters<typeof parseCalendarDate>[0],
  days: number,
) => parseCalendarDate(date).add({ days }).toString()

/** Returns the Monday starting the calendar week containing this date. */
export const getWeekStartDate = (
  date: Parameters<typeof parseCalendarDate>[0],
) => {
  const day = parseCalendarDate(date)
  return day.subtract({ days: day.dayOfWeek - 1 }).toString()
}

export const weekdays: Record<
  string,
  { variations: string[]; dayOfWeek: number }
> = {
  monday: { variations: ['mon', 'monday'], dayOfWeek: 1 },
  tuesday: { variations: ['tue', 'tuesday'], dayOfWeek: 2 },
  wednesday: { variations: ['wed', 'wednesday'], dayOfWeek: 3 },
  thursday: { variations: ['thu', 'thurs', 'thursday'], dayOfWeek: 4 },
  friday: { variations: ['fri', 'friday'], dayOfWeek: 5 },
  saturday: { variations: ['sat', 'saturday'], dayOfWeek: 6 },
  sunday: { variations: ['sun', 'sunday'], dayOfWeek: 7 },
}

export const months: Record<
  string,
  { variations: string[]; monthInt: number; numberOfDays: number }
> = {
  january: { variations: ['jan', 'january'], monthInt: 1, numberOfDays: 31 },
  february: { variations: ['feb', 'february'], monthInt: 2, numberOfDays: 28 },
  march: { variations: ['mar', 'march'], monthInt: 3, numberOfDays: 31 },
  april: { variations: ['apr', 'april'], monthInt: 4, numberOfDays: 30 },
  may: { variations: ['may'], monthInt: 5, numberOfDays: 31 },
  june: { variations: ['jun', 'june'], monthInt: 6, numberOfDays: 30 },
  july: { variations: ['jul', 'july'], monthInt: 7, numberOfDays: 31 },
  august: { variations: ['aug', 'august'], monthInt: 8, numberOfDays: 31 },
  september: {
    variations: ['sep', 'sept', 'september'],
    monthInt: 9,
    numberOfDays: 30,
  },
  october: { variations: ['oct', 'october'], monthInt: 10, numberOfDays: 31 },
  november: { variations: ['nov', 'november'], monthInt: 11, numberOfDays: 30 },
  december: { variations: ['dec', 'december'], monthInt: 12, numberOfDays: 31 },
}

export const getSortedWeekdayNames = (): string[] => {
  return Object.keys(weekdays).sort(
    (a, b) => weekdays[a].dayOfWeek - weekdays[b].dayOfWeek,
  )
}

export const getSortedMonthNames = (): string[] => {
  return Object.keys(months).sort(
    (a, b) => months[a].monthInt - months[b].monthInt,
  )
}
