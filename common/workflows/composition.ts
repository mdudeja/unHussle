import { Kind, OptionalKind, Type, type TSchema } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

/** JSON-serializable references; paths select declared object properties. */
export type Binding =
  | { from: 'input'; path?: string[] }
  | { from: 'step'; step: string; path?: string[] }
  | { from: 'literal'; value: unknown }
  | { from: 'object'; fields: Record<string, Binding> }

export type CommandDefinition = {
  id: string
  description: string
  execution?: 'command' | 'workflow'
  input: TSchema
  output: TSchema
  steps: { id: string; action?: string; command?: string; input: Binding }[]
  result: Binding
}

export type ActionDefinition<C> = {
  id: string
  description: string
  input: TSchema
  output: TSchema
  execution?: 'atomic' | 'application'
  run: (input: unknown, context: C) => unknown
}

/** Execution boundaries wrap a cached plan, never replace its registration. */
export type CommandBoundary<C> = {
  id: string
  run: (
    input: unknown,
    context: C,
    execute: (context: C, input?: unknown) => unknown,
  ) => Promise<unknown>
}

export type CompositionPolicy = {
  /** Kernel-owned ordered requirements, checked after command inlining. */
  required: string[]
  /** Preserve kernel bindings, schemas, and the explicit result on replacement. */
  protectBindings?: boolean
}

// Preserve TypeBox symbols and Elysia schema transform functions while isolating
// every mutable object owned by callers. Transforms are never invoked by Check.
const clone = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(clone) as T
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Reflect.ownKeys(value).map((key) => [
        key,
        clone((value as Record<PropertyKey, unknown>)[key]),
      ]),
    ) as T
  return value
}

/** Resolves a binding to its corresponding value from literals, the input, or previously computed step results. */
const read = (
  binding: Binding,
  input: unknown,
  results: Map<string, unknown>,
): unknown => {
  if (binding.from === 'literal') return binding.value
  if (binding.from === 'object')
    return Object.fromEntries(
      Object.entries(binding.fields).map(([key, value]) => [
        key,
        read(value, input, results),
      ]),
    )
  let value = binding.from === 'input' ? input : results.get(binding.step)
  for (const key of binding.path ?? [])
    value = (value as Record<string, unknown>)?.[key]
  return value
}

/** Restore TypeBox metadata for the JSON-schema subset used by definitions.
 * Executable schema transforms are intentionally not part of serialized definitions.
 */
const restoreSchema = (source: TSchema): TSchema => {
  type SchemaShape = {
    [Kind]?: string
    type?: string
    enum?: (string | number | boolean)[]
    anyOf?: TSchema[]
    allOf?: TSchema[]
    items?: TSchema | TSchema[]
    properties?: Record<string, TSchema>
    required?: string[]
    patternProperties?: Record<string, TSchema>
    additionalProperties?: boolean | TSchema
  }
  const schema = clone(source) as unknown as SchemaShape
  if (schema[Kind]) return schema as TSchema
  if (schema.enum)
    return Type.Union(
      schema.enum.map((value: string | number | boolean) =>
        Type.Literal(value),
      ),
    )
  if (schema.anyOf) schema.anyOf = schema.anyOf.map(restoreSchema)
  if (schema.allOf) schema.allOf = schema.allOf.map(restoreSchema)
  if (schema.items)
    schema.items = Array.isArray(schema.items)
      ? schema.items.map(restoreSchema)
      : restoreSchema(schema.items)
  if (schema.properties)
    for (const [key, property] of Object.entries(schema.properties)) {
      const restored = restoreSchema(property)
      if (!schema.required?.includes(key)) restored[OptionalKind] = 'Optional'
      schema.properties[key] = restored
    }
  if (schema.patternProperties)
    for (const key of Object.keys(schema.patternProperties))
      schema.patternProperties[key] = restoreSchema(
        schema.patternProperties[key],
      )
  if (
    schema.additionalProperties &&
    typeof schema.additionalProperties === 'object'
  )
    schema.additionalProperties = restoreSchema(schema.additionalProperties)
  const kinds: Record<string, string> = {
    string: 'String',
    number: 'Number',
    integer: 'Integer',
    boolean: 'Boolean',
    object: schema.patternProperties ? 'Record' : 'Object',
    array: 'Array',
    null: 'Null',
    undefined: 'Undefined',
  }
  if (
    '$ref' in schema ||
    'oneOf' in schema ||
    'not' in schema ||
    (schema.type && !kinds[schema.type])
  )
    throw new Error(
      'Unsupported serialized schema; use supported TypeBox JSON-schema definitions',
    )
  schema[Kind] =
    'const' in schema
      ? 'Literal'
      : schema.anyOf
        ? 'Union'
        : schema.allOf
          ? 'Intersect'
          : (kinds[schema.type ?? ''] ?? 'Unknown')
  return schema as TSchema
}

