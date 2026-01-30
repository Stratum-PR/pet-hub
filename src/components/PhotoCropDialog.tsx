import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RotateCw, X } from 'lucide-react';

interface PhotoCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onSave: (croppedImageDataUrl: string) => void;
  onCancel: () => void;
}

export function PhotoCropDialog({ open, onOpenChange, imageSrc, onSave, onCancel }: PhotoCropDialogProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [initialScale, setInitialScale] = useState(1);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const isClosingRef = useRef(false); // Track if we're in the process of closing

  // Calculate fit-to-container scale when image loads
  useEffect(() => {
    if (!open || !imageRef.current || !containerRef.current) return;

    const calculateFitScale = () => {
      if (!imageRef.current || !containerRef.current) return;

      const img = imageRef.current;
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      // Wait for image to have natural dimensions
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        return;
      }

      const containerWidth = containerRect.width - 40; // Account for padding
      const containerHeight = containerRect.height - 40;
      
      // Fit to smallest dimension (height or width) - fully unzoomed, BIG PICTURE
      // This ensures the image reaches the borders of the container's smallest measure
      const fitToWidth = containerWidth / img.naturalWidth;
      const fitToHeight = containerHeight / img.naturalHeight;
      
      // Use the smaller scale to fit to smallest dimension - this is the maximum unzoomed size
      // NO MINIMUM CONSTRAINT - show the image as big as possible (fit to container)
      const finalScale = Math.min(fitToWidth, fitToHeight);
      
      setInitialScale(finalScale);
      setScale(finalScale);
    };

    const img = imageRef.current;
    if (img.complete) {
      calculateFitScale();
    } else {
      img.onload = calculateFitScale;
    }
  }, [open, imageSrc, imageLoaded]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      isMountedRef.current = true;
      isClosingRef.current = false;
      setImageLoaded(false);
      // Scale will be set by calculateFitScale when image loads
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
    } else {
      // Mark as closing to prevent any further state updates
      isClosingRef.current = true;
      // Cleanup on close - use setTimeout to ensure this happens after React finishes
      setTimeout(() => {
        isMountedRef.current = false;
        setImageLoaded(false);
      }, 0);
    }
  }, [open]);

  const handleCancel = useCallback(() => {
    if (!isMountedRef.current || isClosingRef.current) return;
    isClosingRef.current = true;
    // Don't update state if we're closing
    onCancel();
    // Close dialog - let React handle the unmount
    onOpenChange(false);
  }, [onCancel, onOpenChange]);

  // Handle keyboard events (Esc to close)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handleCancel]);

  const handleImageLoad = useCallback(() => {
    if (isMountedRef.current && !isClosingRef.current) {
      setImageLoaded(true);
    }
  }, []);

  const handleZoomChange = useCallback((value: number[]) => {
    if (isMountedRef.current && !isClosingRef.current) {
      setScale(value[0]);
    }
  }, []);

  const handleRotate = useCallback(() => {
    if (isMountedRef.current && !isClosingRef.current) {
      setRotation(prev => (prev + 90) % 360);
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isMountedRef.current || isClosingRef.current) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !isMountedRef.current || isClosingRef.current) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    if (isMountedRef.current && !isClosingRef.current) {
      setIsDragging(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (!isMountedRef.current || isClosingRef.current) return;
    setScale(initialScale);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, [initialScale]);

  const handleSave = useCallback(() => {
    if (!imageRef.current || !containerRef.current || !isMountedRef.current || isClosingRef.current) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;
    
    // Wait for image to be fully loaded
    if (!img.complete || img.naturalWidth === 0) {
      return;
    }

    // Use a reasonable output size (square, 400x400 for good quality)
    const outputSize = 400;
    canvas.width = outputSize;
    canvas.height = outputSize;

    // Get natural image dimensions
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    
    // Calculate crop area based on current view
    // The crop guide is 200x200px in the center of the container
    const containerRect = containerRef.current.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    
    // Crop guide size in pixels
    const cropGuideSize = 200;
    const containerCenterX = containerRect.width / 2;
    const containerCenterY = containerRect.height / 2;
    
    // Calculate the displayed image size (accounting for scale)
    const displayedImgWidth = imgRect.width;
    const displayedImgHeight = imgRect.height;
    
    // Calculate the crop area center in container coordinates
    const cropCenterX = containerCenterX;
    const cropCenterY = containerCenterY;
    
    // Calculate the crop area corners in container coordinates
    const cropLeft = cropCenterX - cropGuideSize / 2;
    const cropTop = cropCenterY - cropGuideSize / 2;
    const cropRight = cropCenterX + cropGuideSize / 2;
    const cropBottom = cropCenterY + cropGuideSize / 2;
    
    // Calculate the image position in container (accounting for transform and rotation)
    // The image is centered at (containerWidth/2 + position.x, containerHeight/2 + position.y)
    const imgCenterX = containerRect.width / 2 + position.x;
    const imgCenterY = containerRect.height / 2 + position.y;
    const imgLeft = imgCenterX - displayedImgWidth / 2;
    const imgTop = imgCenterY - displayedImgHeight / 2;
    
    // Convert crop area from container coordinates to image coordinates
    // Account for scale: displayed size = natural size * scale
    const scaleFactor = displayedImgWidth / imgWidth;
    
    // Calculate crop area in container coordinates relative to image
    const cropXInContainer = cropLeft - imgLeft;
    const cropYInContainer = cropTop - imgTop;
    
    // Convert to natural image coordinates (accounting for scale)
    const cropSizeInImage = cropGuideSize / scaleFactor;
    const sourceX = Math.max(0, Math.min(imgWidth - cropSizeInImage, cropXInContainer / scaleFactor));
    const sourceY = Math.max(0, Math.min(imgHeight - cropSizeInImage, cropYInContainer / scaleFactor));
    const sourceSize = Math.min(cropSizeInImage, imgWidth - sourceX, imgHeight - sourceY);

    // Draw image with transformations
    ctx.save();
    ctx.translate(outputSize / 2, outputSize / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    
    // Draw the cropped portion
    ctx.drawImage(
      img,
      sourceX, sourceY, sourceSize, sourceSize,
      -outputSize / 2, -outputSize / 2, outputSize, outputSize
    );
    
    ctx.restore();

    // Get data URL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    // Mark as saving to prevent multiple saves
    if (!isMountedRef.current || isClosingRef.current) return;
    
    // Mark as closing immediately to prevent any further state updates
    isClosingRef.current = true;
    
    // Call onSave synchronously BEFORE closing dialog
    // This ensures the callback happens before React tries to unmount
    try {
      onSave(dataUrl);
    } catch (error) {
      console.error('[PhotoCropDialog] Error in onSave callback:', error);
    }
    
    // Close dialog immediately - don't use setTimeout
    // The parent component will handle cleanup
    onOpenChange(false);
  }, [onSave, onOpenChange, position, scale, rotation]);

  // Calculate min/max zoom based on image size
  // Allow zooming out below fit-to-container (white background is okay)
  const minZoom = 0.1; // Minimum zoom (10% scale) - allows zooming out below fit
  const maxZoom = 3; // Maximum zoom (300% scale)
  const zoomValue = Math.max(minZoom, Math.min(maxZoom, scale));

  // Don't render if not open to prevent React reconciliation issues
  if (!open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && isMountedRef.current) {
        handleCancel();
      }
    }}>
      <DialogContent 
        className="max-w-3xl"
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          handleCancel();
        }}
        onPointerDownOutside={(e) => {
          // Prevent closing on outside click to avoid accidental closes
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Editar Foto</DialogTitle>
          <DialogDescription>
            Ajusta el zoom, rotación y posición de la foto. Arrastra para mover la imagen.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={containerRef}
          className="relative w-full h-[500px] bg-muted rounded-lg overflow-hidden border-2 border-border"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {imageSrc && (
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop preview"
              onLoad={handleImageLoad}
              className="absolute top-1/2 left-1/2 max-w-none select-none transition-transform duration-150"
              style={{
                transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale}) rotate(${rotation}deg)`,
                cursor: isDragging ? 'grabbing' : 'grab',
                willChange: isDragging ? 'transform' : 'auto',
              }}
              draggable={false}
            />
          )}

          {/* Crop overlay guide */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[200px] h-[200px] border-2 border-primary border-dashed rounded-lg shadow-lg" />
          </div>
        </div>

        <div className="space-y-4">
          {/* Zoom Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Zoom</label>
              <span className="text-sm text-muted-foreground min-w-[60px] text-right">
                {Math.round(zoomValue * 100)}%
              </span>
            </div>
            <Slider
              value={[zoomValue]}
              onValueChange={handleZoomChange}
              min={0.1}
              max={maxZoom}
              step={0.05}
              className="w-full"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRotate}
              className="flex items-center gap-2"
            >
              <RotateCw className="h-4 w-4" />
              Rotar 90°
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
            >
              Resetear
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={!imageLoaded}>
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
