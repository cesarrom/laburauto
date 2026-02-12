interface SignedImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Component that automatically signs raw image URLs for display
 */
export default function SignedImage({ src, alt, className }: SignedImageProps) {
  // If it's already a full URL (https://...), use it as-is
  // Otherwise it's a raw path that needs signing via the backend
  const imageUrl = src.startsWith('http')
    ? src
    : `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/files${src}`;

  return <img src={imageUrl} alt={alt} className={className} />;
}
