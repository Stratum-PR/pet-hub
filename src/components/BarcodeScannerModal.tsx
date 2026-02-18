import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Scan, Keyboard } from 'lucide-react';
import { t } from '@/lib/translations';

const SCANNER_DIV_ID = 'barcode-scanner-viewfinder';

export interface BarcodeScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (value: string) => void;
  title?: string;
  /** Optional: play short beep on successful scan (uses Web Audio if available) */
  beepOnScan?: boolean;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch {
    // ignore
  }
}

export function BarcodeScannerModal({
  open,
  onOpenChange,
  onScan,
  title,
  beepOnScan = true,
}: BarcodeScannerModalProps) {
  const [manualValue, setManualValue] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStarting, setCameraStarting] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const handleDecode = (decodedText: string) => {
    const trimmed = decodedText?.trim();
    if (!trimmed) return;
    if (beepOnScan) playBeep();
    onScan(trimmed);
    onOpenChange(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualValue.trim();
    if (trimmed) {
      handleDecode(trimmed);
      setManualValue('');
    }
  };

  useEffect(() => {
    if (!open) return;
    setCameraError(null);
    setCameraStarting(true);
    let mounted = true;
    const start = async () => {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (!mounted || !cameras?.length) {
          setCameraError('No camera found.');
          setCameraStarting(false);
          return;
        }
        const back = cameras.find((c) => c.label.toLowerCase().includes('back')) ?? cameras[0];
        const scanner = new Html5Qrcode(SCANNER_DIV_ID, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.ITF,
          ],
          useBarCodeDetectorIfSupported: false,
        });
        scannerRef.current = scanner;
        await scanner.start(
          back.id,
          {
            fps: 15,
            qrbox: { width: 300, height: 150 },
            videoConstraints: {
              width: { min: 640, ideal: 1280 },
              height: { min: 480, ideal: 720 },
            },
          },
          (decodedText) => {
            if (mounted) handleDecode(decodedText);
          },
          () => {}
        );
        if (mounted) setCameraStarting(false);
      } catch (err: unknown) {
        if (mounted) {
          setCameraError(err instanceof Error ? err.message : 'Camera access failed.');
          setCameraStarting(false);
        }
      }
    };
    const timer = setTimeout(() => {
      start();
    }, 400);
    return () => {
      clearTimeout(timer);
      mounted = false;
      scannerRef.current?.stop().then(() => {
        scannerRef.current?.clear();
        scannerRef.current = null;
      }).catch(() => {});
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? t('inventory.scanBarcode')}</DialogTitle>
          <DialogDescription>
            {t('inventory.scanBarcodeDescription') ?? 'Use your camera to scan a barcode, or enter SKU/barcode manually below.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative rounded-lg border bg-muted/30 overflow-hidden min-h-[200px] flex items-center justify-center">
            {cameraStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50 text-sm text-muted-foreground">
                {t('inventory.cameraStarting') ?? 'Starting camera…'}
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-destructive">
                {cameraError}
              </div>
            )}
            <div
              id={SCANNER_DIV_ID}
              className="w-full max-h-[320px] [&>div]:!max-h-[320px] [& video]:!max-h-[320px]"
              style={{ minHeight: cameraStarting ? 0 : 220, minWidth: 280 }}
            />
          </div>
          <form onSubmit={handleManualSubmit} className="flex flex-col gap-2">
            <Label htmlFor="manual-barcode" className="flex items-center gap-2 text-muted-foreground">
              <Keyboard className="h-4 w-4" />
              {t('inventory.manualEntryLabel') ?? 'Or enter barcode / SKU manually'}
            </Label>
            <p className="text-xs text-muted-foreground">{t('inventory.manualEntryHint') ?? 'Barcode: the number under the lines on the product (e.g. UPC). SKU: your own internal code (e.g. DS-001).'}</p>
            <div className="flex gap-2">
              <Input
                id="manual-barcode"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                placeholder={t('inventory.manualEntryPlaceholder') ?? 'Barcode or SKU'}
                className="flex-1"
              />
              <Button type="submit" size="sm" disabled={!manualValue.trim()}>
                <Scan className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
