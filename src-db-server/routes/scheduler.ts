import { Elysia } from 'elysia'
import { Type } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import { backendRuntime, type createBackendRuntime } from '@d/workflows/runtime'
import { getNowMillis } from '@c/datetimeUtils'
import { Logger } from '@c/Logger'
import { UnHussleDB } from '@d/database/UnHussleDB'
import {
  previewWeek,
  readDay,
  readNext,
  readSettings,
  ScheduleConflict,
} from '@d/workflows/scheduler'
import {
  adjustPlanSchema,
  changeModeSchema,
  generatePlanSchema,
  replanSchema,
  schedulerDayParamsSchema,
  schedulerDayQuerySchema,
  schedulerSettingsSchema,
  selectDayPlanSchema,
  selectNextTaskSchema,
  selectOccurrenceSchema,
  selectTimeEntriesSchema,
  stopTrackingSchema,
  transitionOccurrenceSchema,
} from '@d/database/validation'
import { operationIdHeader, traceOf } from './telemetry'

const dayRequest = {
  params: schedulerDayParamsSchema,
  query: schedulerDayQuerySchema,
}

export function createSchedulerRoutes(
  database: UnHussleDB,
  runtime: ReturnType<typeof createBackendRuntime>,
  now = getNowMillis,
) {
  return new Elysia({ prefix: '/scheduler', name: 'scheduler' })
    .decorate('logger', Logger.getInstance())
    .onError(({ code, error, status, logger }) => {
      logger.error(`Error in scheduler route (${code})`, { error })
      // Plan errors explain what the user can do, so their message is returned.
      return status(error instanceof ScheduleConflict ? 409 : 400, {
        message:
          error instanceof Error ? error.message : 'Unable to update the plan',
      })
    })

    .get(
      '/settings',
      async () =>
        Value.Parse(
          schedulerSettingsSchema,
          readSettings(await database.getDb()),
        ),
      { response: schedulerSettingsSchema },
    )

    .get(
      '/day/:date',
      async ({ params: { date }, query: { timezone } }) =>
        Value.Parse(
          selectDayPlanSchema,
          readDay(await database.getDb(), date, timezone, now()),
        ),
      { ...dayRequest, response: selectDayPlanSchema },
    )

    .get(
      '/next/:date',
      async ({ params: { date }, query: { timezone } }) =>
        Value.Parse(
          selectNextTaskSchema,
          readNext(await database.getDb(), date, timezone, now()),
        ),
      { ...dayRequest, response: selectNextTaskSchema },
    )

    .get(
      '/week/:date',
      async ({ params: { date }, query: { timezone } }) =>
        Value.Parse(
          Type.Array(selectDayPlanSchema),
          previewWeek(await database.getDb(), date, timezone, now()),
        ),
      { ...dayRequest, response: Type.Array(selectDayPlanSchema) },
    )

    .post(
      '/generate',
      async ({ body, headers, request }) =>
        Value.Parse(
          selectDayPlanSchema,
          await runtime.commands.execute(
            'scheduler.generate',
            { ...body, operationId: headers[operationIdHeader] },
            traceOf(request),
          ),
        ),
      { body: generatePlanSchema, response: selectDayPlanSchema },
    )

    .post(
      '/replan',
      async ({ body, headers, request }) =>
        Value.Parse(
          selectDayPlanSchema,
          await runtime.commands.execute(
            'scheduler.replan',
            { ...body, operationId: headers[operationIdHeader] },
            traceOf(request),
          ),
        ),
      { body: replanSchema, response: selectDayPlanSchema },
    )

    .post(
      '/adjust',
      async ({ body, headers, request }) =>
        Value.Parse(
          selectDayPlanSchema,
          await runtime.commands.execute(
            'scheduler.adjust',
            { ...body, operationId: headers[operationIdHeader] },
            traceOf(request),
          ),
        ),
      { body: adjustPlanSchema, response: selectDayPlanSchema },
    )

    .post(
      '/mode',
      async ({ body, headers, request }) =>
        Value.Parse(
          selectDayPlanSchema,
          await runtime.commands.execute(
            'scheduler.mode.change',
            { ...body, operationId: headers[operationIdHeader] },
            traceOf(request),
          ),
        ),
      { body: changeModeSchema, response: selectDayPlanSchema },
    )

    .patch(
      '/settings',
      async ({ body, headers, request }) =>
        Value.Parse(
          schedulerSettingsSchema,
          await runtime.commands.execute(
            'scheduler.settings.change',
            { settings: body, operationId: headers[operationIdHeader] },
            traceOf(request),
          ),
        ),
      { body: schedulerSettingsSchema, response: schedulerSettingsSchema },
    )

    .post(
      '/occurrence',
      async ({ body, headers, request }) =>
        Value.Parse(
          selectOccurrenceSchema,
          await runtime.commands.execute(
            'occurrence.transition',
            { ...body, operationId: headers[operationIdHeader] },
            traceOf(request),
          ),
        ),
      { body: transitionOccurrenceSchema, response: selectOccurrenceSchema },
    )

    .post(
      '/tracking/stop',
      async ({ body, headers, request }) =>
        Value.Parse(
          selectTimeEntriesSchema,
          await runtime.commands.execute(
            'tracking.stop',
            { ...body, operationId: headers[operationIdHeader] },
            traceOf(request),
          ),
        ),
      { body: stopTrackingSchema, response: selectTimeEntriesSchema },
    )
}

export const schedulerRoutes = createSchedulerRoutes(
  UnHussleDB.getInstance(),
  backendRuntime,
)
