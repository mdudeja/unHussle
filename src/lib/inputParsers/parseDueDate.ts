import { getStartOfDayMillis } from '@c/datetimeUtils'
import { Temporal } from 'temporal-polyfill'

const weekdays: { [key: string]: number } = {
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
  sunday: 7,
  sun: 7,
}

const months: { [key: string]: number } = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
}

const weekdayText = Object.keys(weekdays).join('|')
const weekdayRegex = new RegExp(
  `due\\s+(this|next)?\\s*(${weekdayText})\\b`,
  'i',
)
const monthsText = Object.keys(months).join('|')
const monthsRegexDateFirst = new RegExp(
  `due\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthsText})\\b`,
  'i',
)
const monthsRegexMonthFirst = new RegExp(
  `due\\s+(${monthsText})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`,
  'i',
)
const ddmmyyyyRegex = /due\s+(\d{1,2})\/(\d{1,2})\/?(\d{4})?/i

const getDateFromMonthAndDay = (
  month: number,
  day: number,
  now: Temporal.PlainDate,
) => {
  let year = now.year
  try {
    const date = Temporal.PlainDate.from(
      { year, month, day },
      { overflow: 'reject' },
    )
    if (Temporal.PlainDate.compare(date, now) < 0) {
      year += 1 // If the date has already passed this year, set it for next year
    }
    const finalDate = Temporal.PlainDate.from(
      { year, month, day },
      { overflow: 'reject' },
    )
    return getStartOfDayMillis(finalDate)
  } catch (e) {
    // Invalid date
    return undefined
  }
}

export const parseDueDate = (input: string): number | undefined => {
  const now = Temporal.Now.plainDateISO()
  const lowerInput = input.toLowerCase().trim()

  // Today
  if (lowerInput.includes('due today')) {
    return getStartOfDayMillis(now)
  }

  // Tomorrow
  if (lowerInput.includes('due tomorrow')) {
    const tomorrow = now.add({ days: 1 })
    return getStartOfDayMillis(tomorrow)
  }

  // This week (end of week - Sunday)
  if (lowerInput.includes('due this week')) {
    const daysUntilSunday = 7 - now.dayOfWeek
    const endOfWeek = now.add({ days: daysUntilSunday })
    return getStartOfDayMillis(endOfWeek)
  }

  // end of the month or month end
  if (
    lowerInput.includes('due end of the month') ||
    lowerInput.includes('due month end')
  ) {
    const endOfMonth = now.with({ day: now.daysInMonth })
    return getStartOfDayMillis(endOfMonth)
  }

  // this/next <weekday> (e.g., "due this Monday", "due next Friday")
  const weekdayMatch = lowerInput.match(weekdayRegex)

  if (weekdayMatch) {
    const keyword = weekdayMatch[1]?.toLowerCase()
    const targetDay = !weekdayText.includes(keyword)
      ? weekdays[weekdayMatch[2]?.toLowerCase()]
      : weekdays[keyword]
    let daysToAdd = targetDay - now.dayOfWeek
    if (keyword === 'next') {
      // "next <day>" always lands on the following occurrence (today -> +7)
      daysToAdd += 7
    } else if (daysToAdd < 0) {
      // "this <day>" is the current week's occurrence, today included
      daysToAdd += 7
    }
    const targetDate = now.add({ days: daysToAdd })
    return getStartOfDayMillis(targetDate)
  }

  // DD/MM/YYYY or DD/MM format (assumes current year)
  const ddmmyyyyMatch = lowerInput.match(ddmmyyyyRegex)
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10)
    const month = parseInt(ddmmyyyyMatch[2], 10)
    const year = parseInt(ddmmyyyyMatch[3] ?? `${now.year}`, 10)
    try {
      const date = Temporal.PlainDate.from(
        { year, month, day },
        { overflow: 'reject' },
      )
      return getStartOfDayMillis(date)
    } catch (e) {
      // Invalid date
      return undefined
    }
  }

  // Natural language date parsing (e.g., "due 15th March")
  const naturalDateMatch = lowerInput.match(monthsRegexDateFirst)
  if (naturalDateMatch) {
    const day = parseInt(naturalDateMatch[1], 10)
    const monthName = naturalDateMatch[2].toLowerCase()
    const month = months[monthName]
    if (!month || !day) {
      return undefined
    }
    return getDateFromMonthAndDay(month, day, now)
  }

  const naturalDateMatchMonthFirst = lowerInput.match(monthsRegexMonthFirst)
  if (naturalDateMatchMonthFirst) {
    const monthName = naturalDateMatchMonthFirst[1].toLowerCase()
    const month = months[monthName]
    const day = parseInt(naturalDateMatchMonthFirst[2], 10)
    if (!month || !day) {
      return undefined
    }
    return getDateFromMonthAndDay(month, day, now)
  }
  return undefined
}
