'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  media: {
    type: 'photo' | 'video';
    src: string;
    title: string;
    date?: string;
    slideDirection?: 'left' | 'right' | null;
  } | null;
  onNavigate?: (direction: 'left' | 'right') => void;
}

export function MediaViewer({ isOpen, onClose, media, onNavigate }: MediaViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen && media?.type === 'video' && videoRef.current) {
      const playVideo = async () => {
        try {
          videoRef.current!.currentTime = 0;
          await videoRef.current!.play();
          setError('');
        } catch (err) {
          console.error('Error playing video:', err);
          setError('Error playing video. Please try again.');
        }
      };

      playVideo();
    }
  }, [isOpen, media]);

  if (!media) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-5xl mx-auto bg-transparent rounded-lg overflow-hidden"
          >
            {media.type === 'photo' ? (
              <div className="relative w-full flex items-center justify-center">
                <div className="relative">
                  <motion.div
                    key={media.src}
                    initial={{ 
                      x: media.slideDirection === 'right' ? -100 : media.slideDirection === 'left' ? 100 : 0,
                      opacity: 0 
                    }}
                    animate={{ 
                      x: 0,
                      opacity: 1 
                    }}
                    exit={{ 
                      x: media.slideDirection === 'right' ? 100 : media.slideDirection === 'left' ? -100 : 0,
                      opacity: 0 
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30
                    }}
                  >
                    <Image
                      src={media.src}
                      alt={media.title}
                      width={1920}
                      height={1080}
                      className="w-auto h-auto max-h-[75vh] mx-auto object-contain rounded-lg"
                      style={{ maxWidth: '100%' }}
                    />
                  </motion.div>
                  {/* Navigation buttons */}
                  {onNavigate && (
                    <>
                      <div className="absolute inset-y-0 left-0 flex items-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('right');
                          }}
                          className="p-3 m-4 rounded-full bg-black/20 hover:bg-black/40 transition-colors backdrop-blur-sm group"
                        >
                          <ChevronLeftIcon className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                        </button>
                      </div>
                      <div className="absolute inset-y-0 right-0 flex items-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('left');
                          }}
                          className="p-3 m-4 rounded-full bg-black/20 hover:bg-black/40 transition-colors backdrop-blur-sm group"
                        >
                          <ChevronRightIcon className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                        </button>
                      </div>
                    </>
                  )}
                  {/* Close button at top right */}
                  <div className="absolute top-4 right-4">
                    <button
                      onClick={onClose}
                      className="p-1.5 rounded-full bg-black/20 hover:bg-black/40 transition-colors backdrop-blur-sm group"
                    >
                      <XMarkIcon className="w-5 h-5 text-white/90 group-hover:text-white" />
                    </button>
                  </div>
                  {/* Title and date at bottom left */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/80 to-transparent">
                    <h3 className="text-lg font-semibold text-white drop-shadow-lg mb-1">
                      {media.title}
                    </h3>
                    {media.date && (
                      <p className="text-sm text-white/90 drop-shadow-lg">
                        {new Date(media.date).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative w-full">
                <video
                  ref={videoRef}
                  src={media.src}
                  controls
                  playsInline
                  autoPlay
                  className="w-full h-auto max-h-[75vh] object-contain rounded-lg mx-auto"
                >
                  Your browser does not support the video tag.
                </video>
                {/* Close button at top right */}
                <div className="absolute top-4 right-4">
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-full bg-black/20 hover:bg-black/40 transition-colors backdrop-blur-sm group"
                  >
                    <XMarkIcon className="w-5 h-5 text-white/90 group-hover:text-white" />
                  </button>
                </div>
                {/* Title and date at bottom left */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/80 to-transparent">
                  <h3 className="text-lg font-semibold text-white drop-shadow-lg mb-1">
                    {media.title}
                  </h3>
                  {media.date && (
                    <p className="text-sm text-white/90 drop-shadow-lg">
                      {new Date(media.date).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  )}
                </div>
                {error && (
                  <div className="absolute bottom-24 left-0 right-0 text-center bg-red-500/80 text-white py-2 px-4">
                    {error}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 