/** Creates an independent snapshot of a command definition, including restored input and output schemas. */
const snapshotDefinition = (definition: CommandDefinition) => ({
  ...clone(definition),
  input: restoreSchema(definition.input),
  output: restoreSchema(definition.output),
})

/** Validates that an identifier is a properly formatted namespaced id. */
const namespaced = (id: string) => {
  if (!/^[a-zA-Z][\w-]*(?:\.[\w-]+)+$/.test(id))
    throw new Error(`Expected a namespaced id: ${id}`)
}

/** Validates that a value conforms to the expected schema and raises an error describing any validation failures. */
const check = (schema: TSchema, value: unknown, label: string) => {
  if (!Value.Check(schema, value))
    throw new Error(
      `Invalid ${label}: ${[...Value.Errors(schema, value)].map((e) => `${e.path} ${e.message}`).join(', ')}`,
    )
}

/** Ensures atomic actions remain synchronous by rejecting values that behave like promises. */
const sync = (value: unknown) => {
  if (value && typeof (value as { then?: unknown }).then === 'function')
    throw new Error('Atomic actions must be synchronous')
  return value
}

/** Registry boundaries contain dynamic values. Compiled plans never open transactions. */
export function createCompositionRegistry<C>({
  invokeCommand,
}: {
  invokeCommand?: (
    id: string,
    context: C,
    run: (context: C) => Promise<unknown>,
  ) => Promise<unknown>
} = {}) {
  const actions = new Map<string, ActionDefinition<C>>()
  const definitions = new Map<string, CommandDefinition>()
  type Plan = {
    input: TSchema
    output: TSchema
    actions: string[]
    run: (input: unknown, context: C) => unknown
    runAsync: (input: unknown, context: C) => Promise<unknown>
  }
  let plans = new Map<string, Plan>()
  const boundaries = new Map<string, CommandBoundary<C>>()
  const policies = new Map<string, CompositionPolicy>()
  const protectedDefinitions = new Map<string, CommandDefinition>()

  /** Compiles a command definition into an executable, validated plan that
   * resolves dependencies, enforces schemas and policies, and prevents
   * recursive command definitions. */
  const compile = (id: string, stack: string[] = []): Plan => {
    const cached = plans.get(id)
    if (cached) return cached
    if (stack.includes(id))
      throw new Error(`Recursive command: ${[...stack, id].join(' -> ')}`)
    const definition = definitions.get(id)
    if (!definition) throw new Error(`Missing command: ${id}`)
    const boundary = boundaries.get(id)
    const outputs = new Map<string, TSchema>()

    /** Derives the schema represented by a binding, resolving literal and object bindings as well as schemas referenced from inputs or steps. */
    const schemaOf = (binding: Binding): TSchema => {
      if (binding.from === 'literal') return Type.Const(binding.value)
      if (binding.from === 'object')
        return Type.Object(
          Object.fromEntries(
            Object.entries(binding.fields).map(([key, value]) => [
              key,
              schemaOf(value),
            ]),
          ),
        )
      let schema =
        binding.from === 'input' ? definition.input : outputs.get(binding.step)
      if (!schema) throw new Error(`Unknown or forward step reference in ${id}`)
      let optional = false
      for (const key of binding.path ?? []) {
        const properties = schema.properties as
          Record<string, TSchema> | undefined
        if (!properties?.[key])
          throw new Error(`Undeclared binding path ${key} in ${id}`)
        schema = properties[key]
        optional ||= schema[OptionalKind] === 'Optional'
      }
      return optional ? Type.Union([schema, Type.Undefined()]) : schema
    }

    /** Validates that a bindings schema is compatible with the target schema, rejecting incompatible bindings. */
    const validateBinding = (binding: Binding, target: TSchema) => {
      const source = schemaOf(binding)
      if (JSON.stringify(source) === JSON.stringify(target)) return
      // TypeBox's structural assignability check is conservative for unions.
      const relation = Type.Extends(
        source,
        target,
        Type.Literal(true),
        Type.Literal(false),
      )
      if (relation.const !== true)
        throw new Error(`Incompatible binding in ${id}`)
    }

    const flattened: string[] = []
    const steps = definition.steps.map((step) => {
      if (!step.id || outputs.has(step.id))
        throw new Error(`Duplicate or empty step id in ${id}: ${step.id}`)
      if (!!step.action === !!step.command)
        throw new Error(`Step ${step.id} needs exactly one action or command`)
      if (
        step.command &&
        definition.execution !== 'workflow' &&
        boundaries.get(step.command)?.id !== boundary?.id
      )
        throw new Error(
          `Incompatible execution boundary in ${id}: ${step.command}`,
        )
      if (
        step.command &&
        definition.execution !== 'workflow' &&
        definitions.get(step.command)?.execution === 'workflow'
      )
        throw new Error(`Commands cannot inline workflows: ${step.command}`)
      const target = step.action
        ? actions.get(step.action)
        : compile(step.command!, [...stack, id])
      if (!target) throw new Error(`Missing action: ${step.action}`)
      if (step.action && 'execution' in target) {
        if (boundary && target.execution === 'application')
          throw new Error(
            `Application action cannot run atomically: ${step.action}`,
          )
        if (!boundary && target.execution === 'atomic')
          throw new Error(
            `Atomic action requires an atomic command: ${step.action}`,
          )
      }
      validateBinding(step.input, target.input)
      outputs.set(step.id, target.output)
      flattened.push(...('actions' in target ? target.actions : [target.id]))
      return { ...step, target }
    })
    validateBinding(definition.result, definition.output)

    const protectedDefinition = protectedDefinitions.get(id)
    if (protectedDefinition) {
      /** Determines whether two values are equivalent based on their JSON serialization. */
      const same = (left: unknown, right: unknown) =>
        JSON.stringify(left) === JSON.stringify(right)
      if (
        !same(definition.execution, protectedDefinition.execution) ||
        !same(definition.input, protectedDefinition.input) ||
        !same(definition.output, protectedDefinition.output) ||
        !same(definition.result, protectedDefinition.result)
      )
        throw new Error(
          `Command ${id} cannot change kernel schemas or result binding`,
        )

      for (const required of protectedDefinition.steps) {
        const matches = definition.steps.filter(
          (step) => step.action === required.action,
        )
        if (matches.length !== 1 || !same(matches[0], required))
          throw new Error(
            `Command ${id} cannot change kernel step ${required.id}`,
          )
      }
      const rows = flattened.filter((name) =>
        /kernel\.mutation\.(createRow|updateRow|deleteRow|deleteAllRows)$/.test(
          name,
        ),
      )
      if (rows.length !== 1)
        throw new Error(`Command ${id} requires exactly one row operation`)
    }

    let previous = -1
    for (const required of policies.get(id)?.required ?? []) {
      const index = flattened.indexOf(required, previous + 1)
      if (index < 0)
        throw new Error(
          `Command ${id} requires ${required} after ${flattened[previous] ?? 'start'}`,
        )
      previous = index
    }
    const plan: Plan = {
      input: definition.input,
      output: definition.output,
      actions: flattened,

      /** Asynchronously executes the defined sequence of steps in order to produce the final result. */
      async runAsync(input, context) {
        if (boundary) {
          check(definition.input, input, `${id} input`)
          return boundary.run(input, context, (atomicContext, value = input) =>
            plan.run(value, atomicContext),
          )
        }
        const results = new Map<string, unknown>()
        const completed: { id: string; result: unknown }[] = []
        let failedStep = 'input'
        try {
          check(definition.input, input, `${id} input`)
          for (const step of steps) {
            failedStep = step.id
            const value = read(step.input, input, results)
            check(step.target.input, value, `${id}/${step.id} input`)
            const target = step.target
            const result =
              'runAsync' in target
                ? await (invokeCommand
                    ? invokeCommand(step.command!, context, (nextContext) =>
                        target.runAsync(value, nextContext),
                      )
                    : target.runAsync(value, context))
                : await target.run(value, context)
            check(step.target.output, result, `${id}/${step.id} output`)
            results.set(step.id, result)
            completed.push({ id: step.id, result })
          }
          failedStep = 'result'
          const result = read(definition.result, input, results)
          check(definition.output, result, `${id} output`)
          return result
        } catch (error) {
          if (definition.execution === 'workflow')
            throw new WorkflowFailure(completed, failedStep, error)
          throw error
        }
      },

      /** Executes the defined workflow against the given input and context, validating each steps inputs and outputs and returning the final result. */
      run(input, context) {
        if (definition.execution === 'workflow')
          throw new Error(
            'Workflows require independent asynchronous command execution',
          )
        check(definition.input, input, `${id} input`)
        const results = new Map<string, unknown>()
        for (const step of steps) {
          const value = read(step.input, input, results)
          check(step.target.input, value, `${id}/${step.id} input`)
          const result = sync(step.target.run(value, context))
          check(step.target.output, result, `${id}/${step.id} output`)
          results.set(step.id, result)
        }
        const result = read(definition.result, input, results)
        check(definition.output, result, `${id} output`)
        return result
      },
    }
    plans.set(id, plan)
    return plan
  }

  /** Rebuilds all compiled plans from the current definitions. */
  const recompile = () => {
    plans = new Map()
    for (const id of definitions.keys()) compile(id)
  }

  return {
    /** Registers an action definition for later use, ensuring each action has a unique identifier. */
    registerAction(action: ActionDefinition<C>) {
      namespaced(action.id)
      if (actions.has(action.id))
        throw new Error(`Duplicate action: ${action.id}`)
      actions.set(action.id, {
        ...action,
        input: restoreSchema(action.input),
        output: restoreSchema(action.output),
      })
    },
    /** Registers a command definition and optional composition policy with the
     * command system so the command is available for use. */
    registerCommand(
      definition: CommandDefinition,
      policy?: CompositionPolicy,
      boundary?: CommandBoundary<C>,
    ) {
      namespaced(definition.id)
      if (definitions.has(definition.id))
        throw new Error(`Duplicate command: ${definition.id}`)
      const snapshot = snapshotDefinition(definition)
      if (boundary) boundaries.set(definition.id, boundary)
      definitions.set(definition.id, snapshot)
      if (policy)
        policies.set(definition.id, {
          ...policy,
          required: [...policy.required],
        })
      if (policy?.protectBindings)
        protectedDefinitions.set(definition.id, clone(definition))
      try {
        recompile()
      } catch (error) {
        definitions.delete(definition.id)
        boundaries.delete(definition.id)
        policies.delete(definition.id)
        protectedDefinitions.delete(definition.id)
        recompile()
        throw error
      }
    },
    /** Replaces a command definition; the previous plan stays if recompilation fails. */
    replaceCommand(definition: CommandDefinition) {
      const previous = definitions.get(definition.id)
      if (!previous) throw new Error(`Missing command: ${definition.id}`)
      definitions.set(definition.id, snapshotDefinition(definition))
      try {
        recompile()
      } catch (error) {
        definitions.set(definition.id, previous)
        recompile()
        throw error
      }
    },
    /** Removal revokes cached dependent plans too; invoking a dependent
     * reports its missing target. */
    remove(actionIds: string[] = [], commandIds: string[] = []) {
      const removedActions = new Set(actionIds)
      const removedCommands = new Set(commandIds)
      let changed = true
      while (changed) {
        changed = false
        for (const [id, definition] of definitions) {
          if (removedCommands.has(id)) continue
          if (
            definition.steps.some(
              (step) =>
                (step.action && removedActions.has(step.action)) ||
                (step.command && removedCommands.has(step.command)),
            )
          ) {
            removedCommands.add(id)
            changed = true
          }
        }
      }
      for (const id of removedActions) actions.delete(id)
      for (const id of removedCommands) {
        definitions.delete(id)
        boundaries.delete(id)
        policies.delete(id)
        protectedDefinitions.delete(id)
      }
      plans.clear()
      return [...removedCommands]
    },
    clear() {
      actions.clear()
      definitions.clear()
      boundaries.clear()
      policies.clear()
      protectedDefinitions.clear()
      plans.clear()
    },
    /** The ID of the execution boundary a command runs in, if any. */
    boundary(id: string) {
      return boundaries.get(id)?.id
    },
    /** Determines whether an identifier represents a command, a workflow, or neither. */
    kind(id: string) {
      return definitions.get(id)?.execution === 'workflow'
        ? 'workflow'
        : definitions.has(id)
          ? 'command'
          : undefined
    },
    /** Asynchronously executes the operation identified by the given identifier. */
    executeAsync(id: string, input: unknown, context: C) {
      return compile(id).runAsync(input, context)
    },
    /** Retrieves a cloned command definition for the specified command
     * identifier, failing if the command is not registered. */
    definition(id: string) {
      const definition = definitions.get(id)
      if (!definition) throw new Error(`Missing command: ${id}`)
      return clone(definition)
    },
    /** Executes the operation identified by id using the supplied input and context. */
    execute(id: string, input: unknown, context: C) {
      return compile(id).run(input, context)
    },
  }
}

/** Represents a workflow execution failure that captures where execution
 * stopped, what commands completed beforehand, and the underlying cause. */
export class WorkflowFailure extends Error {
  /** Creates a workflow failure that captures the step where execution
   * stopped, the commands completed before the failure, and the underlying
   * cause. */
  constructor(
    public readonly completed: { id: string; result: unknown }[],
    public readonly failedStep: string,
    cause: unknown,
  ) {
    super(
      `Workflow stopped at ${failedStep}; ${completed.length} commands committed`,
      { cause },
    )
  }
}
