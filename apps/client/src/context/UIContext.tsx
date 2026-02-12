import { createContext, useContext, useState, type ReactNode } from 'react';

interface UIContextType {
  // Login Modal
  isLoginOpen: boolean;
  openLogin: () => Promise<void>; // Returns promise that resolves on success
  closeLogin: () => void;
  resolveLogin: () => void; // Call this when login succeeds

  // Subscription Modal
  isSubscriptionOpen: boolean;
  subscriptionOptions: { autoStart: boolean };
  openSubscription: (options?: { autoStart?: boolean }) => Promise<void>;
  closeSubscription: () => void;
  resolveSubscription: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  // Login State
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginResolver, setLoginResolver] = useState<(() => void) | null>(null);

  // Subscription State
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [subscriptionOptions, setSubscriptionOptions] = useState({ autoStart: false });
  const [subscriptionResolver, setSubscriptionResolver] = useState<(() => void) | null>(null);

  // --- Login Handlers ---
  const openLogin = () => {
    setIsLoginOpen(true);
    return new Promise<void>((resolve) => {
      setLoginResolver(() => resolve);
    });
  };

  const closeLogin = () => {
    setIsLoginOpen(false);
    setLoginResolver(null);
  };

  const resolveLogin = () => {
    if (loginResolver) {
      loginResolver();
    }
    closeLogin();
  };

  // --- Subscription Handlers ---
  const openSubscription = (options: { autoStart?: boolean } = {}) => {
    setSubscriptionOptions({ autoStart: !!options.autoStart });
    setIsSubscriptionOpen(true);
    return new Promise<void>((resolve) => {
      setSubscriptionResolver(() => resolve);
    });
  };

  const closeSubscription = () => {
    setIsSubscriptionOpen(false);
    setSubscriptionOptions({ autoStart: false });
    setSubscriptionResolver(null);
  };

  const resolveSubscription = () => {
    if (subscriptionResolver) {
      subscriptionResolver();
    }
    closeSubscription();
  };

  return (
    <UIContext.Provider value={{
      isLoginOpen, openLogin, closeLogin, resolveLogin,
      isSubscriptionOpen, subscriptionOptions, openSubscription, closeSubscription, resolveSubscription
    }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
