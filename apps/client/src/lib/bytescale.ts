export function getSignedUrl(path: string): string {
  // If it's already a full URL, return as-is
  if (path.startsWith('http')) {
    return path;
  }

  // For raw paths, append signing query params
  // In production, you'd call an API endpoint to get a signed URL
  // For now, assume all paths can be accessed directly via the API
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Construct signed URL with expiration
  // The backend's /api/files/:path endpoint handles signing
  return `${baseUrl}/api/files${path}`;
}
