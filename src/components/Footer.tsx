export function Footer() {
  return (
    <footer className="border-t mt-12 bg-[#f9fafb]">
      <div className="container mx-auto px-4 py-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <a
            href="https://stratumpr.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block hover:opacity-90 transition-opacity"
          >
            <img
              src="/Logo 4.svg"
              alt="STRATUM PR LLC"
              className="object-contain w-[180px] max-w-[220px] h-auto sm:w-[160px] md:w-[190px] cursor-pointer"
            />
          </a>
          <div className="text-xs sm:text-sm text-muted-foreground">
            © 2025 STRATUM PR LLC. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}

