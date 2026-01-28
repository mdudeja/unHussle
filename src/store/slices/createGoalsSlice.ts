import { Goal } from '@c/index'
import { GoalsService } from '@/services/GoalsService'
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
