import { Goal } from '@c/types/index'
import generateCreateDbConnectedStateSlice, {
  DbSlice,
} from '@/store/slices/createDbConnectedStoreSlice'

export interface GoalsSlice {
  goals: DbSlice<Goal>
}

export const createGoalsSlice = generateCreateDbConnectedStateSlice<
  Goal,
  'goals'
>('goals')
