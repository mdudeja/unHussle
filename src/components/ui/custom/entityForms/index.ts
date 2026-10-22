// A generic, type-safe entity form system.
//
//   const fields = createProjectFields({ areas, goals })
//   <EntityFormDialog
//     fields={fields}
//     initialValues={project}
//     onSubmit={handleSubmit}
//     ...
//   />
//
// To support a new entity, add a `create<Entity>Fields` config whose
// `FieldConfig<T>[]` is keyed to that entity's `Write` type.
export * from './types'
export * from './utils'
export * from './GenericForm'
export * from './EntityFormDialog'
export * from './configs/projectFields'
export * from './configs/areaFields'
export * from './configs/goalFields'
