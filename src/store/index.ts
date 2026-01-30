import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { createTasksSlice, TasksSlice } from '@/store/slices/createTasksSlice'
import {
  createProjectsSlice,
  ProjectsSlice,
} from '@/store/slices/createProjectsSlice'
import { createAreasSlice, AreasSlice } from '@/store/slices/createAreasSlice'
import { createGoalsSlice, GoalsSlice } from '@/store/slices/createGoalsSlice'
import { createTagsSlice, TagsSlice } from '@/store/slices/createTagsSlice'
import { createUISlice, UISlice } from '@/store/slices/createUISlice'
import {
  createResourcesSlice,
  ResourcesSlice,
} from '@/store/slices/createResourcesSlice'

export type StoreState = TasksSlice &
  ResourcesSlice &
  ProjectsSlice &
  AreasSlice &
  GoalsSlice &
  TagsSlice &
  UISlice

export const useStore = create<StoreState>()(
  devtools(
    (...a) => ({
      ...createTasksSlice(...a),
      ...createResourcesSlice(...a),
      ...createProjectsSlice(...a),
      ...createAreasSlice(...a),
      ...createGoalsSlice(...a),
      ...createTagsSlice(...a),
      ...createUISlice(...a),
    }),
    {
      name: 'unHussle Store', // Optional: custom name in devtools
      enabled: process.env.NODE_ENV !== 'production', // Disable in production
    },
  ),
)
