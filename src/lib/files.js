export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const DOC_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_MB = 3;

export function validateFile(file, { types = DOC_TYPES, maxMB = MAX_MB } = {}) {
  if (!types.includes(file.type)) return `Only ${types.map((t) => t.split('/')[1].toUpperCase()).join(', ')} files are allowed.`;
  if (file.size > maxMB * 1024 * 1024) return `File is too large. Maximum size is ${maxMB} MB.`;
  return null;
}

const toDataUrl = (file, onProgress) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
  r.onload = () => res(r.result);
  r.onerror = () => rej(new Error('Could not read the file.'));
  r.readAsDataURL(file);
});

// Images are shrunk so the demo database (browser storage) stays small.
async function shrink(dataUrl, max = 700) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => res(dataUrl);
    img.src = dataUrl;
  });
}

export async function readUpload(file, { onProgress, types, maxMB } = {}) {
  const err = validateFile(file, { types, maxMB });
  if (err) throw new Error(err);
  let url = await toDataUrl(file, onProgress);
  if (file.type.startsWith('image/')) url = await shrink(url);
  onProgress?.(100);
  return { name: file.name, mime: file.type === 'application/pdf' ? file.type : 'image/jpeg', size: file.size, url };
}
export const isImageUrl = (u = '') => u.startsWith('data:image') || /\.(svg|png|jpe?g|webp)$/i.test(u);
export function downloadUrl(url, name = 'download') {
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
