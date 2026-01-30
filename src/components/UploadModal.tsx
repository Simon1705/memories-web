'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, PhotoIcon, VideoCameraIcon, Square2StackIcon, Bars3Icon } from '@heroicons/react/24/solid';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  id: string;
}

// Sortable Photo Item Component
function SortablePhotoItem({ 
  file, 
  index, 
  onRemove 
}: { 
  file: FileWithTitle; 
  index: number; 
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className={`relative bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden ${isDragging ? 'shadow-xl ring-2 ring-purple-500' : ''}`}>
        <div className="relative group">
          <div className="relative w-full h-48">
            <Image
              src={file.file.preview || ''}
              alt={file.title}
              fill
              className="object-cover"
              loading="lazy"
              quality={75}
              sizes="(max-width: 640px) 100vw, 50vw"
            />
          </div>
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={onRemove}
              className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
          {/* Order badge */}
          <div className="absolute top-2 left-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
            <span className="text-xs text-white font-bold">{index + 1}</span>
          </div>
          {/* Cover badge */}
          {index === 0 && (
            <div className="absolute top-2 left-10 px-2 py-0.5 bg-purple-500 rounded text-xs text-white font-medium">
              Cover
            </div>
          )}
          {/* Drag handle */}
          <div 
            {...listeners}
            className="absolute bottom-2 left-2 p-1.5 bg-white/90 dark:bg-gray-800/90 rounded cursor-grab active:cursor-grabbing hover:bg-white dark:hover:bg-gray-700 transition-colors"
          >
            <Bars3Icon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </div>
        </div>
        <div className="p-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center truncate">
            {file.file.name}
          </p>
        </div>
      </div>
    </div>
  );
}

