import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { WaitlistJoinModal } from '@/components/waitlist/WaitlistJoinModal';
import {
  pickRandomWaitlistMascotSrc,
  preloadAllWaitlistMascots,
  preloadImageSrc,
  WAITLIST_MASCOT_SRCS,
} from '@/lib/waitlistMascots';

export type OpenWaitlistOptions = {
  pricingTier?: string;
};

export type WaitlistModalContextValue = {
  openWaitlistModal: (opts?: OpenWaitlistOptions) => void;
  closeWaitlistModal: () => void;
};

const WaitlistModalContext = createContext<WaitlistModalContextValue | null>(null);

export function useWaitlistModal(): WaitlistModalContextValue {
  const ctx = useContext(WaitlistModalContext);
  if (!ctx) {
    throw new Error('useWaitlistModal must be used within WaitlistModalProvider');
  }
  return ctx;
}

export function WaitlistModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pricingTier, setPricingTier] = useState<string | undefined>();
  const [joinMascotSrc, setJoinMascotSrc] = useState<(typeof WAITLIST_MASCOT_SRCS)[number]>(
    WAITLIST_MASCOT_SRCS[0],
  );
  useEffect(() => {
    void preloadAllWaitlistMascots();
  }, []);

  const openWaitlistModal = useCallback((opts?: OpenWaitlistOptions) => {
    setPricingTier(opts?.pricingTier);
    const picked = pickRandomWaitlistMascotSrc();
    void preloadImageSrc(picked).then(() => {
      setJoinMascotSrc(picked);
      setOpen(true);
    });
  }, []);

  const closeWaitlistModal = useCallback(() => {
    setOpen(false);
    setPricingTier(undefined);
  }, []);

  const value = useMemo(
    () => ({ openWaitlistModal, closeWaitlistModal }),
    [openWaitlistModal, closeWaitlistModal],
  );

  return (
    <WaitlistModalContext.Provider value={value}>
      {children}
      <WaitlistJoinModal
        open={open}
        onClose={closeWaitlistModal}
        pricingTier={pricingTier}
        mascotSrc={joinMascotSrc}
      />
    </WaitlistModalContext.Provider>
  );
}
