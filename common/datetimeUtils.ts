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

const formatTimeDuration = (durationMs: number): string => {
  const totalSeconds = Math.floor(durationMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)

  return parts.join(' ')
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
}