const generateVideoThumbnail = async (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    video.src = URL.createObjectURL(file);
    video.crossOrigin = 'anonymous';
    video.currentTime = 1; // Set to 1 second to avoid black frame
    
    video.onloadeddata = () => {
      try {
        canvas.width = Math.min(video.videoWidth, 800); // Limit thumbnail size
        canvas.height = Math.min(video.videoHeight, 600);
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to blob
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(video.src);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to generate thumbnail'));
          }
        }, 'image/jpeg', 0.7);
      } catch (error) {
        URL.revokeObjectURL(video.src);
        reject(error);
      }
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video'));
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
  const [isDragging, setIsDragging] = useState(false);
  const [isAlbumMode, setIsAlbumMode] = useState(false);
  const [albumTitle, setAlbumTitle] = useState('');
  const uploadStartTime = useRef<number>(0);
  const totalSize = useRef<number>(0);
  const uploadedSize = useRef<number>(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const processFiles = useCallback((selectedFiles: File[]) => {
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
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
    });
    setFiles(prev => [...prev, ...newFiles]);
  }, [files]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/') || file.type.startsWith('video/')
    );

    if (droppedFiles.length === 0) {
      setError('Please drop only image or video files.');
      return;
    }

    processFiles(droppedFiles);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    processFiles(selectedFiles);
  };

  const handleRemoveFile = useCallback((index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].file.preview) {
        URL.revokeObjectURL(newFiles[index].file.preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  }, []);

  const handleTitleChange = useCallback((index: number, newTitle: string) => {
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = { ...newFiles[index], title: newTitle };
      return newFiles;
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFiles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;
    if (isAlbumMode && !albumTitle.trim()) {
      setError('Please enter album title');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);
    uploadStartTime.current = Date.now();
    totalSize.current = files.reduce((acc, file) => acc + file.file.size, 0);
    uploadedSize.current = 0;

    try {
      // Album mode: upload all photos as one memory with album_photos
      if (isAlbumMode) {
        const imageFiles = files.filter(f => f.file.type.startsWith('image/'));
        if (imageFiles.length < 2) {
          setError('Album needs at least 2 photos');
          setIsUploading(false);
          return;
        }

        const albumPhotos: { src: string }[] = [];
        let coverSrc = '';

        for (let i = 0; i < imageFiles.length; i++) {
          const { file } = imageFiles[i];
          const fileExt = file.name.split('.').pop();
          const fileName = `${uuidv4()}.${fileExt}`;

          const { error: uploadError, data: urlData } = await supabase.storage
            .from('memories')
            .upload(fileName, file);

          if (uploadError) throw uploadError;
          if (!urlData?.path) throw new Error('Failed to get upload URL');

          const { data: publicUrlData } = supabase.storage
            .from('memories')
            .getPublicUrl(urlData.path);

          if (!publicUrlData?.publicUrl) throw new Error('Failed to get public URL');

          // First photo becomes cover
          if (i === 0) {
            coverSrc = publicUrlData.publicUrl;
          }
          albumPhotos.push({ src: publicUrlData.publicUrl });

          setUploadProgress(((i + 1) / imageFiles.length) * 100);
        }

        // Save album as single memory
        const { error: dbError } = await supabase
          .from('memories')
          .insert([{
            title: albumTitle,
            type: 'photo',
            src: coverSrc,
            thumbnail: null,
            date: new Date().toISOString(),
            album_photos: albumPhotos,
          }]);

        if (dbError) throw dbError;
      } else {
        // Normal mode: upload each file separately
        for (const fileWithTitle of files) {
          const { file, title } = fileWithTitle;

          const fileExt = file.name.split('.').pop();
          const fileName = `${uuidv4()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError, data: urlData } = await supabase.storage
            .from('memories')
            .upload(filePath, file);

          if (uploadError) throw uploadError;
          if (!urlData?.path) throw new Error('Failed to get upload URL');

          const { data: publicUrlData } = supabase.storage
            .from('memories')
            .getPublicUrl(urlData.path);

          if (!publicUrlData?.publicUrl) throw new Error('Failed to get public URL');

          let memoryData;
          if (file.type.startsWith('image/')) {
            memoryData = {
              title,
              type: 'photo',
              src: publicUrlData.publicUrl,
              thumbnail: null,
              date: new Date().toISOString(),
              album_photos: null,
            };
          } else {
            const thumbnailFileName = `thumbnail_${fileName}`;
            const thumbnailBlob = await generateVideoThumbnail(file);
            
            const { error: thumbnailError } = await supabase.storage
              .from('memories')
              .upload(thumbnailFileName, thumbnailBlob);

            if (thumbnailError) throw thumbnailError;

            const { data: thumbnailUrlData } = supabase.storage
              .from('memories')
              .getPublicUrl(thumbnailFileName);

            if (!thumbnailUrlData?.publicUrl) throw new Error('Failed to get thumbnail URL');

            memoryData = {
              title,
              type: 'video',
              src: filePath,
              thumbnail: thumbnailUrlData.publicUrl,
              date: new Date().toISOString(),
              album_photos: null,
            };
          }

          const { error: dbError } = await supabase
            .from('memories')
            .insert([memoryData]);

          if (dbError) throw dbError;

          const progress = ((files.indexOf(fileWithTitle) + 1) / files.length) * 100;
          setUploadProgress(progress);
        }
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
      setAlbumTitle('');
      setIsAlbumMode(false);
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
              {/* Album Mode Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-2 flex-wrap">
                  <Square2StackIcon className="w-5 h-5 text-purple-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Upload sebagai Album
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-full sm:w-auto">
                    (Gabungkan beberapa foto jadi 1 card)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAlbumMode(!isAlbumMode)}
                  className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                    isAlbumMode ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  aria-label={isAlbumMode ? 'Nonaktifkan mode album' : 'Aktifkan mode album'}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                      isAlbumMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Album Title Input */}
              {isAlbumMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Judul Album
                  </label>
                  <input
                    type="text"
                    value={albumTitle}
                    onChange={(e) => setAlbumTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Contoh: Foto di Pantai Kuta"
                    required={isAlbumMode}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-300 ${
                    isDragging 
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                      : files.length > 0 
                        ? 'border-purple-500' 
                        : 'border-gray-300 dark:border-gray-600'
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
                    <div className={`p-4 rounded-full ${
                      isDragging 
                        ? 'bg-purple-100 dark:bg-purple-900/40' 
                        : 'bg-purple-100 dark:bg-purple-900'
                    }`}>
                      {files.length > 0 ? (
                        <PhotoIcon className="w-8 h-8 text-purple-500" />
                      ) : (
                        <VideoCameraIcon className="w-8 h-8 text-purple-500" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {isDragging 
                          ? 'Drop your files here'
                          : files.length > 0
                            ? `Click or drag to add more files (${(files.reduce((acc, file) => acc + file.file.size, 0) / (1024 * 1024)).toFixed(1)}MB/15MB used)`
                            : 'Click to select or drag and drop photos/videos here'
                        }
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Maximum total size: 15MB
                      </p>
                    </div>
                  </label>
                </div>

                {files.length > 0 && isAlbumMode && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                      <Bars3Icon className="w-4 h-4" />
                      Drag foto untuk mengatur urutan
                    </p>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext items={files.map(f => f.id)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {files.map((file, index) => (
                            <SortablePhotoItem
                              key={file.id}
                              file={file}
                              index={index}
                              onRemove={() => handleRemoveFile(index)}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                )}

                {files.length > 0 && !isAlbumMode && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    {files.map((file, index) => (
                      <div
                        key={file.id}
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
                                loading="lazy"
                                quality={75}
                                sizes="(max-width: 640px) 100vw, 50vw"
                              />
                            </div>
                          ) : (
                            <video
                              src={file.file.preview}
                              className="w-full h-48 object-cover"
                              muted
                              preload="metadata"
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