import { Temporal } from 'temporal-polyfill'
import { addDaysToDate, parseCalendarDate } from '@c/calendarUtils'

export const MINUTE_MS = 60_000
export const getTimeZoneId = () => Temporal.Now.timeZoneId()

/** ISO calendar date of an instant in the requested timezone. */
export const getLocalDateString = (
  millis: number,
  timezone = getTimeZoneId(),
) =>
  Temporal.Instant.fromEpochMilliseconds(millis)
    .toZonedDateTimeISO(timezone)
    .toPlainDate()
    .toString()

/** Resolves a calendar date and wall-clock time to an instant in a timezone. */
export const getDateTimeMillis = (
  date: Parameters<typeof parseCalendarDate>[0],
  time: Parameters<typeof Temporal.PlainTime.from>[0],
  timezone = getTimeZoneId(),
) =>
  parseCalendarDate(date)
    .toPlainDateTime(Temporal.PlainTime.from(time))
    .toZonedDateTime(timezone).epochMilliseconds

/** Wall-clock minute of a day; 1440 means the following local midnight. */
export const getDateMinuteMillis = (
  date: Parameters<typeof parseCalendarDate>[0],
  minute: number,
  timezone = getTimeZoneId(),
) => {
  if (!Number.isInteger(minute) || minute < 0 || minute > 1440)
    throw new RangeError('Minute of day must be between 0 and 1440')
  return minute === 1440
    ? getDateTimeMillis(addDaysToDate(date, 1), '00:00', timezone)
    : getDateTimeMillis(
        date,
        { hour: Math.floor(minute / 60), minute: minute % 60 },
        timezone,
      )
}

/** Parses both times before comparing them; invalid values throw. */
export const compareTimes = (
  first: Parameters<typeof Temporal.PlainTime.from>[0],
  second: Parameters<typeof Temporal.PlainTime.from>[0],
) => Temporal.PlainTime.compare(first, second)

/** Half-open [start, next-day start) bounds, accounting for timezone/DST changes. */
export const getDayBoundsMillis = (
  date: Parameters<typeof parseCalendarDate>[0],
  timezone = getTimeZoneId(),
): [number, number] => [
  getStartOfDayMillis(date, timezone),
  getStartOfDayMillis(addDaysToDate(date, 1), timezone),
]

export const getNow = (): Temporal.Instant => {
  return Temporal.Now.instant()
}

export const getNowMillis = (): number => {
  return Temporal.Now.instant().epochMilliseconds
}

export const getStartOfDayMillis = (
  date: Parameters<typeof parseCalendarDate>[0],
  timezone = getTimeZoneId(),
): number => getDateTimeMillis(date, '00:00', timezone)

export const getEndOfDayMillis = (
  date: Parameters<typeof parseCalendarDate>[0],
  timezone = getTimeZoneId(),
): number => getDateTimeMillis(date, '23:59:59.999', timezone)

export const formatTimeDuration = (durationSeconds: number): string => {
  const hours = Math.floor(durationSeconds / 3600)
  const minutes = Math.floor((durationSeconds % 3600) / 60)
  const seconds = durationSeconds % 60

  // Format parts to always be at least 2 digits (00)
  const pad = (n: number) => n.toString().padStart(2, '0')

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${pad(minutes)}:${pad(seconds)}`
}

export const formatDateTime = (millis: number): string => {
  const instant = Temporal.Instant.fromEpochMilliseconds(millis)
  const zonedDateTime = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId())
  return zonedDateTime.toString({ fractionalSecondDigits: 0 })
}

export const formatDdMmYyyy = (date: Date): string =>
  `${String(date.getDate()).padStart(2, '0')}/${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}/${date.getFullYear()}`

// Formats an epoch-millis timestamp as DD/MM/YYYY in the local timezone.
export const formatMillisAsDdMmYyyy = (millis: number): string => {
  const plainDate = Temporal.Instant.fromEpochMilliseconds(millis)
    .toZonedDateTimeISO(Temporal.Now.timeZoneId())
    .toPlainDate()
  return `${String(plainDate.day).padStart(2, '0')}/${String(
    plainDate.month,
  ).padStart(2, '0')}/${plainDate.year}`
}

/** Converts a JS Date (local time) into epoch millis at the start of that day. */
export const dateToStartOfDayMillis = (date: Date): number =>
  getStartOfDayMillis({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  })

// Formats a JS Date (local time) as HH:MM (24h), the format of `<input type="time">`.
export const formatHhMm = (date: Date): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`

// Formats an epoch-millis timestamp as DD/MM/YYYY HH:MM in the local timezone.
export const formatMillisAsDdMmYyyyHhMm = (millis: number): string => {
  const zoned = Temporal.Instant.fromEpochMilliseconds(
    millis,
  ).toZonedDateTimeISO(Temporal.Now.timeZoneId())
  return `${formatMillisAsDdMmYyyy(millis)} ${String(zoned.hour).padStart(
    2,
    '0',
  )}:${String(zoned.minute).padStart(2, '0')}`
}

/** Combines the day of a JS Date (local time) with an HH:MM time into epoch millis. */
export const dateAndTimeToMillis = (date: Date, time: string): number => {
  const [hour = 0, minute = 0] = time.split(':').map(Number)
  return getDateTimeMillis(
    {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    },
    { hour, minute },
  )
}
