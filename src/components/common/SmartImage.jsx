
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { cn, initials } from '@/lib/utils';

function getImageSource(src) {
  if (!src) return '';

  if (typeof src === 'string') {
    return src;
  }

  if (typeof src === 'object') {
    if (typeof src.url === 'string') return src.url;
    if (typeof src.secure_url === 'string') return src.secure_url;
    if (typeof src.src === 'string') return src.src;
  }

  return '';
}

export default function SmartImage({
  src,
  alt = '',
  width = 80,
  height = 80,
  className,
  ...rest
}) {
  const [preview, setPreview] = useState('');

  useEffect(() => {
    if (typeof File === 'undefined' || !(src instanceof File)) {
      return;
    }

    const url = URL.createObjectURL(src);
    setPreview(url);

    return () => {
      URL.revokeObjectURL(url);
      setPreview('');
    };
  }, [src]);

  const isFile =
    typeof File !== 'undefined' && src instanceof File;

  const imageSrc = isFile ? preview : getImageSource(src);

  if (!imageSrc) {
    return (
      <div
        className={cn('bg-slate-100', className)}
        style={{ width, height }}
        aria-hidden="true"
      />
    );
  }

  if (imageSrc.startsWith('/')) {
    return (
      <Image
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        className={className}
        {...rest}
      />
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      {...rest}
    />
  );
}

export function Avatar({
  src,
  name = '',
  size = 36,
  className,
}) {
  if (!src) {
    return (
      <span
        className={cn(
          'inline-grid place-items-center rounded-full bg-primary/10 text-primary font-semibold shrink-0',
          className
        )}
        style={{
          width: size,
          height: size,
          fontSize: size / 2.6,
        }}
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <SmartImage
      src={src}
      alt={name}
      width={size}
      height={size}
      className={cn(
        'rounded-full object-cover shrink-0',
        className
      )}
      style={{ width: size, height: size }}
    />
  );
}
