'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, useScroll, useSpring } from 'framer-motion';
import Image from 'next/image';
import { PlayIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon, Square2StackIcon } from '@heroicons/react/24/solid';
import { UploadModal } from '@/components/UploadModal';
import { MediaViewer } from '@/components/MediaViewer';
import { DeleteButton } from '@/components/DeleteButton';
import { AdminLogin } from '@/components/AdminLogin';
import { supabase } from '@/lib/supabase';
import { AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Lazy load heavy components
const Masonry = dynamic(() => import('react-masonry-css'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-lg h-64" />
});

const Timeline = dynamic(() => import('@/components/Timeline').then(mod => ({ default: mod.Timeline })), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-lg h-64" />
});

interface Memory {
  id: number;
  type: 'photo' | 'video';
  title: string;
  src?: string | null;
  thumbnail?: string | null;
  duration?: string;
  date: string;
  tags?: string[];
  album_photos?: { src: string }[] | null;
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

  // Lenis Smooth Scrolling ref
  const lenisRef = useRef<Lenis | null>(null);

  const [mounted, setMounted] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{
    type: 'photo' | 'video';
    src: string;
    title: string;
    date?: string;
    slideDirection?: 'left' | 'right' | null;
    album_photos?: { src: string }[] | null;
  } | null>(null);
  const [filteredMemories, setFilteredMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Add preview state and images
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewImages = useMemo(() => [
    '/preview/curug.jpg',
    '/preview/horseman.jpg', 
    '/preview/sma.jpg',
    '/preview/smp.jpg',
    '/preview/barudak.jpg'
  ], []);

  // Add state for animation direction
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);

  // Add preview navigation function - memoized to prevent recreations
  const handlePreviewNavigation = useCallback((direction: 'prev' | 'next') => {
    // Reset auto-rotate timer
    if (autoRotateTimer.current) {
      clearInterval(autoRotateTimer.current);
    }
    
    // Set slide direction
    setSlideDirection(direction === 'prev' ? -1 : 1);
    
    // Update preview index
    if (direction === 'prev') {
      setPreviewIndex((prev) => (prev - 1 + previewImages.length) % previewImages.length);
    } else {
      setPreviewIndex((prev) => (prev + 1) % previewImages.length);
    }

    // Start new timer
    autoRotateTimer.current = setInterval(() => {
      setSlideDirection(1);
      setPreviewIndex((prev) => (prev + 1) % previewImages.length);
    }, 4000);
  }, [previewImages.length]);

  // Auto-rotate timer ref
  const autoRotateTimer = useRef<NodeJS.Timeout | undefined>(undefined);

