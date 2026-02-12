import { useState } from 'react';
import api from '../lib/api';

interface UploadResult {
  urls: string[];
  success: boolean;
  error?: string;
}

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFiles = async (files: FileList | File[]): Promise<UploadResult> => {
    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      const fileArray = Array.from(files);

      fileArray.forEach(file => {
        formData.append('files', file);
      });

      const response = await api.post('/upload/multiple', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percentCompleted);
          }
        },
      });

      setProgress(100);

      return {
        urls: response.data.urls || [],
        success: response.data.success || false,
      };
    } catch (error) {
      console.error('Upload error:', error);
      return {
        urls: [],
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const uploadSingleFile = async (file: File): Promise<string | null> => {
    const result = await uploadFiles([file]);
    return result.success ? result.urls[0] : null;
  };

  return {
    uploadFiles,
    uploadSingleFile,
    uploading,
    progress,
  };
}
