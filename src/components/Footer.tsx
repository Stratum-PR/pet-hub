export function Footer() {
  return (
    <footer className="border-t mt-12 bg-muted/30">
      <div className="max-w-[320px] mx-auto px-4 py-4 flex flex-col items-center gap-1">
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">Powered by</span>
          <a
            href="https://stratumpr.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center hover:opacity-90 transition-opacity shrink-0"
          >
            <img
              src="/Logo 4.svg"
              alt="STRATUM PR LLC"
              className="object-contain h-6 w-auto max-w-[100px] cursor-pointer"
            />
          </a>
        </div>
        <div className="text-[10px] text-muted-foreground">© 2025 STRATUM PR LLC</div>
      </div>
    </footer>
  );
}

