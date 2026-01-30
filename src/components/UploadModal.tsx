'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, PhotoIcon, VideoCameraIcon, Square2StackIcon, Bars3Icon, CloudArrowUpIcon, CheckCircleIcon, SparklesIcon } from '@heroicons/react/24/solid';
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
      <div className={`relative bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden border-2 transition-all ${isDragging ? 'shadow-2xl ring-2 ring-purple-500 border-purple-500' : 'border-gray-200 dark:border-gray-700'}`}>
        <div className="relative group">
          <div className="relative w-full aspect-square">
            <Image
              src={file.file.preview || ''}
              alt={file.title}
              fill
              className="object-cover"
              loading="lazy"
              quality={75}
              sizes="(max-width: 640px) 50vw, 33vw"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
          {/* Order badge */}
          <div className="absolute top-2 left-2 w-7 h-7 bg-purple-500 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-xs text-white font-bold">{index + 1}</span>
          </div>
          {/* Cover badge */}
          {index === 0 && (
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-xs text-white font-medium shadow-lg flex items-center gap-1">
              <SparklesIcon className="w-3 h-3" />
              Cover
            </div>
          )}
          {/* Drag handle */}
          <div 
            {...listeners}
            className="absolute bottom-2 right-2 p-2 bg-white/90 dark:bg-gray-800/90 rounded-lg cursor-grab active:cursor-grabbing hover:bg-white dark:hover:bg-gray-700 transition-colors shadow-lg"
          >
            <Bars3Icon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </div>
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

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      // Store scroll position
      const scrollY = window.scrollY;
      
      // Disable scroll on body and html
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      // Stop Lenis if it exists
      const lenisInstance = (window as unknown as { lenis?: { stop: () => void; start: () => void } }).lenis;
      if (lenisInstance) {
        lenisInstance.stop();
      }
      
      return () => {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        
        // Restart Lenis
        if (lenisInstance) {
          lenisInstance.start();
        }
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

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

  // Handle wheel event to prevent propagation
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-24 p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
          onClick={onClose}
          onWheel={handleWheel}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-h-[calc(100vh-6rem)] overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col mb-4"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800 p-5">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <CloudArrowUpIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Tambah Kenangan Baru</h2>
                  <p className="text-white/70 text-sm">Bagikan momen spesial Anda</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto overscroll-contain" style={{ maxHeight: 'calc(100vh - 10rem)' }}>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Upload Type Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setIsAlbumMode(false)}
                    className={`relative p-5 rounded-2xl transition-all duration-300 text-left ${
                      !isAlbumMode 
                        ? 'bg-purple-600 ring-2 ring-purple-400 ring-offset-2 ring-offset-gray-900' 
                        : 'bg-gray-800 hover:bg-gray-750'
                    }`}
                  >
                    {!isAlbumMode && (
                      <div className="absolute top-3 right-3">
                        <div className="w-5 h-5 bg-purple-400 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-purple-900" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                      !isAlbumMode ? 'bg-purple-500' : 'bg-gray-700'
                    }`}>
                      <PhotoIcon className={`w-6 h-6 ${!isAlbumMode ? 'text-white' : 'text-gray-400'}`} />
                    </div>
                    <h3 className={`font-semibold text-base ${!isAlbumMode ? 'text-white' : 'text-gray-200'}`}>
                      File Terpisah
                    </h3>
                    <p className={`text-sm mt-1 ${!isAlbumMode ? 'text-purple-200' : 'text-gray-500'}`}>
                      Upload foto/video satu per satu
                    </p>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setIsAlbumMode(true)}
                    className={`relative p-5 rounded-2xl transition-all duration-300 text-left ${
                      isAlbumMode 
                        ? 'bg-purple-600 ring-2 ring-purple-400 ring-offset-2 ring-offset-gray-900' 
                        : 'bg-gray-800 hover:bg-gray-750'
                    }`}
                  >
                    {isAlbumMode && (
                      <div className="absolute top-3 right-3">
                        <div className="w-5 h-5 bg-purple-400 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-purple-900" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                      isAlbumMode ? 'bg-purple-500' : 'bg-gray-700'
                    }`}>
                      <Square2StackIcon className={`w-6 h-6 ${isAlbumMode ? 'text-white' : 'text-gray-400'}`} />
                    </div>
                    <h3 className={`font-semibold text-base ${isAlbumMode ? 'text-white' : 'text-gray-200'}`}>
                      Album
                    </h3>
                    <p className={`text-sm mt-1 ${isAlbumMode ? 'text-purple-200' : 'text-gray-500'}`}>
                      Gabungkan foto jadi 1 album
                    </p>
                  </button>
                </div>

                {/* Album Title Input */}
                <AnimatePresence>
                  {isAlbumMode && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Judul Album
                      </label>
                      <input
                        type="text"
                        value={albumTitle}
                        onChange={(e) => setAlbumTitle(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none"
                        placeholder="Contoh: Liburan di Bali 2024"
                        required={isAlbumMode}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Drag & Drop Area */}
                <div
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
                    isDragging 
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 scale-[1.02]' 
                      : files.length > 0 
                        ? 'border-purple-400 bg-purple-50/50 dark:bg-purple-900/10' 
                        : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10'
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
                    className="cursor-pointer flex flex-col items-center space-y-3"
                  >
                    <motion.div 
                      className={`p-5 rounded-2xl ${
                        isDragging 
                          ? 'bg-purple-500' 
                          : 'bg-gradient-to-br from-purple-500 to-pink-500'
                      }`}
                      animate={isDragging ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 0.5, repeat: isDragging ? Infinity : 0 }}
                    >
                      <CloudArrowUpIcon className="w-10 h-10 text-white" />
                    </motion.div>
                    <div className="space-y-1">
                      <p className="text-base font-medium text-gray-700 dark:text-gray-200">
                        {isDragging 
                          ? 'Lepaskan file di sini!'
                          : files.length > 0
                            ? 'Klik atau drag untuk menambah file'
                            : 'Klik untuk pilih atau drag file ke sini'
                        }
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Mendukung foto dan video • Maks 15MB total
                      </p>
                      {files.length > 0 && (
                        <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/40 rounded-full">
                          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                            {files.length} file dipilih
                          </span>
                          <span className="text-xs text-purple-500 dark:text-purple-400">
                            ({(files.reduce((acc, file) => acc + file.file.size, 0) / (1024 * 1024)).toFixed(1)} MB)
                          </span>
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                {/* Album Mode File List */}
                {files.length > 0 && isAlbumMode && (
                  <motion.div 
                    className="mt-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-center gap-2 mb-3 text-sm text-gray-600 dark:text-gray-400">
                      <Bars3Icon className="w-4 h-4" />
                      <span>Drag foto untuk mengatur urutan • Foto pertama jadi cover</span>
                    </div>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext items={files.map(f => f.id)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                  </motion.div>
                )}

                {/* Normal Mode File List */}
                {files.length > 0 && !isAlbumMode && (
                  <motion.div 
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {files.map((file, index) => (
                      <motion.div
                        key={file.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative bg-gray-50 dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700"
                      >
                        <div className="relative group">
                          {file.file.type.startsWith('image/') ? (
                            <div className="relative w-full h-40">
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
                            <div className="relative w-full h-40">
                              <video
                                src={file.file.preview}
                                className="w-full h-full object-cover"
                                muted
                                preload="metadata"
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="p-3 bg-black/50 rounded-full">
                                  <VideoCameraIcon className="w-6 h-6 text-white" />
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(index)}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                          {/* File type badge */}
                          <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 rounded-full text-xs text-white flex items-center gap-1">
                            {file.file.type.startsWith('image/') ? (
                              <><PhotoIcon className="w-3 h-3" /> Foto</>
                            ) : (
                              <><VideoCameraIcon className="w-3 h-3" /> Video</>
                            )}
                          </div>
                        </div>
                        <div className="p-3">
                          <input
                            type="text"
                            value={file.title}
                            onChange={(e) => handleTitleChange(index, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none"
                            placeholder="Judul kenangan..."
                            required
                          />
                          <p className="text-xs text-gray-400 mt-1.5 truncate">
                            {file.file.name} • {(file.file.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
                >
                  <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                    <XMarkIcon className="w-5 h-5" />
                    {error}
                  </p>
                </motion.div>
              )}

              {/* Upload Progress */}
              {isUploading && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                      Mengupload kenangan...
                    </span>
                    <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {Math.round(uploadProgress)}%
                    </span>
                  </div>
                  <div className="w-full bg-purple-200 dark:bg-purple-900 rounded-full h-3 overflow-hidden">
                    <motion.div
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  {uploadSpeed && (
                    <div className="flex justify-between text-xs text-purple-600 dark:text-purple-400 mt-2">
                      <span>Kecepatan: {uploadSpeed}</span>
                      {remainingSize && <span>Sisa: {remainingSize}</span>}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploading || files.length === 0}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25"
                >
                  {isUploading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Mengupload...</span>
                    </>
                  ) : (
                    <>
                      <CloudArrowUpIcon className="w-5 h-5" />
                      <span>Upload {files.length > 0 ? `(${files.length} file)` : ''}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 