export function Footer() {
  return (
    <footer className="border-t mt-12 bg-muted/30">
      <div className="max-w-[200px] mx-auto px-4 py-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-center">
          <a
            href="https://stratumpr.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block hover:opacity-90 transition-opacity"
          >
            <img
              src="/Logo 4.svg"
              alt="STRATUM PR LLC"
              className="object-contain w-[120px] h-auto cursor-pointer"
            />
          </a>
          <div className="text-[10px] text-muted-foreground">
            © 2025 STRATUM PR LLC
          </div>
        </div>
      </div>
    </footer>
  );
}

