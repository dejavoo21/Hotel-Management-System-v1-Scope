import { create } from 'zustand';

type UiState = {
  globalSearch: string;
  setGlobalSearch: (value: string) => void;
  clearGlobalSearch: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  globalSearch: '',
  setGlobalSearch: (value) => set({ globalSearch: value }),
  clearGlobalSearch: () => set({ globalSearch: '' }),
}));

