import { create } from 'zustand';

interface UIStoreState {
  // Theme & Layout
  darkMode: boolean;
  stealthMode: boolean;
  rightSidebar: string | null;
  lowerBoxState: 'hidden' | 'minimized' | 'normal' | 'maximized';
  activeTab: string;
  isReportPinned: boolean;
  
  // Modals
  activeModal: { type: string, title?: string } | null;
  indicatorSearchQuery: string;
  indicatorCategorySubTab: string;
  selectedIndicatorTab: string;

  // Actions
  setDarkMode: (mode: boolean) => void;
  setStealthMode: (mode: boolean) => void;
  setRightSidebar: (sidebar: string | null) => void;
  setLowerBoxState: (state: 'hidden' | 'minimized' | 'normal' | 'maximized') => void;
  setActiveTab: (tab: string) => void;
  setIsReportPinned: (pinned: boolean) => void;
  setActiveModal: (modal: { type: string, title?: string } | null) => void;
  setIndicatorSearchQuery: (query: string) => void;
  setIndicatorCategorySubTab: (tab: string) => void;
  setSelectedIndicatorTab: (tab: string) => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  darkMode: true,
  stealthMode: false,
  rightSidebar: null,
  lowerBoxState: 'hidden',
  activeTab: 'Overview',
  isReportPinned: false,
  
  activeModal: null,
  indicatorSearchQuery: '',
  indicatorCategorySubTab: 'Indicators',
  selectedIndicatorTab: 'Technicals',

  setDarkMode: (mode) => set({ darkMode: mode }),
  setStealthMode: (mode) => set({ stealthMode: mode }),
  setRightSidebar: (sidebar) => set({ rightSidebar: sidebar }),
  setLowerBoxState: (state) => set({ lowerBoxState: state }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setIsReportPinned: (pinned) => set({ isReportPinned: pinned }),
  setActiveModal: (modal) => set({ activeModal: modal }),
  setIndicatorSearchQuery: (query) => set({ indicatorSearchQuery: query }),
  setIndicatorCategorySubTab: (tab) => set({ indicatorCategorySubTab: tab }),
  setSelectedIndicatorTab: (tab) => set({ selectedIndicatorTab: tab }),
}));
