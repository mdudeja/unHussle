import { Temporal } from 'temporal-polyfill'

const getNow = (): Temporal.Instant => {
  return Temporal.Now.instant()
}

const getNowMillis = (): number => {
  return Temporal.Now.instant().epochMilliseconds
}

const getStartOfDayMillis = (date: Temporal.PlainDateLike): number => {
  const plainDate = Temporal.PlainDate.from(date)
  const startOfDay = plainDate.toPlainDateTime({
    hour: 0,
    minute: 0,
    second: 0,
  })
  const zonedDateTime = startOfDay.toZonedDateTime(Temporal.Now.timeZoneId())
  return zonedDateTime.toInstant().epochMilliseconds
}

const getEndOfDayMillis = (date: Temporal.PlainDateLike): number => {
  const plainDate = Temporal.PlainDate.from(date)
  const endOfDay = plainDate.toPlainDateTime({
    hour: 23,
    minute: 59,
    second: 59,
    millisecond: 999,
  })
  const zonedDateTime = endOfDay.toZonedDateTime(Temporal.Now.timeZoneId())
  return zonedDateTime.toInstant().epochMilliseconds
}

const formatTimeDuration = (durationSeconds: number): string => {
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

const formatDateTime = (millis: number): string => {
  const instant = Temporal.Instant.fromEpochMilliseconds(millis)
  const zonedDateTime = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId())
  return zonedDateTime.toString({ fractionalSecondDigits: 0 })
}

const formatDdMmYyyy = (date: Date): string =>
  `${String(date.getDate()).padStart(2, '0')}/${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}/${date.getFullYear()}`

// Formats an epoch-millis timestamp as DD/MM/YYYY in the local timezone.
const formatMillisAsDdMmYyyy = (millis: number): string => {
  const plainDate = Temporal.Instant.fromEpochMilliseconds(millis)
    .toZonedDateTimeISO(Temporal.Now.timeZoneId())
    .toPlainDate()
  return `${String(plainDate.day).padStart(2, '0')}/${String(
    plainDate.month,
  ).padStart(2, '0')}/${plainDate.year}`
}

/** Converts a JS Date (local time) into epoch millis at the start of that day. */
const dateToStartOfDayMillis = (date: Date): number =>
  getStartOfDayMillis({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  })

// Formats a JS Date (local time) as HH:MM (24h), the format of `<input type="time">`.
const formatHhMm = (date: Date): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`

// Formats an epoch-millis timestamp as DD/MM/YYYY HH:MM in the local timezone.
const formatMillisAsDdMmYyyyHhMm = (millis: number): string => {
  const zoned = Temporal.Instant.fromEpochMilliseconds(
    millis,
  ).toZonedDateTimeISO(Temporal.Now.timeZoneId())
  return `${formatMillisAsDdMmYyyy(millis)} ${String(zoned.hour).padStart(
    2,
    '0',
  )}:${String(zoned.minute).padStart(2, '0')}`
}

/** Combines the day of a JS Date (local time) with an HH:MM time into epoch millis. */
const dateAndTimeToMillis = (date: Date, time: string): number => {
  const [hour = 0, minute = 0] = time.split(':').map(Number)
  return Temporal.PlainDateTime.from({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour,
    minute,
  })
    .toZonedDateTime(Temporal.Now.timeZoneId())
    .toInstant().epochMilliseconds
}

export {
  getNow,
  getNowMillis,
  getStartOfDayMillis,
  getEndOfDayMillis,
  formatTimeDuration,
  formatDateTime,
  formatDdMmYyyy,
  formatMillisAsDdMmYyyy,
  dateToStartOfDayMillis,
  formatHhMm,
  formatMillisAsDdMmYyyyHhMm,
  dateAndTimeToMillis,
}
