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

  // Check if we have navigation (album or multiple photos)
  const hasNavigation = isAlbum || onNavigate;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4"
          onClick={onClose}
        >
          {/* Close Button - Fixed Top Right */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-md group z-[70] border border-white/30"
          >
            <XMarkIcon className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          </button>

          {/* Main Content Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-5xl mx-auto flex flex-col items-center"
          >
            {media.type === 'photo' ? (
              <>
                {/* Image Container with Side Arrows for Desktop */}
                <div className="relative w-full flex items-center justify-center">
                  {/* Desktop Left Arrow */}
                  {isAlbum && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAlbumNavigate('prev');
                      }}
                      className="hidden sm:flex absolute left-0 sm:-left-16 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-sm group z-30 items-center justify-center"
                    >
                      <ChevronLeftIcon className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                    </button>
                  )}
                  {!isAlbum && onNavigate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsImageLoading(true);
                        onNavigate('right');
                      }}
                      className="hidden sm:flex absolute left-0 sm:-left-16 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-sm group z-30 items-center justify-center"
                    >
                      <ChevronLeftIcon className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                    </button>
                  )}

                  {/* Image */}
                  <div className={`relative ${isImageLoading ? 'min-h-[200px] min-w-[200px] sm:min-h-[300px] sm:min-w-[300px]' : ''}`}>
                    {/* Loading Spinner - Centered with fixed size container */}
                    {isImageLoading && (
                      <div className="absolute inset-0 flex items-center justify-center z-20 min-h-[200px] sm:min-h-[300px]">
                        <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                    )}

                    <motion.div
                      key={currentAlbumSrc}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isImageLoading ? 0 : 1 }}
                      transition={{ duration: 0.3 }}
                      className={isImageLoading ? 'invisible' : 'visible'}
                    >
                      <Image
                        src={currentAlbumSrc || ''}
                        alt={media.title}
                        width={1920}
                        height={1080}
                        className="w-auto h-auto max-h-[65vh] sm:max-h-[75vh] max-w-full mx-auto object-contain rounded-lg"
                        quality={85}
                        priority
                        sizes="100vw"
                        onLoad={() => setIsImageLoading(false)}
                      />
                    </motion.div>

                    {/* Album Counter Badge - Only show when not loading */}
                    {isAlbum && !isImageLoading && (
                      <div className="absolute top-3 left-3 px-3 py-1.5 bg-black/60 rounded-full z-30">
                        <span className="text-sm text-white font-medium">
                          {albumIndex + 1} / {media.album_photos!.length}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Desktop Right Arrow */}
                  {isAlbum && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAlbumNavigate('next');
                      }}
                      className="hidden sm:flex absolute right-0 sm:-right-16 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-sm group z-30 items-center justify-center"
                    >
                      <ChevronRightIcon className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                    </button>
                  )}
                  {!isAlbum && onNavigate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsImageLoading(true);
                        onNavigate('left');
                      }}
                      className="hidden sm:flex absolute right-0 sm:-right-16 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-sm group z-30 items-center justify-center"
                    >
                      <ChevronRightIcon className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                    </button>
                  )}
                </div>

                {/* Mobile Navigation - Directly Below Image (only show when not loading) */}
                {hasNavigation && !isImageLoading && (
                  <div className="sm:hidden flex justify-center items-center gap-4 mt-4">
                    {isAlbum ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAlbumNavigate('prev');
                          }}
                          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm border border-white/20"
                        >
                          <ChevronLeftIcon className="w-5 h-5 text-white" />
                        </button>
                        
                        {/* Album Dots Indicator */}
                        <div className="flex items-center gap-1.5 px-2">
                          {media.album_photos!.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                setAlbumIndex(idx);
                              }}
                              className={`rounded-full transition-all ${
                                idx === albumIndex 
                                  ? 'bg-white w-5 h-1.5' 
                                  : 'bg-white/40 hover:bg-white/60 w-1.5 h-1.5'
                              }`}
                            />
                          ))}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAlbumNavigate('next');
                          }}
                          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm border border-white/20"
                        >
                          <ChevronRightIcon className="w-5 h-5 text-white" />
                        </button>
                      </>
                    ) : onNavigate ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsImageLoading(true);
                            onNavigate('right');
                          }}
                          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm border border-white/20"
                        >
                          <ChevronLeftIcon className="w-5 h-5 text-white" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsImageLoading(true);
                            onNavigate('left');
                          }}
                          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm border border-white/20"
                        >
                          <ChevronRightIcon className="w-5 h-5 text-white" />
                        </button>
                      </>
                    ) : null}
                  </div>
                )}

                {/* Desktop Album Dots (only show when not loading) */}
                {isAlbum && !isImageLoading && (
                  <div className="hidden sm:flex justify-center gap-2 mt-4">
                    {media.album_photos!.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setAlbumIndex(idx);
                        }}
                        className={`rounded-full transition-all ${
                          idx === albumIndex 
                            ? 'bg-white w-6 h-2.5' 
                            : 'bg-white/50 hover:bg-white/75 w-2.5 h-2.5'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Title and Date - Below Navigation (only show when not loading) */}
                <div className={`mt-4 text-center w-full px-4 transition-opacity ${isImageLoading ? 'opacity-0' : 'opacity-100'}`}>
                  <h3 className="text-lg font-semibold text-white drop-shadow-lg mb-1">
                    {media.title}
                  </h3>
                  {media.date && (
                    <p className="text-sm text-white/80 drop-shadow-lg">
                      {new Date(media.date).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  )}
                </div>
              </>
            ) : (
              /* Video Section */
              <div className="relative w-full">
                <video
                  ref={videoRef}
                  src={media.src}
                  controls
                  playsInline
                  autoPlay
                  className="w-full h-auto max-h-[70vh] object-contain rounded-lg mx-auto"
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>

                {error && (
                  <div className="mt-4 text-center bg-red-500/80 text-white py-2 px-4 rounded">
                    {error}
                  </div>
                )}

                {/* Title and Date for Video */}
                <div className="mt-4 text-center w-full px-4">
                  <h3 className="text-lg font-semibold text-white drop-shadow-lg mb-1">
                    {media.title}
                  </h3>
                  {media.date && (
                    <p className="text-sm text-white/80 drop-shadow-lg">
                      {new Date(media.date).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
