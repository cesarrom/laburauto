
import { vi } from 'vitest';

export const uploadFile = vi.fn().mockResolvedValue({
  fileUrl: 'https://up.bytescale.com/raw/demo/test.jpg',
  filePath: '/raw/demo/test.jpg',
});

export const uploadMultipleFiles = vi.fn().mockResolvedValue([
  {
    fileUrl: 'https://up.bytescale.com/raw/demo/test1.jpg',
    filePath: '/raw/demo/test1.jpg',
  },
  {
    fileUrl: 'https://up.bytescale.com/raw/demo/test2.jpg',
    filePath: '/raw/demo/test2.jpg',
  },
]);

export const getSignedUrl = vi.fn().mockImplementation((url, transformations) => {
  if (!url) return '';
  return `${url}?token=signed_token_123&exp=1234567890`;
});
