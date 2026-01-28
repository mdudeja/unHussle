import { StateCreator } from 'zustand'

export interface UISlice {
  isSidebarOpen: boolean
  toggleSidebar: () => void
  activeModal: string | null
  openModal: (modalId: string) => void
  closeModal: () => void
}

export const createUISlice: StateCreator<UISlice> = (set) => ({
  isSidebarOpen: true,
  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  activeModal: null,
  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),
})
