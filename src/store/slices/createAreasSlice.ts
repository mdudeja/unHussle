import { Area } from '@c/types/index'
import generateCreateDbConnectedStateSlice, {
  DbSlice,
} from '@/store/slices/createDbConnectedStoreSlice'

export interface AreasSlice {
  areas: DbSlice<Area>
}

export const createAreasSlice = generateCreateDbConnectedStateSlice<
  Area,
  'areas'
>('areas')
