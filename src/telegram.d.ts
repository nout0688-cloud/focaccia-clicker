interface TelegramWebApp {
  ready(): void;
  expand(): void;
  close(): void;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  CloudStorage: {
    setItem(key: string, value: string, callback?: (err: string | null, success?: boolean) => void): void;
    getItem(key: string, callback: (err: string | null, value?: string) => void): void;
    getItems(keys: string[], callback: (err: string | null, values?: Record<string, string>) => void): void;
    removeItem(key: string, callback?: (err: string | null) => void): void;
    getKeys(callback: (err: string | null, keys?: string[]) => void): void;
  };
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  BackButton?: {
    isVisible: boolean;
    show(): void;
    hide(): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
  };
  openTelegramLink?(url: string): void;
  openLink?(url: string, options?: { try_instant_view?: boolean }): void;
  initData: string;
  initDataUnsafe: {
    user?: {
      id?: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
      language_code?: string;
    };
    [key: string]: unknown;
  };
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}
