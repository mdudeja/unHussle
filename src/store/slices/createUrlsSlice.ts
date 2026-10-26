import generateCreateDbConnectedStateSlice, {
  DbSlice,
} from '@/store/slices/createDbConnectedStoreSlice'
import { Url } from '@d/database/schemas/urls.schema'

export interface UrlsSlice {
  urls: DbSlice<Url>
}

export const createUrlsSlice = generateCreateDbConnectedStateSlice<Url, 'urls'>(
  'urls',
)
