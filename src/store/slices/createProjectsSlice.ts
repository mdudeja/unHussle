import { Project } from '@c/types/index'
import generateCreateDbConnectedStateSlice, {
  DbSlice,
} from '@/store/slices/createDbConnectedStoreSlice'

export interface ProjectsSlice {
  projects: DbSlice<Project>
}

export const createProjectsSlice = generateCreateDbConnectedStateSlice<
  Project,
  'projects'
>('projects')
