import { Project } from '@c/index'
import { ProjectsService } from '@/services/database/ProjectsService'
import generateCreateDbConnectedStateSlice, {
  DbSlice,
} from '@/store/slices/createDbConnectedStoreSlice'

export interface ProjectsSlice {
  projects: DbSlice<Project>
}

export const createProjectsSlice = generateCreateDbConnectedStateSlice<
  Project,
  'projects'
>(ProjectsService.getInstance(), 'projects')
