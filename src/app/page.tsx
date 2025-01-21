'use client';

import { useEffect, useState, useRef } from 'react';
import Masonry from 'react-masonry-css';
import { motion, useScroll, useSpring } from 'framer-motion';
import Image from 'next/image';
import { PlayIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import { UploadModal } from '@/components/UploadModal';
import { MediaViewer } from '@/components/MediaViewer';
import { DeleteButton } from '@/components/DeleteButton';
import { AdminLogin } from '@/components/AdminLogin';
import { supabase } from '@/lib/supabase';
import { Timeline } from '@/components/Timeline';
import { AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';

interface Memory {
  id: number;
  type: 'photo' | 'video';
  title: string;
  src?: string | null;
  thumbnail?: string | null;
  duration?: string;
  date: string;
  tags?: string[];
}

const breakpointColumns = {
  default: 4,
  1400: 3,
  1024: 2,
  640: 1,
};

type ViewMode = 'grid' | 'timeline';

export default function Home() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const [mounted, setMounted] = useState(false);
  const [rotations, setRotations] = useState<number[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{
    type: 'photo' | 'video';
    src: string;
    title: string;
  } | null>(null);
  const [filteredMemories, setFilteredMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Add preview animation state
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewImages = [
    '/preview/curug.jpg',
    '/preview/horseman.jpg', 
    '/preview/sma.jpg',
    '/preview/smp.jpg',
    '/preview/barudak.jpg'
  ];

  // Add timer ref to store interval
  const autoRotateTimer = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    setMounted(true);
    fetchMemories();
  }, []);

  useEffect(() => {
    setRotations(memories.map(() => (Math.random() - 0.5) * 15));
  }, [memories]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Check for Ctrl + Shift + A
      if (event.ctrlKey && event.shiftKey && event.key === 'A') {
        event.preventDefault();
        setIsAdminLoginOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  useEffect(() => {
    // Apply search only
    let filtered = memories;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(memory => 
        memory.title.toLowerCase().includes(query)
      );
    }

    setFilteredMemories(filtered);
  }, [memories, searchQuery]);

  // Auto-rotate preview images
  useEffect(() => {
    const startTimer = () => {
      if (autoRotateTimer.current) {
        clearInterval(autoRotateTimer.current);
      }
      autoRotateTimer.current = setInterval(() => {
        setPreviewIndex((prev) => (prev + 1) % previewImages.length);
      }, 3000);
    };

    startTimer();
    return () => {
      if (autoRotateTimer.current) {
        clearInterval(autoRotateTimer.current);
      }
    };
  }, [previewImages.length]);

  // Function to handle manual navigation
  const handlePreviewNavigation = (direction: 'prev' | 'next') => {
    // Reset timer
    if (autoRotateTimer.current) {
      clearInterval(autoRotateTimer.current);
    }
    autoRotateTimer.current = setInterval(() => {
      setPreviewIndex((prev) => (prev + 1) % previewImages.length);
    }, 3000);

    // Update index
    setPreviewIndex((prev) => {
      if (direction === 'prev') {
        return (prev - 1 + previewImages.length) % previewImages.length;
      }
      return (prev + 1) % previewImages.length;
    });
  };

  const fetchMemories = async () => {
    try {
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setMemories(data || []);
    } catch (error) {
      console.error('Error fetching memories:', error);
    }
  };

  const handleMediaClick = (memory: Memory) => {
    console.log('Clicked memory:', memory); // Debug log
    if (!memory.src) {
      console.error('No source URL found for memory:', memory);
      return;
    }

    // Get the direct download URL for videos
    let url = memory.src;
    if (memory.type === 'video') {
      // Try to get the direct download URL
      const { data } = supabase.storage
        .from('memories')
        .getPublicUrl(memory.src);
      
      if (data?.publicUrl) {
        url = data.publicUrl;
        console.log('Generated public URL:', url);
      } else {
        console.error('Failed to generate public URL');
      }
    }

    console.log('Final media URL:', url); // Debug log

    setSelectedMedia({
      type: memory.type,
      src: url,
      title: memory.title,
    });
  };

  const getVideoUrl = (src: string): string => {
    const { data } = supabase.storage
      .from('memories')
      .getPublicUrl(src);
    
    if (data?.publicUrl) {
      console.log('Generated preview URL:', data.publicUrl);
      return data.publicUrl;
    }
    
    console.error('Failed to generate preview URL');
    return src;
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="relative">
      {/* Title */}
      <title>Mémoire - Capture Your Precious Moments</title>

      {/* Interactive background elements */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-background to-pink-900/20" />
        <motion.div
          className="absolute inset-0"
          animate={{
            background: [
              'radial-gradient(circle at 0% 0%, rgba(147, 51, 234, 0.1) 0%, transparent 50%)',
              'radial-gradient(circle at 100% 100%, rgba(236, 72, 153, 0.1) 0%, transparent 50%)',
              'radial-gradient(circle at 0% 100%, rgba(147, 51, 234, 0.1) 0%, transparent 50%)',
              'radial-gradient(circle at 100% 0%, rgba(236, 72, 153, 0.1) 0%, transparent 50%)',
            ],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
        <div className="absolute inset-0 backdrop-blur-[100px]" />
      </div>

      {/* Floating elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-5">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-[2px] h-[2px] bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              scale: Math.random() * 2 + 1,
              opacity: Math.random() * 0.5 + 0.25,
            }}
            animate={{
              y: [null, Math.random() * window.innerHeight],
              x: [null, Math.random() * window.innerWidth],
            }}
            transition={{
              duration: Math.random() * 20 + 10,
              repeat: Infinity,
              repeatType: "reverse",
            }}
          />
        ))}
      </div>

      <UploadModal 
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={fetchMemories}
      />

      <MediaViewer
        isOpen={!!selectedMedia}
        onClose={() => setSelectedMedia(null)}
        media={selectedMedia}
      />

      <AdminLogin
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
      />

      {/* Progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 transform-origin-0 z-50"
        style={{ scaleX }}
      />

      {/* Use Navbar component */}
      <Navbar onAddMemory={() => setIsUploadModalOpen(true)} />

      {/* Hero section with adjusted padding */}
      <div className="relative min-h-screen mt-16">
        <div className="absolute inset-0">
          <motion.div 
            className="absolute inset-0 bg-gradient-to-b from-purple-900/30 via-background/50 to-background"
            animate={{
              opacity: [0.5, 0.7, 0.5],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              repeatType: "reverse",
            }}
          />
        </div>

        <div className="relative pt-2 pb-24 sm:pb-48 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-screen flex flex-col-reverse md:flex-row items-center justify-between gap-8 sm:gap-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-xl w-full md:w-auto text-center md:text-left"
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight dark:text-white text-gray-900 mb-4 sm:mb-8">
              <span className="dark:text-white text-gray-900">Capture Your</span>{' '}
              <span className="text-gradient">Precious Moments</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl dark:text-gray-200 text-gray-600 mb-8 sm:mb-12 max-w-2xl mx-auto md:mx-0">
              Perkara habis reset HP, semua backup hilang dan ini foto yang tersisa di PC. Boleh diupload aja yang mau mengabadikan 😃
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsUploadModalOpen(true)}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-semibold transition-all shadow-lg hover:shadow-xl hover:opacity-90 flex items-center justify-center space-x-2"
              >
                <PlusIcon className="w-5 h-5" />
                <span>Start Creating</span>
              </motion.button>
              <motion.a
                href="#memories"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('memories')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-white text-purple-600 rounded-full font-semibold hover:bg-purple-50 transition-colors shadow-lg hover:shadow-xl text-center"
              >
                Explore Memories
              </motion.a>
            </div>
          </motion.div>

          {/* Preview Gallery - Make it smaller on mobile */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative w-full sm:w-[80%] md:w-full max-w-sm md:max-w-md aspect-[4/3]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl -rotate-6 scale-105" />
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl rotate-3 scale-105" />
            <AnimatePresence mode="wait">
              <motion.div
                key={previewIndex}
                initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.9, rotate: 5 }}
                transition={{ duration: 0.5 }}
                className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl"
              >
                <Image
                  src={previewImages[previewIndex]}
                  alt="Memory Preview"
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                
                {/* Navigation Buttons */}
                <div className="absolute inset-y-0 left-0 flex items-center">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreviewNavigation('prev');
                    }}
                    className="p-2 m-2 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors group"
                  >
                    <ChevronLeftIcon className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                  </motion.button>
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreviewNavigation('next');
                    }}
                    className="p-2 m-2 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors group"
                  >
                    <ChevronRightIcon className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                  </motion.button>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="flex gap-2 justify-center">
                    {previewImages.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setPreviewIndex(index)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          index === previewIndex
                            ? 'bg-white scale-125'
                            : 'bg-white/50 hover:bg-white/75'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Memories section with enhanced card hover effects */}
      <div id="memories" className="relative bg-background/80 backdrop-blur-sm py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Your Memories
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                {(['grid', 'timeline'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      viewMode === mode
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Simple Search Input */}
          <div className="relative w-full max-w-3xl mx-auto mb-8">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories..."
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {filteredMemories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No memories found matching your search.
              </p>
            </div>
          ) : (
            <>
              {viewMode === 'grid' && (
                <Masonry
                  breakpointCols={breakpointColumns}
                  className="flex -ml-4 w-auto"
                  columnClassName="pl-4 bg-clip-padding"
                >
                  {filteredMemories.map((memory, index) => (
                    <motion.div
                      key={memory.id}
                      initial={{ opacity: 0, y: 20, rotateZ: rotations[index] || 0 }}
                      whileInView={{ 
                        opacity: 1, 
                        y: 0, 
                        rotateZ: 0,
                        transition: { 
                          duration: 0.8,
                          ease: [0.43, 0.13, 0.23, 0.96]
                        }
                      }}
                      viewport={{ once: false, margin: "-100px" }}
                      whileHover={{ scale: 1.02 }}
                      className="mb-6 group cursor-pointer relative"
                    >
                      <DeleteButton
                        memoryId={memory.id}
                        filePath={memory.type === 'photo' ? memory.src! : memory.thumbnail!}
                        onDelete={fetchMemories}
                      />
                      <div 
                        className="memory-card relative overflow-hidden rounded-lg shadow-lg"
                        onClick={() => handleMediaClick(memory)}
                      >
                        {memory.type === 'photo' ? (
                          <div className="relative aspect-auto">
                            <Image
                              src={memory.src || ''}
                              alt={memory.title}
                              width={800}
                              height={600}
                              className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                          </div>
                        ) : (
                          <div className="relative aspect-video group/video">
                            {/* Thumbnail Image */}
                            <Image
                              src={memory.thumbnail || ''}
                              alt={memory.title}
                              fill
                              className="object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            
                            {/* Video Preview on Hover */}
                            <div 
                              className="absolute inset-0 opacity-0 group-hover/video:opacity-100 transition-opacity duration-300"
                              onMouseEnter={(e) => {
                                const videoElement = e.currentTarget.querySelector('video');
                                if (videoElement && memory.src) {
                                  const videoUrl = getVideoUrl(memory.src);
                                  console.log('Preview video URL:', videoUrl);
                                  videoElement.src = videoUrl;
                                  videoElement.currentTime = 0;
                                  videoElement.play().catch(() => {
                                    if (videoElement) {
                                      videoElement.muted = true;
                                      videoElement.play().catch(console.error);
                                    }
                                  });
                                }
                              }}
                              onMouseLeave={(e) => {
                                const videoElement = e.currentTarget.querySelector('video');
                                if (videoElement) {
                                  videoElement.pause();
                                  videoElement.currentTime = 0;
                                  videoElement.src = ''; // Clear the source
                                }
                              }}
                            >
                              <video
                                className="w-full h-full object-cover"
                                muted
                                loop
                                playsInline
                                preload="metadata"
                              />
                            </div>

                            {/* Play Icon */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <PlayIcon className="w-16 h-16 text-white drop-shadow-lg" />
                            </div>

                            {/* Duration Badge */}
                            {memory.duration && (
                              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/75 rounded text-white text-sm z-10">
                                {memory.duration}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all z-10">
                          <h3 className="text-lg font-semibold text-white">
                            {memory.title}
                          </h3>
                          <p className="text-sm text-gray-200">
                            {memory.date}
                          </p>
                          {memory.tags && memory.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {memory.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-1 text-xs bg-white/20 rounded-full text-white"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </Masonry>
              )}

              {viewMode === 'timeline' && (
                <Timeline
                  memories={filteredMemories}
                  onMediaClick={(memory) => {
                    setSelectedMedia({
                      type: memory.type,
                      src: memory.src || '',
                      title: memory.title,
                    });
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
