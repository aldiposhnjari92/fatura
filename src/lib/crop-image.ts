/**
 * Canvas-based cropping for the business logo. Entirely client-side, like the
 * PDF — the browser produces the final bytes and only those get uploaded.
 */

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Longest edge of the stored logo. Plenty for a 38mm-wide PDF header. */
const MAX_OUTPUT_EDGE = 800;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('Imazhi nuk u lexua dot.')));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = src;
  });
}

/**
 * Crops `imageSrc` to `cropArea` (in source-pixel coordinates, as react-easy-crop
 * reports it), applying `rotation` in degrees first.
 *
 * Always emits PNG: logos are usually flat colour or have transparency, and JPEG
 * would both fringe the edges and paint a black background behind alpha.
 */
export async function getCroppedImageBlob(
  imageSrc: string,
  cropArea: CropArea,
  rotation = 0
): Promise<Blob> {
  const image = await loadImage(imageSrc);

  // Step 1 — draw the whole image rotated onto a canvas big enough to hold it.
  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const boxW = image.width * cos + image.height * sin;
  const boxH = image.width * sin + image.height * cos;

  const rotatedCanvas = document.createElement('canvas');
  rotatedCanvas.width = Math.ceil(boxW);
  rotatedCanvas.height = Math.ceil(boxH);
  const rotatedCtx = rotatedCanvas.getContext('2d');
  if (!rotatedCtx) throw new Error('Canvas nuk u inicializua.');

  rotatedCtx.imageSmoothingQuality = 'high';
  rotatedCtx.translate(boxW / 2, boxH / 2);
  rotatedCtx.rotate(radians);
  rotatedCtx.drawImage(image, -image.width / 2, -image.height / 2);

  // Step 2 — cut the selected rectangle out of the rotated bitmap.
  const cropW = Math.max(1, Math.round(cropArea.width));
  const cropH = Math.max(1, Math.round(cropArea.height));

  // Downscale in the same pass when the crop is larger than we need to store.
  const scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(cropW, cropH));
  const outW = Math.max(1, Math.round(cropW * scale));
  const outH = Math.max(1, Math.round(cropH * scale));

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) throw new Error('Canvas nuk u inicializua.');

  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(
    rotatedCanvas,
    Math.round(cropArea.x),
    Math.round(cropArea.y),
    cropW,
    cropH,
    0,
    0,
    outW,
    outH
  );

  return new Promise((resolve, reject) => {
    outCanvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Prerja e imazhit dështoi.')),
      'image/png'
    );
  });
}
