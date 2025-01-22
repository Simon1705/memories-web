'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, PhotoIcon, VideoCameraIcon } from '@heroicons/react/24/solid';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

interface FileWithPreview extends File {
  preview?: string;
}

interface FileWithTitle {
  file: FileWithPreview;
  title: string;
}

const generateVideoThumbnail = async (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    video.src = URL.createObjectURL(file);
    video.crossOrigin = 'anonymous';
    video.currentTime = 1; // Set to 1 second to avoid black frame
    
    video.onloadeddata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          const thumbnailFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
          resolve(URL.createObjectURL(thumbnailFile));
        }
        URL.revokeObjectURL(video.src);
      }, 'image/jpeg', 0.7);
    };
  });
};

export function UploadModal({ isOpen, onClose, onUploadComplete }: UploadModalProps) {
  const [files, setFiles] = useState<FileWithTitle[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<string>('');
  const [remainingSize, setRemainingSize] = useState<string>('');
  const uploadStartTime = useRef<number>(0);
  const totalSize = useRef<number>(0);
  const uploadedSize = useRef<number>(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    // Calculate total size including existing files
    const MAX_TOTAL_SIZE = 15 * 1024 * 1024; // 15MB in bytes
    const existingTotalSize = files.reduce((acc, file) => acc + file.file.size, 0);
    const newTotalSize = selectedFiles.reduce((acc, file) => acc + file.size, 0) + existingTotalSize;

    if (newTotalSize > MAX_TOTAL_SIZE) {
      setError(`Total file size exceeds 15MB limit. Please remove some files.`);
      return;
    }

    const newFiles: FileWithTitle[] = selectedFiles.map(file => {
      const preview = URL.createObjectURL(file);
      const fileWithPreview = Object.assign(file, { preview });
      return {
        file: fileWithPreview,
        title: file.name.split('.')[0],
      };
    });
    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].file.preview) {
        URL.revokeObjectURL(newFiles[index].file.preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleTitleChange = (index: number, newTitle: string) => {
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = { ...newFiles[index], title: newTitle };
      return newFiles;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);
    uploadStartTime.current = Date.now();
    totalSize.current = files.reduce((acc, file) => acc + file.file.size, 0);
    uploadedSize.current = 0;

    try {
      for (const fileWithTitle of files) {
        const { file, title } = fileWithTitle;
        console.log('Uploading file:', { type: file.type, title, fileType: file.type });

        const fileExt = file.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `${fileName}`;

        // Upload the file to Supabase Storage
        const { error: uploadError, data: urlData } = await supabase.storage
          .from('memories')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        if (!urlData?.path) {
          throw new Error('Failed to get upload URL');
        }

        // Get the public URL
        const { data: publicUrlData } = supabase.storage
          .from('memories')
          .getPublicUrl(urlData.path);

        if (!publicUrlData?.publicUrl) {
          throw new Error('Failed to get public URL');
        }

        let memoryData;
        if (file.type.startsWith('image/')) {
          memoryData = {
            title,
            type: 'photo',
            src: publicUrlData.publicUrl,
            thumbnail: null,
            date: new Date().toISOString(),
          };
        } else {
          // For videos, create a thumbnail
          const thumbnailFileName = `thumbnail_${fileName}`;
          const thumbnailBlob = await generateVideoThumbnail(file);
          
          const { error: thumbnailError } = await supabase.storage
            .from('memories')
            .upload(thumbnailFileName, thumbnailBlob);

          if (thumbnailError) throw thumbnailError;

          const { data: thumbnailUrlData } = supabase.storage
            .from('memories')
            .getPublicUrl(thumbnailFileName);

          if (!thumbnailUrlData?.publicUrl) {
            throw new Error('Failed to get thumbnail URL');
          }

          memoryData = {
            title,
            type: 'video',
            src: filePath,
            thumbnail: thumbnailUrlData.publicUrl,
            date: new Date().toISOString(),
          };
        }

        // Save the memory data to the database
        const { error: dbError } = await supabase
          .from('memories')
          .insert([memoryData]);

        if (dbError) throw dbError;

        // Update progress
        const progress = ((files.indexOf(fileWithTitle) + 1) / files.length) * 100;
        setUploadProgress(progress);
      }

      // Clean up previews
      files.forEach(file => {
        if (file.file.preview) {
          URL.revokeObjectURL(file.file.preview);
        }
      });
      
      onUploadComplete();
      onClose();
      setFiles([]);
    } catch (error) {
      console.error('Upload error:', error);
      setError('Error uploading files. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadSpeed('');
      setRemainingSize('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Add Memories</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center ${
                    files.length > 0 ? 'border-purple-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                    multiple
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center space-y-2"
                  >
                    <div className="p-4 rounded-full bg-purple-100 dark:bg-purple-900">
                      {files.length > 0 ? (
                        <PhotoIcon className="w-8 h-8 text-purple-500" />
                      ) : (
                        <VideoCameraIcon className="w-8 h-8 text-purple-500" />
                      )}
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {files.length > 0
                        ? `Click to add more files (${(files.reduce((acc, file) => acc + file.file.size, 0) / (1024 * 1024)).toFixed(1)}MB/15MB used)`
                        : 'Click to select photos and videos (max 15MB total)'}
                    </span>
                  </label>
                </div>

                {files.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="relative bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden"
                      >
                        <div className="relative group">
                          {file.file.type.startsWith('image/') ? (
                            <div className="relative w-full h-48">
                              <Image
                                src={file.file.preview || ''}
                                alt={file.title}
                                fill
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <video
                              src={file.file.preview}
                              className="w-full h-48 object-cover"
                            />
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(index)}
                              className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="p-3">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Title for {file.file.type.startsWith('image/') ? 'Photo' : 'Video'} {index + 1}
                          </label>
                          <input
                            type="text"
                            value={file.title}
                            onChange={(e) => handleTitleChange(index, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-2"
                            placeholder="Enter title"
                            required
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              {isUploading && (
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex space-x-4">
                      <span>Progress: {Math.round(uploadProgress)}%</span>
                      {uploadSpeed && <span>Speed: {uploadSpeed}</span>}
                    </div>
                    {remainingSize && (
                      <span>Remaining: {remainingSize}</span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || files.length === 0}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center space-x-2"
                >
                  {isUploading ? (
                    <>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <span>Upload {files.length > 0 ? `(${files.length})` : ''}</span>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 