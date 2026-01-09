// src/components/MediaViewer.tsx

import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import Image from 'next/image';
import { useEffect, useRef, useState, useCallback } from 'react';

interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  media: {
    type: 'photo' | 'video';
    src: string;
    title: string;
    date?: string;
    slideDirection?: 'left' | 'right' | null;
    album_photos?: { src: string }[] | null;
  } | null;
  onNavigate?: (direction: 'left' | 'right') => void;
}

export function MediaViewer({ isOpen, onClose, media, onNavigate }: MediaViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>('');
  const [albumIndex, setAlbumIndex] = useState(0);
  const [isImageLoading, setIsImageLoading] = useState(true);

  useEffect(() => {
    setAlbumIndex(0);
    setIsImageLoading(true);
  }, [media?.src]);

  useEffect(() => {
    setIsImageLoading(true);
  }, [albumIndex]);

  const isAlbum = media?.album_photos && media.album_photos.length > 1;
  const currentAlbumSrc = isAlbum ? media.album_photos![albumIndex].src : media?.src;

  const handleAlbumNavigate = (direction: 'prev' | 'next') => {
    if (!isAlbum || !media) return;
    const total = media.album_photos!.length;
    if (direction === 'prev') {
      setAlbumIndex((prev) => (prev - 1 + total) % total);
    } else {
      setAlbumIndex((prev) => (prev + 1) % total);
    }
  };

  const playVideo = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      videoRef.current.currentTime = 0;
      await videoRef.current.play();
      setError('');
    } catch (err) {
      console.error('Error playing video:', err);
      setError('Error playing video. Please try again.');
    }
  }, []);

  useEffect(() => {
    if (isOpen && media?.type === 'video') {
      playVideo();
    }
  }, [isOpen, media, playVideo]);

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
            className="relative w-full max-w-5xl mx-auto"
          >
            {media.type === 'photo' ? (
              <div className="relative w-full h-[75vh] flex items-center justify-center">
                {isImageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}

                <motion.div
                  key={currentAlbumSrc}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isImageLoading ? 0 : 1 }}
                  transition={{ duration: 0.3 }}
                  className="relative max-h-full"
                >
                  <Image
                    src={currentAlbumSrc || ''}
                    alt={media.title}
                    width={1920}
                    height={1080}
                    className="w-auto h-auto max-h-[75vh] mx-auto object-contain rounded-lg"
                    style={{ maxWidth: '100%' }}
                    quality={85}
                    priority
                    sizes="100vw"
                    onLoad={() => setIsImageLoading(false)}
                  />
                </motion.div>

                {isAlbum && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAlbumNavigate('prev');
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-sm group z-30"
                    >
                      <ChevronLeftIcon className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAlbumNavigate('next');
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-sm group z-30"
                    >
                      <ChevronRightIcon className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                    </button>
                    <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-2 z-30">
                      {media.album_photos!.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setAlbumIndex(idx);
                          }}
                          className={`w-2.5 h-2.5 rounded-full transition-all ${
                            idx === albumIndex ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/75'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 rounded-full z-30">
                      <span className="text-sm text-white font-medium">
                        {albumIndex + 1} / {media.album_photos!.length}
                      </span>
                    </div>
                  </>
                )}

                {!isAlbum && onNavigate && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsImageLoading(true);
                        onNavigate('right');
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-sm group z-30"
                    >
                      <ChevronLeftIcon className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsImageLoading(true);
                        onNavigate('left');
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-sm group z-30"
                    >
                      <ChevronRightIcon className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                    </button>
                  </>
                )}

                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-sm group z-30"
                >
                  <XMarkIcon className="w-6 h-6 text-white/90 group-hover:text-white" />
                </button>

                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-30">
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
            ) : (
              <div className="relative w-full">
                <video
                  ref={videoRef}
                  src={media.src}
                  controls
                  playsInline
                  autoPlay
                  className="w-full h-auto max-h-[75vh] object-contain rounded-lg mx-auto"
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>

                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-sm group z-30"
                >
                  <XMarkIcon className="w-6 h-6 text-white/90 group-hover:text-white" />
                </button>

                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
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
                  <div className="absolute bottom-24 left-0 right-0 text-center bg-red-500/80 text-white py-2 px-4 rounded">
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
