import { cn } from '@/lib/utils';
import './PawReveal.css';

/** Mount when content replaces the paw loader; plays a short blur-to-sharp reveal once. */
export function PawRevealEnter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('paw-reveal-content', className)}>{children}</div>;
}
