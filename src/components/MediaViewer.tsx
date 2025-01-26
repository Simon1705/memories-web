'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/solid';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  media: {
    type: 'image' | 'video';
    src: string;
    title?: string;
    date?: string;
    slideDirection?: 'left' | 'right' | null;
  } | null;
}

export function MediaViewer({ isOpen, onClose, media }: MediaViewerProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Memoize handlers
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset loading state when media changes
  useEffect(() => {
    setIsLoading(true);
  }, [media?.src]);

  if (!media) return null;

  const { type, src, title, date, slideDirection } = media;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={onClose}
        >
          <motion.div
            initial={{ 
              opacity: 0,
              x: slideDirection === 'left' ? 50 : slideDirection === 'right' ? -50 : 0 
            }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ 
              opacity: 0,
              x: slideDirection === 'left' ? -50 : slideDirection === 'right' ? 50 : 0 
            }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-5xl mx-auto bg-transparent rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title and close button */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
              <div className="flex-1">
                {title && (
                  <h3 className="text-lg font-medium text-white/90 px-2">
                    {title}
                  </h3>
                )}
                {date && (
                  <p className="text-sm text-white/70 px-2">
                    {new Date(date).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm group"
              >
                <XMarkIcon className="w-5 h-5 text-white group-hover:text-white/90" />
              </button>
            </div>

            {/* Media content */}
            <div className="relative w-full">
              {type === 'image' ? (
                <div className="relative w-full" style={{ height: '80vh' }}>
                  <Image
                    src={src}
                    alt={title || 'Memory'}
                    fill
                    className={`object-contain transition-opacity duration-300 ${
                      isLoading ? 'opacity-0' : 'opacity-100'
                    }`}
                    onLoadingComplete={() => setIsLoading(false)}
                    priority
                    sizes="(max-width: 768px) 100vw, 80vw"
                  />
                </div>
              ) : (
                <div className="relative w-full" style={{ height: '80vh' }}>
                  <video
                    src={src}
                    className="w-full h-full object-contain"
                    controls
                    autoPlay
                    playsInline
                    onLoadedData={() => setIsLoading(false)}
                  />
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 