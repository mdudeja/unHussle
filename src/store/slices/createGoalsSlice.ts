import { Goal } from '@c/types/index'
import { GoalsService } from '@/services/database/GoalsService'
import generateCreateDbConnectedStateSlice, {
  DbSlice,
} from '@/store/slices/createDbConnectedStoreSlice'

export interface GoalsSlice {
  goals: DbSlice<Goal>
}

export const createGoalsSlice = generateCreateDbConnectedStateSlice<
  Goal,
  'goals'
>(GoalsService.getInstance(), 'goals')