  const fetchMemories = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchMemories();
  }, [fetchMemories]);

  // Initialize Lenis Smooth Scrolling with GSAP integration
  useEffect(() => {
    if (!mounted) return;
    
    // Create Lenis instance
    lenisRef.current = new Lenis({
      duration: 1.2, // Smoothing duration
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Easing function
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      touchMultiplier: 2,
    });

    // Integrate Lenis with GSAP ScrollTrigger
    lenisRef.current.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenisRef.current?.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);

    return () => {
      lenisRef.current?.destroy();
      gsap.ticker.remove((time) => {
        lenisRef.current?.raf(time * 1000);
      });
    };
  }, [mounted]);

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

  // Debounce search query - 300ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    // Apply search only using debounced value
    let filtered = memories;

    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(memory => 
        memory.title.toLowerCase().includes(query)
      );
    }

    setFilteredMemories(filtered);
  }, [memories, debouncedSearchQuery]);

  // Auto-rotate preview images - optimized timer
  useEffect(() => {
    const startTimer = () => {
      if (autoRotateTimer.current) {
        clearInterval(autoRotateTimer.current);
      }
      autoRotateTimer.current = setInterval(() => {
        setSlideDirection(1);
        setPreviewIndex((prev) => (prev + 1) % previewImages.length);
      }, 4000); // Increased interval for better performance
    };

    startTimer();
    return () => {
      if (autoRotateTimer.current) {
        clearInterval(autoRotateTimer.current);
      }
    };
  }, [previewImages.length]);

  const handleMediaClick = useCallback((memory: Memory, direction?: 'left' | 'right') => {
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
      date: memory.date,
      slideDirection: direction || null,
      album_photos: memory.album_photos || null
    });
  }, []);

  const getVideoUrl = useCallback((src: string): string => {
    const { data } = supabase.storage
      .from('memories')
      .getPublicUrl(src);
    
    if (data?.publicUrl) {
      console.log('Generated preview URL:', data.publicUrl);
      return data.publicUrl;
    }
    
    console.error('Failed to generate preview URL');
    return src;
  }, []);

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
        onNavigate={(direction) => {
          const currentIndex = filteredMemories.findIndex(m => m.src === selectedMedia?.src);
          if (direction === 'left' && currentIndex < filteredMemories.length - 1) {
            handleMediaClick(filteredMemories[currentIndex + 1], 'left');
          } else if (direction === 'right' && currentIndex > 0) {
            handleMediaClick(filteredMemories[currentIndex - 1], 'right');
          }
          }}
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

        {/* Hero section with major redesign */}
        <div className="relative min-h-screen mt-12">
          {/* Dynamic background */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/30 via-background/50 to-background" />
            <div className="absolute inset-0 opacity-50">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${previewImages[i]})`,
                    backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  opacity: 0.1,
                  filter: 'blur(50px)',
                  transform: `scale(${1 + i * 0.1})`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-stretch min-h-[600px]">
            {/* Left Column - Hero Content */}
            <div className="flex flex-col justify-center space-y-8">
          <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="space-y-8"
              >
                <div className="relative">
                  <motion.h1 
                    className="text-[80px] font-black leading-tight tracking-tight"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                  >
                    <motion.span 
                      className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500"
                      animate={{
                        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                      }}
                      transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    >
                      Digital
                    </motion.span>
                    <motion.span 
                      className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500"
            animate={{
                        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
            }}
            transition={{
                        duration: 8,
              repeat: Infinity,
                        ease: "linear",
                        delay: 0.2,
                      }}
                    >
                      Memories
                    </motion.span>
                  </motion.h1>
                  <div className="absolute -inset-4 -z-10">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl blur-3xl" />
                  </div>
        </div>

                <motion.p 
                  className="text-xl text-gray-600 dark:text-gray-300 backdrop-blur-sm border border-white/10 rounded-xl p-4 bg-white/5"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                >
                  Create, collect, and cherish your precious moments in one beautiful place. Share your stories through photos and videos that last a lifetime.
                </motion.p>
              </motion.div>

              {/* Action Buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="flex flex-wrap gap-4"
              >
              <motion.button
                  whileHover={{ 
                    scale: 1.05,
                    boxShadow: "0 25px 40px -12px rgba(168, 85, 247, 0.35)"
                  }}
                  whileTap={{ scale: 0.98 }}
                onClick={() => setIsUploadModalOpen(true)}
                  className="group relative"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.4 }}
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/80 to-pink-600/80 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-200" />
                  <div className="relative px-6 py-3 bg-black rounded-2xl flex items-center gap-3">
                    <motion.div
                      className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"
                      animate={{
                        rotate: [0, 360],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                    >
                      <PlusIcon className="w-5 h-5 text-white" />
                    </motion.div>
                    <span className="text-base font-medium bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                      Create Memory
                    </span>
                  </div>
              </motion.button>

              <motion.a
                href="#memories"
                  whileHover={{ x: 10 }}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('memories')?.scrollIntoView({ behavior: 'smooth' });
                }}
                  className="group relative px-5 py-2.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 flex items-center gap-3 transition-colors"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.5 }}
                >
                  <span className="text-base font-medium text-white group-hover:text-white/90">
                    View Gallery
                  </span>
                  <motion.div
                    animate={{
                      x: [0, 5, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                    }}
                    className="text-white group-hover:text-white/90"
                  >
                    →
                  </motion.div>
                </motion.a>
              </motion.div>

              {/* Stats */}
              <motion.div
                className="grid grid-cols-3 gap-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
              >
                {[
                  { 
                    label: 'Total Memories', 
                    value: memories.length,
                    icon: (
                      <svg className="w-5 h-5 text-gray-600 dark:text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )
                  },
                  { 
                    label: 'Photos', 
                    value: memories.filter(m => m.type === 'photo').length,
                    icon: (
                      <svg className="w-5 h-5 text-gray-600 dark:text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )
                  },
                  { 
                    label: 'Videos', 
                    value: memories.filter(m => m.type === 'video').length,
                    icon: (
                      <svg className="w-5 h-5 text-gray-600 dark:text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )
                  }
                ].map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    className="group relative"
                    whileHover={{ y: -4 }}
                  >
                    <motion.div
                      className="absolute -inset-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition duration-300"
                      animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0, 0.5, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                      }}
                    />
                    <div className="relative">
                      <motion.div
                        className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-white/90 dark:to-white/80 bg-clip-text text-transparent mb-2"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 1.2 + index * 0.1 }}
                      >
                        {stat.value}
                      </motion.div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/60 font-medium tracking-wide uppercase">
                        {stat.icon}
                        {stat.label}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Right Column - Preview Section */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="relative h-full min-h-[600px] flex items-center"
            >
              <div className="relative w-full" style={{ paddingBottom: '70.25%' }}> {/* 16:9 aspect ratio */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Previous Image (Blurred) */}
                  <AnimatePresence mode="wait">
          <motion.div 
                      key={previewImages[(previewIndex - 1 + previewImages.length) % previewImages.length]}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.3 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5 }}
                      className="absolute w-full h-full -left-[20%]"
                    >
                      <Image
                        src={previewImages[(previewIndex - 1 + previewImages.length) % previewImages.length]}
                        alt="Previous Preview"
                        fill
                        className="object-cover blur-md"
                        priority
                        sizes="25vw"
                      />
                    </motion.div>
                  </AnimatePresence>

                  {/* Next Image (Blurred) */}
            <AnimatePresence mode="wait">
                    <motion.div
                      key={previewImages[(previewIndex + 1) % previewImages.length]}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.3 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5 }}
                      className="absolute w-full h-full -right-[20%]"
                    >
                      <Image
                        src={previewImages[(previewIndex + 1) % previewImages.length]}
                        alt="Next Preview"
                        fill
                        className="object-cover blur-md"
                        priority
                        sizes="25vw"
                      />
                    </motion.div>
                  </AnimatePresence>
                  <AnimatePresence mode="wait" initial={false} custom={slideDirection}>
              <motion.div
                key={previewIndex}
                      custom={slideDirection}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      variants={{
                        hidden: (direction: number) => ({
                          opacity: 0,
                          x: direction * 100,
                          scale: 0.9
                        }),
                        visible: {
                          opacity: 1,
                          x: 0,
                          scale: 1
                        },
                        exit: (direction: number) => ({
                          opacity: 0,
                          x: direction * -100,
                          scale: 0.9
                        })
                      }}
                      transition={{ 
                        type: "spring",
                        stiffness: 200,
                        damping: 25,
                        mass: 1
                      }}
                      className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl bg-gray-900"
              >
                <Image
                  src={previewImages[previewIndex]}
                        alt="Featured Preview"
                  fill
                  className="object-cover"
                  priority
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                      <motion.div 
                        className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                      />
                
                {/* Navigation Buttons */}
                      <div className="absolute inset-y-0 -left-4 flex items-center">
                  <motion.button
                          whileHover={{ scale: 1.1, x: 5 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreviewNavigation('prev');
                    }}
                          className="p-3 m-4 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors group"
                  >
                          <ChevronLeftIcon className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                  </motion.button>
                </div>
                      <div className="absolute inset-y-0 -right-4 flex items-center">
                  <motion.button
                          whileHover={{ scale: 1.1, x: -5 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreviewNavigation('next');
                    }}
                          className="p-3 m-4 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors group"
                  >
                          <ChevronRightIcon className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                  </motion.button>
                </div>

                      {/* Preview Indicators */}
                      <div className="absolute bottom-8 left-0 right-0">
                        <div className="flex gap-3 justify-center">
                    {previewImages.map((_, index) => (
                            <motion.button
                        key={index}
                        onClick={() => setPreviewIndex(index)}
                              className={`w-3 h-3 rounded-full transition-all ${
                          index === previewIndex
                            ? 'bg-white scale-125'
                            : 'bg-white/50 hover:bg-white/75'
                        }`}
                              whileHover={{ scale: 1.2 }}
                              animate={index === previewIndex ? {
                                scale: [1, 1.1, 1],
                              } : {}}
                              transition={{ duration: 2, repeat: index === previewIndex ? Infinity : 0 }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
                </div>
              </div>

              {/* Decorative Elements */}
              <div className="absolute -inset-4 -z-10">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl blur-3xl" />
                <div className="absolute inset-0 bg-gradient-to-b from-purple-500/20 to-pink-500/20 rounded-3xl blur-3xl" />
              </div>
          </motion.div>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsUploadModalOpen(true)}
        className="fixed bottom-8 right-8 p-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-lg hover:shadow-xl z-50 group"
      >
        <PlusIcon className="w-6 h-6 text-white group-hover:rotate-90 transition-transform duration-300" />
      </motion.button>

      {/* Memories section with enhanced card hover effects */}
      <div id="memories" className="relative bg-background/80 backdrop-blur-sm py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Your Memories
            </h2>
            <div className="flex items-center gap-4">
              {/* Add Memory Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsUploadModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-2"
              >
                <PlusIcon className="w-5 h-5" />
                <span>Add Memory</span>
              </motion.button>
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
                  {filteredMemories.map((memory) => {
                    const isAlbum = memory.album_photos && memory.album_photos.length > 1;
                    
                    return (
                      <motion.div
                        key={memory.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ 
                          opacity: 1, 
                          y: 0,
                          transition: { 
                            duration: 0.4,
                            ease: "easeOut"
                          }
                        }}
                        viewport={{ once: true, margin: "-50px" }}
                        className="mb-6 group cursor-pointer relative"
                      >
                        <DeleteButton
                          memoryId={memory.id}
                          filePath={memory.type === 'photo' ? memory.src! : memory.thumbnail!}
                          onDelete={fetchMemories}
                        />
                        
                        {/* Stacked cards effect for albums - only on hover */}
                        {isAlbum && (
                          <>
                            <div className="absolute inset-0 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 shadow-md opacity-0 scale-95 rotate-0 translate-x-0 translate-y-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100 group-hover:rotate-6 group-hover:translate-x-3 group-hover:-translate-y-1" />
                            <div className="absolute inset-0 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500 shadow-md opacity-0 scale-95 rotate-0 translate-x-0 translate-y-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100 group-hover:rotate-3 group-hover:translate-x-1.5 group-hover:-translate-y-0.5" />
                          </>
                        )}
                        
                        <div 
                          className={`memory-card relative overflow-hidden rounded-lg shadow-lg transition-all duration-300 bg-white dark:bg-gray-800 ${isAlbum ? 'group-hover:-translate-y-1 group-hover:shadow-2xl' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMediaClick(memory, 'left');
                          }}
                        >
                          {memory.type === 'photo' ? (
                            <div className="relative aspect-auto">
                              <Image
                                src={memory.src || ''}
                                alt={memory.title}
                                width={800}
                                height={600}
                                className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
                                loading="lazy"
                                quality={75}
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                              />
                              {/* Album badge */}
                              {isAlbum && (
                                <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/60 rounded-full z-10">
                                  <Square2StackIcon className="w-4 h-4 text-white" />
                                  <span className="text-xs text-white font-medium">
                                    {memory.album_photos!.length}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="relative aspect-video group/video">
                              {/* Thumbnail Image */}
          <Image
                                src={memory.thumbnail || ''}
                                alt={memory.title}
                                fill
                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                                loading="lazy"
                                quality={75}
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
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
                    );
                  })}
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
                      date: memory.date
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
