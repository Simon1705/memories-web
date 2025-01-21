'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, PhotoIcon, VideoCameraIcon } from '@heroicons/react/24/solid';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

interface FilePreview {
  file: File;
  preview: string;
  type: 'photo' | 'video';
  title: string;
  tags: string[];
}

interface UploadProgress {
  loaded: number;
  total: number;
}

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

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

const uploadInChunks = async (
  file: File,
  onProgress: (progress: number) => void
): Promise<string> => {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const fileName = `${uuidv4()}.${file.name.split('.').pop()}`;
  let uploadedChunks = 0;

  for (let start = 0; start < file.size; start += CHUNK_SIZE) {
    const chunk = file.slice(start, start + CHUNK_SIZE);
    const chunkName = `${fileName}_${uploadedChunks}`;

    // Upload chunk
    const { error: uploadError } = await supabase.storage
      .from('memories')
      .upload(chunkName, chunk, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;
    
    uploadedChunks++;
    const progress = (uploadedChunks / totalChunks) * 100;
    onProgress(progress);
  }

  // Combine chunks (in real implementation, you might need a server-side function for this)
  // For now, we'll just use the first chunk as the final file
  const finalFileName = fileName;
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('memories')
    .getPublicUrl(finalFileName);

  return publicUrl;
};

export function UploadModal({ isOpen, onClose, onUploadComplete }: UploadModalProps) {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState<string>('');
  const [remainingSize, setRemainingSize] = useState<string>('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const uploadStartTime = useRef<number>(0);
  const totalSize = useRef<number>(0);
  const uploadedSize = useRef<number>(0);

  useEffect(() => {
    // Fetch existing tags from the database
    const fetchTags = async () => {
      const { data, error } = await supabase
        .from('memories')
        .select('tags');
      
      if (!error && data) {
        const allTags = data.flatMap(item => item.tags || []);
        const uniqueTags = [...new Set(allTags)];
        setAvailableTags(uniqueTags);
      }
    };
    
    fetchTags();
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const calculateSpeed = (uploadedBytes: number, elapsedTime: number): string => {
    const speed = uploadedBytes / (elapsedTime / 1000); // bytes per second
    return formatBytes(speed) + '/s';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles: FilePreview[] = selectedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('image/') ? 'photo' : 'video',
      title: file.name.split('.')[0],
      tags: [],
    }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const updateFileTitle = (index: number, title: string) => {
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = { ...newFiles[index], title };
      return newFiles;
    });
  };

  const updateFileTags = (index: number, tags: string[]) => {
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = { ...newFiles[index], tags };
      return newFiles;
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Please select files to upload');
      return;
    }

    // Validate all titles
    const emptyTitles = files.some(file => !file.title.trim());
    if (emptyTitles) {
      setError('Please enter titles for all files');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress(0);
    uploadStartTime.current = Date.now();
    totalSize.current = files.reduce((acc, file) => acc + file.file.size, 0);
    uploadedSize.current = 0;

    try {
      for (const filePreview of files) {
        const { file, type, title, tags } = filePreview;
        console.log('Uploading file:', { type, title, fileType: file.type });

        const fileExt = file.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `${fileName}`;

        // Upload file to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('memories')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('memories')
          .getPublicUrl(filePath);

        if (!urlData?.publicUrl) {
          throw new Error('Failed to get public URL');
        }

        let memoryData;
        if (type === 'photo') {
          memoryData = {
            title,
            type,
            src: urlData.publicUrl,
            thumbnail: null,
            date: new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString(),
            tags: tags,
          };
        } else {
          // For videos, generate and upload thumbnail
          const thumbnailDataUrl = await generateVideoThumbnail(file);
          const thumbnailBlob = await fetch(thumbnailDataUrl).then(r => r.blob());
          const thumbnailFileName = `${uuidv4()}_thumb.jpg`;
          
          // Upload thumbnail
          const { error: thumbnailError } = await supabase.storage
            .from('memories')
            .upload(thumbnailFileName, thumbnailBlob, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: false,
            });

          if (thumbnailError) throw thumbnailError;

          // Get thumbnail URL
          const { data: thumbnailUrlData } = supabase.storage
            .from('memories')
            .getPublicUrl(thumbnailFileName);

          if (!thumbnailUrlData?.publicUrl) {
            throw new Error('Failed to get thumbnail URL');
          }

          // Get video duration
          const video = document.createElement('video');
          video.src = URL.createObjectURL(file);
          
          await new Promise((resolve) => {
            video.onloadedmetadata = () => {
              resolve(null);
            };
          });

          const duration = video.duration;
          const minutes = Math.floor(duration / 60);
          const seconds = Math.floor(duration % 60);
          const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

          memoryData = {
            title,
            type,
            src: filePath, // Store just the path, not the full URL
            thumbnail: thumbnailUrlData.publicUrl,
            duration: formattedDuration,
            date: new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString(),
            tags: tags,
          };

          // Clean up
          URL.revokeObjectURL(video.src);
          URL.revokeObjectURL(thumbnailDataUrl);
        }

        // Save memory data to database
        const { error: dbError } = await supabase
          .from('memories')
          .insert([memoryData]);

        if (dbError) {
          console.error('Database error:', dbError);
          throw dbError;
        }
      }

      // Clean up previews
      files.forEach(file => URL.revokeObjectURL(file.preview));
      
      onUploadComplete();
      onClose();
      setFiles([]);
      setUploadProgress(0);
    } catch (err) {
      console.error('Error uploading files:', err);
      setError('Error uploading files. Please try again.');
    } finally {
      setUploading(false);
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

            <form onSubmit={handleUpload} className="space-y-4">
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
                        ? 'Click to add more files'
                        : 'Click to select photos and videos'}
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
                          {file.type === 'photo' ? (
                            <img
                              src={file.preview}
                              alt={file.title}
                              className="w-full h-48 object-cover"
                            />
                          ) : (
                            <video
                              src={file.preview}
                              className="w-full h-48 object-cover"
                            />
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="p-3">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Title for {file.type === 'photo' ? 'Photo' : 'Video'} {index + 1}
                          </label>
                          <input
                            type="text"
                            value={file.title}
                            onChange={(e) => updateFileTitle(index, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-2"
                            placeholder="Enter title"
                            required
                          />
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Tags
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {availableTags.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  const currentTags = files[index].tags;
                                  const newTags = currentTags.includes(tag)
                                    ? currentTags.filter(t => t !== tag)
                                    : [...currentTags, tag];
                                  updateFileTags(index, newTags);
                                }}
                                className={`px-2 py-1 rounded-full text-sm ${
                                  files[index].tags.includes(tag)
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                                }`}
                              >
                                {tag}
                              </button>
                            ))}
                            <input
                              type="text"
                              placeholder="Add new tag"
                              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-full text-sm"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const newTag = e.currentTarget.value.trim();
                                  if (newTag && !files[index].tags.includes(newTag)) {
                                    updateFileTags(index, [...files[index].tags, newTag]);
                                    setAvailableTags(prev => [...new Set([...prev, newTag])]);
                                    e.currentTarget.value = '';
                                  }
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              {uploading && (
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
                  disabled={uploading || files.length === 0}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center space-x-2"
                >
                  {uploading ? (
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