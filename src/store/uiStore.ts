import { create } from 'zustand';

interface UIStoreState {
  // Theme & Layout
  darkMode: boolean;
  stealthMode: boolean;
  rightSidebar: string | null;
  lowerBoxState: 'hidden' | 'minimized' | 'normal' | 'maximized';
  activeTab: string;
  tradingTab: string;
  isReportPinned: boolean;
  focusMode: boolean;
  isMobileMenuOpen: boolean;

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
  setTradingTab: (tab: string) => void;
  setIsReportPinned: (pinned: boolean) => void;
  setFocusMode: (mode: boolean) => void;
  setMobileMenuOpen: (open: boolean) => void;
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
  tradingTab: 'Arbitrage Matrix',
  isReportPinned: false,
  focusMode: false,
  isMobileMenuOpen: false,
  
  activeModal: null,
  indicatorSearchQuery: '',
  indicatorCategorySubTab: 'Indicators',
  selectedIndicatorTab: 'Technicals',

  setDarkMode: (mode) => set({ darkMode: mode }),
  setStealthMode: (mode) => set({ stealthMode: mode }),
  setRightSidebar: (sidebar) => set({ rightSidebar: sidebar }),
  setLowerBoxState: (state) => set({ lowerBoxState: state }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setTradingTab: (tab) => set({ tradingTab: tab }),
  setIsReportPinned: (pinned) => set({ isReportPinned: pinned }),
  setFocusMode: (mode) => set({ focusMode: mode }),
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
  setActiveModal: (modal) => set({ activeModal: modal }),
  setIndicatorSearchQuery: (query) => set({ indicatorSearchQuery: query }),
  setIndicatorCategorySubTab: (tab) => set({ indicatorCategorySubTab: tab }),
  setSelectedIndicatorTab: (tab) => set({ selectedIndicatorTab: tab }),
}));
