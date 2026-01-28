import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t mt-12">
      <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-32 h-10 flex items-center justify-center overflow-hidden">
            <img
              src="/Logo 4.svg"
              alt="STRATUM PR LLC"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="text-sm leading-tight">
            <div className="font-semibold" style={{ color: '#1E2B7E' }}>
              STRATUM PR LLC
            </div>
            <div className="text-xs text-muted-foreground">
              Powered by Stratum
            </div>
          </div>
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-right">
          <Link
            to="https://stratumpr.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
            style={{ color: '#266AB2' }}
          >
            stratumpr.com
          </Link>
          <div className="mt-1">
            © 2025 STRATUM PR LLC. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}

