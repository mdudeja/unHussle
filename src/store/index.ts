import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { createTasksSlice, TasksSlice } from '@/store/slices/createTasksSlice'
import {
  createProjectsSlice,
  ProjectsSlice,
} from '@/store/slices/createProjectsSlice'
import { createAreasSlice, AreasSlice } from '@/store/slices/createAreasSlice'
import { createGoalsSlice, GoalsSlice } from '@/store/slices/createGoalsSlice'
import {
  createEntityTagsSlice,
  EntityTagsSlice,
} from '@/store/slices/createEntityTagsSlice'
import { createUISlice, UISlice } from '@/store/slices/createUISlice'

export type StoreState = TasksSlice &
  ProjectsSlice &
  AreasSlice &
  GoalsSlice &
  EntityTagsSlice &
  UISlice

export const useStore = create<StoreState>()(
  devtools(
    (...a) => ({
      ...createTasksSlice(...a),
      ...createProjectsSlice(...a),
      ...createAreasSlice(...a),
      ...createGoalsSlice(...a),
      ...createEntityTagsSlice(...a),
      ...createUISlice(...a),
    }),
    {
      name: 'unHussle Store', // Optional: custom name in devtools
      enabled: process.env.NODE_ENV !== 'production', // Disable in production
    },
  ),
)
