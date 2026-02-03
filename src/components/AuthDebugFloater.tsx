import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getAuthLogsAsText } from '@/lib/authDebugLog';
import { Copy, FileText } from 'lucide-react';

/**
 * Floating "Auth log" button shown only in DEV. Lets you open and copy the auth
 * debug log from any page (e.g. Login) without having to land on the callback page.
 */
export function AuthDebugFloater() {
  const [open, setOpen] = useState(false);
  const [logText, setLogText] = useState('');

  useEffect(() => {
    if (!open) return;
    const update = () => setLogText(getAuthLogsAsText());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [open]);

  if (import.meta.env.PROD) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(logText || 'No auth log entries.');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-4 right-4 z-[100] h-9 gap-1.5 bg-background/95 shadow-md backdrop-blur"
          aria-label="Auth debug log"
        >
          <FileText className="h-4 w-4" />
          Auth log
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(90vw,420px)] p-0"
        align="end"
        side="top"
        sideOffset={8}
      >
        <div className="flex flex-col gap-2 p-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted-foreground">Auth debug log</span>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleCopy}>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
          </div>
          <ScrollArea className="h-[240px] w-full rounded border bg-muted/50">
            <pre className="p-3 text-xs whitespace-pre-wrap break-all font-mono">
              {logText || 'No entries yet.'}
            </pre>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
