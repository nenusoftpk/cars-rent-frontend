
/**
 * SecuGen Hamster Pro 20 - WebAPI fingerprint capture
 * Local SecuGen service: https://localhost:8443
 */

const SECUGEN_URL = 'https://localhost:8443/SGIFPCapture';

const MAX_IMAGE_SIZE = 1024 * 1024; // 1 MB

function base64ToFile(base64, mimeType, filename) {
  const pure = base64.replace(/^data:[^;]+;base64,/, '');
  const binary = atob(pure);

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], filename, { type: mimeType });
}

function detectImageType(base64) {
  const pure = base64.replace(/^data:[^;]+;base64,/, '');

  if (pure.startsWith('iVBOR')) {
    return { mime: 'image/png', ext: 'png' };
  }

  if (pure.startsWith('/9j/')) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  if (pure.startsWith('Qk')) {
    return { mime: 'image/bmp', ext: 'bmp' };
  }

  throw new Error(
    'Unsupported fingerprint image format returned by SecuGen.'
  );
}

export async function captureSecuGenThumb() {
  let response;

  try {
    response = await fetch(SECUGEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Timeout: 10000,
        Quality: 50,
        Licstr: '',
        TemplateFormat: 'ISO',
      }),
    });
  } catch (error) {
    throw new Error(
      'Cannot connect to SecuGen WebAPI on port 8443. ' +
      'Check the service, HTTPS certificate and browser access.'
    );
  }

  if (!response.ok) {
    throw new Error(
      `SecuGen HTTP error: ${response.status}`
    );
  }

  const data = await response.json();

  console.log('SecuGen response status:', {
    ErrorCode: data.ErrorCode,
    Quality: data.Quality,
    HasImage: Boolean(
      data.BMPBase64 ||
      data.ImageDataBase64 ||
      data.imageDataBase64
    ),
  });

  const errorCode = Number(data.ErrorCode ?? 0);

  if (errorCode !== 0) {
    throw new Error(
      `SecuGen capture failed. Error code: ${errorCode}`
    );
  }

  const base64 =
    data.BMPBase64 ||
    data.ImageDataBase64 ||
    data.imageDataBase64 ||
    data.image;

  if (typeof base64 !== 'string' || !base64.trim()) {
    throw new Error(
      'Fingerprint captured but SecuGen returned no image.'
    );
  }

  const imageType = detectImageType(base64);

  // Convert BMP to PNG because the CarsRent backend
  // accepts PNG/JPEG images.
  let file;

  if (imageType.mime === 'image/bmp') {
    const bmpBlob = base64ToFile(
      base64,
      'image/bmp',
      'fingerprint.bmp'
    );

    const bitmap = await createImageBitmap(bmpBlob);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Cannot create fingerprint image.');
      }

      context.drawImage(bitmap, 0, 0);

      const pngBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('BMP to PNG conversion failed.'));
          },
          'image/png'
        );
      });

      file = new File(
        [pngBlob],
        `thumb-${Date.now()}.png`,
        { type: 'image/png' }
      );
    } finally {
      bitmap.close();
    }
  } else {
    file = base64ToFile(
      base64,
      imageType.mime,
      `thumb-${Date.now()}.${imageType.ext}`
    );
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(
      'Fingerprint image is larger than 1 MB. Please rescan.'
    );
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(
      new Error('Cannot read fingerprint image.')
    );

    reader.readAsDataURL(file);
  });

  return {
    file,
    dataUrl,
    quality: Number(data.Quality ?? 0),
  };
}

/**
 * Check whether the SecuGen WebAPI is reachable.
 * A JSON error response can still mean the service is alive.
 */
export async function checkSecuGenAvailable() {
  try {
    const response = await fetch(SECUGEN_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });

    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}
