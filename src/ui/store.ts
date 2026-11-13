/** @file Ephemeral interface state only; persistent domain records stay in Dexie. */
import { create } from 'zustand';
export type Page = 'characters' | 'systems' | 'resources' | 'dice' | 'combat' | 'diagnostics' | 'settings';
interface UiState {
  page: Page; characterId: string | null; systemKey: string; search: string;
  navigate: (page: Page) => void;
  openCharacter: (id: string) => void;
  selectSystem: (key: string) => void;
  setSearch: (search: string) => void;
}
export const useUi = create<UiState>(set => ({
  page: 'characters', characterId: null, systemKey: '', search: '',
  navigate: page => set({ page, characterId: null }),
  openCharacter: characterId => set({ page: 'characters', characterId }),
  selectSystem: systemKey => set({ systemKey }),
  setSearch: search => set({ search })
}));
