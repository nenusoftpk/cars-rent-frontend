import Image from 'next/image';
import { cn, initials } from '@/lib/utils';

// next/image for files in /public, plain <img> for uploaded (data:) images.
export default function SmartImage({ src, alt = '', width = 80, height = 80, className, ...rest }) {
  if (!src) return <div className={cn('bg-slate-100', className)} style={{ width, height }} aria-hidden />;
  if (src.startsWith('/')) return <Image src={src} alt={alt} width={width} height={height} className={className} {...rest} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} {...rest} />;
}
export function Avatar({ src, name = '', size = 36, className }) {
  if (!src) return <span className={cn('inline-grid place-items-center rounded-full bg-primary/10 text-primary font-semibold shrink-0', className)} style={{ width: size, height: size, fontSize: size / 2.6 }}>{initials(name)}</span>;
  return <SmartImage src={src} alt={name} width={size} height={size} className={cn('rounded-full object-cover shrink-0', className)} style={{ width: size, height: size }} />;
}
