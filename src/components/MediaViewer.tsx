'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/solid';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  media: {
    type: 'photo' | 'video';
    src: string;
    title: string;
  } | null;
}

export function MediaViewer({ isOpen, onClose, media }: MediaViewerProps) {
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
            className="relative max-w-7xl w-full bg-transparent rounded-lg overflow-hidden"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors z-10"
            >
              <XMarkIcon className="w-6 h-6 text-white" />
            </button>

            <div className="relative">
              {media.type === 'photo' ? (
                <div className="relative w-full max-h-[90vh]">
                  <Image
                    src={media.src}
                    alt={media.title}
                    width={1920}
                    height={1080}
                    className="w-full h-auto object-contain"
                  />
                </div>
              ) : (
                <div className="relative">
                  <video
                    ref={videoRef}
                    src={media.src}
                    controls
                    playsInline
                    autoPlay
                    className="w-full max-h-[90vh] object-contain"
                  >
                    Your browser does not support the video tag.
                  </video>
                  {error && (
                    <div className="absolute bottom-16 left-0 right-0 text-center bg-red-500/80 text-white py-2 px-4">
                      {error}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
              <h3 className="text-xl font-semibold text-white">
                {media.title}
              </h3>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 