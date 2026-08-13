import * as React from 'react';
import Cropper from 'react-easy-crop';
import { Loader2, RotateCcw, RotateCw, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import { Label } from '@/components/ui/react/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/react/dialog';
import { Slider } from '@/components/ui/react/slider';
import { getCroppedImageBlob, type CropArea } from '@/lib/crop-image';

interface Props {
  /** Object URL of the picked file. Null closes the dialog. */
  imageSrc: string | null;
  open: boolean;
  saving?: boolean;
  onCancel: () => void;
  onCropped: (blob: Blob) => void | Promise<void>;
}

const ASPECTS = [
  { label: 'Katror', value: 1, hint: '1:1' },
  { label: 'Gjerë', value: 3, hint: '3:1' },
  { label: 'I lirë', value: undefined, hint: 'pa kufi' },
] as const;

export default function LogoCropper({
  imageSrc,
  open,
  saving = false,
  onCancel,
  onCropped,
}: Props) {
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [aspect, setAspect] = React.useState<number | undefined>(1);
  const [croppedArea, setCroppedArea] = React.useState<CropArea | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState(false);

  // A newly picked file must not inherit the previous image's framing.
  React.useEffect(() => {
    if (!imageSrc) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setAspect(1);
    setCroppedArea(null);
    setError(null);
  }, [imageSrc]);

  const onCropComplete = React.useCallback((_: unknown, areaPixels: CropArea) => {
    setCroppedArea(areaPixels);
  }, []);

  async function handleConfirm() {
    if (!imageSrc || !croppedArea) return;
    setWorking(true);
    setError(null);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedArea, rotation);
      await onCropped(blob);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setWorking(false);
    }
  }

  const busy = working || saving;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Rregullo logon</DialogTitle>
          <DialogDescription>
            Zhvendos dhe zmadho imazhin që logoja të dalë saktë në faturë.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {/* Checkerboard makes transparent logos readable while framing. */}
        <div
          className="relative h-72 w-full overflow-hidden rounded-lg bg-muted"
          style={{
            backgroundImage:
              'linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0,0 8px,8px -8px,-8px 0px',
          }}
        >
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              restrictPosition={false}
              showGrid={true}
            />
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Formati
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ASPECTS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setAspect(option.value)}
                  className={[
                    'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                    aspect === option.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-accent',
                  ].join(' ')}
                >
                  {option.label}{' '}
                  <span className="opacity-70">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label
              htmlFor="logo-zoom"
              className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground"
            >
              <ZoomIn className="h-3.5 w-3.5" /> Zmadhimi
            </Label>
            <Slider
              id="logo-zoom"
              min={1}
              max={4}
              step={0.01}
              value={[zoom]}
              onValueChange={([next]) => setZoom(next)}
              aria-label="Zmadhimi"
              className="mt-3"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Rrotullo
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
            >
              <RotateCcw />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRotation((r) => (r + 90) % 360)}
            >
              <RotateCw />
            </Button>
            <span className="text-sm text-muted-foreground">{rotation}°</span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Anulo
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={busy || !croppedArea}>
            {busy && <Loader2 className="animate-spin" />}
            Ruaj logon
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
