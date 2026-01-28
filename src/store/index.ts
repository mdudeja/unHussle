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

export type StoreState = TasksSlice &
  ProjectsSlice &
  AreasSlice &
  GoalsSlice &
  TagsSlice &
  UISlice

export const useStore = create<StoreState>()(
  devtools((...a) => ({
    ...createTasksSlice(...a),
    ...createProjectsSlice(...a),
    ...createAreasSlice(...a),
    ...createGoalsSlice(...a),
    ...createTagsSlice(...a),
    ...createUISlice(...a),
  })),
)
