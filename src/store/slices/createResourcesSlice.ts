import { ResourcesService } from '@/services/ResourcesService'
import generateCreateDbConnectedStateSlice, {
  DbSlice,
} from '@/store/slices/createDbConnectedStoreSlice'
import { Resource } from '@c/index'

export interface ResourcesSlice {
  resources: DbSlice<Resource>
}

export const createResourcesSlice = generateCreateDbConnectedStateSlice<
  Resource,
  'resources'
>(ResourcesService.getInstance(), 'resources')
