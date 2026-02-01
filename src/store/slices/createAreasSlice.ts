import { Area } from '@c/index'
import { AreasService } from '@/services/database/AreasService'
import generateCreateDbConnectedStateSlice, {
  DbSlice,
} from '@/store/slices/createDbConnectedStoreSlice'

export interface AreasSlice {
  areas: DbSlice<Area>
}

export const createAreasSlice = generateCreateDbConnectedStateSlice<
  Area,
  'areas'
>(AreasService.getInstance(), 'areas')
