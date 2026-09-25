import Image, { type ImageProps } from 'next/image';

/** next/image wrapper: SVG placeholders are served as-is; photos go through the optimizer. */
export function SmartImage(props: ImageProps) {
  const src = typeof props.src === 'string' ? props.src : '';
  const unoptimized = src.endsWith('.svg') || props.unoptimized;
  return <Image {...props} unoptimized={unoptimized} alt={props.alt} />;
}
