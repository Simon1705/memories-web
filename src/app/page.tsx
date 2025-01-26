'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Masonry from 'react-masonry-css';
import { motion, useScroll, useSpring, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { PlayIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import { UploadModal } from '@/components/UploadModal';
import { MediaViewer } from '@/components/MediaViewer';
import { DeleteButton } from '@/components/DeleteButton';
import { AdminLogin } from '@/components/AdminLogin';
import { supabase } from '@/lib/supabase';
import { Timeline } from '@/components/Timeline';
import { Navbar } from '@/components/Navbar';

interface Memory {
  id: number;
  type: 'image' | 'video';
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

const previewImages = [
  '/preview/curug.jpg',
  '/preview/horseman.jpg', 
  '/preview/sma.jpg',
  '/preview/smp.jpg',
  '/preview/barudak.jpg'
];

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
    type: 'image' | 'video';
    src: string;
    title: string;
    date?: string;
    slideDirection?: 'left' | 'right' | null;
  } | null>(null);
  const [filteredMemories, setFilteredMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Add preview state and images
  const [previewIndex, setPreviewIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);

  // Memoize handlers
  const handlePreviewNavigation = useCallback((direction: 'prev' | 'next') => {
    if (autoRotateTimer.current) {
      clearInterval(autoRotateTimer.current);
    }
    
    setSlideDirection(direction === 'prev' ? -1 : 1);
    
    if (direction === 'prev') {
      setPreviewIndex((prev) => (prev - 1 + previewImages.length) % previewImages.length);
    } else {
      setPreviewIndex((prev) => (prev + 1) % previewImages.length);
    }

    autoRotateTimer.current = setInterval(() => {
      setSlideDirection(1);
      setPreviewIndex((prev) => (prev + 1) % previewImages.length);
    }, 3000);
  }, []);

  const handleMediaClick = useCallback((memory: Memory, direction?: 'left' | 'right') => {
    if (!memory.src) {
      console.error('No source URL found for memory:', memory);
      return;
    }

    let url = memory.src;
    if (memory.type === 'video') {
      const { data } = supabase.storage
        .from('memories')
        .getPublicUrl(memory.src);
      
      if (data?.publicUrl) {
        url = data.publicUrl;
      }
    }

    setSelectedMedia({
      type: memory.type,
      src: url,
      title: memory.title,
      date: memory.date,
      slideDirection: direction || null
    });
  }, []);

  // Auto-rotate timer ref
  const autoRotateTimer = useRef<NodeJS.Timeout | undefined>(undefined);

  // Optimize useEffect
  useEffect(() => {
    setMounted(true);
    fetchMemories();

    return () => {
      if (autoRotateTimer.current) {
        clearInterval(autoRotateTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const timer = setInterval(() => {
      setSlideDirection(1);
      setPreviewIndex((prev) => (prev + 1) % previewImages.length);
    }, 3000);

    autoRotateTimer.current = timer;
    return () => clearInterval(timer);
  }, [mounted]);

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

  // Optimize background animations
  const backgroundVariants = {
    animate: {
      background: [
        'radial-gradient(circle at 0% 0%, rgba(147, 51, 234, 0.1) 0%, transparent 50%)',
        'radial-gradient(circle at 100% 100%, rgba(236, 72, 153, 0.1) 0%, transparent 50%)',
        'radial-gradient(circle at 0% 100%, rgba(147, 51, 234, 0.1) 0%, transparent 50%)',
        'radial-gradient(circle at 100% 0%, rgba(236, 72, 153, 0.1) 0%, transparent 50%)',
      ],
    }
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

      {/* Optimize background elements */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-background to-pink-900/20" />
        <motion.div
          className="absolute inset-0"
          variants={backgroundVariants}
          animate="animate"
          transition={{
            duration: 10,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
        <div className="absolute inset-0 backdrop-blur-[100px]" />
      </div>

      {/* Reduce number of floating elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-5">
        {[...Array(10)].map((_, i) => (
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

      {/* Hero section with major redesign */}
      <div className="relative min-h-screen mt-1">
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

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20">
          {/* Hero Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-stretch min-h-[600px]">
            {/* Left Column - Text Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-12 py-8 relative"
            >
              {/* Futuristic background elements */}
              <div className="absolute inset-0 -z-10">
                <motion.div
                  className="absolute w-[800px] h-[800px] -top-[200px] -left-[200px]"
                  style={{
                    background: "conic-gradient(from 0deg at 50% 50%, rgba(168, 85, 247, 0.15) 0%, rgba(236, 72, 153, 0.15) 25%, rgba(168, 85, 247, 0.15) 50%, rgba(236, 72, 153, 0.15) 75%, rgba(168, 85, 247, 0.15) 100%)",
                    filter: "blur(120px)"
                  }}
                  animate={{
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 30,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
              </div>

              {/* Main Content */}
              <div className="space-y-12">
                {/* Title Section */}
                <div className="space-y-4">
                  <motion.h1 
                    className="relative"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.8 }}
                  >
                    <div className="text-[80px] sm:text-[100px] md:text-[120px] leading-[0.9] font-black tracking-tight">
                      <motion.div
                        className="relative mb-4"
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7, duration: 0.8 }}
                      >
                        <motion.span 
                          className="block text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-white/90 dark:to-white/80 leading-[1.15]"
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
                      </motion.div>
                      <motion.div
                        className="relative mb-6"
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.9, duration: 0.8 }}
                      >
                        <motion.span 
                          className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 dark:from-purple-400 dark:via-pink-500 dark:to-purple-400 leading-[1.2]"
                          animate={{
                            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                          }}
                          transition={{
                            duration: 8,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                        >
                          Memories
                        </motion.span>
                      </motion.div>
                    </div>
                  </motion.h1>
                </div>

                {/* Description & Actions */}
                <div className="space-y-8">
                  <motion.div
                    className="relative max-w-xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 }}
                  >
                    <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-3xl blur-xl" />
                    <p className="relative text-xl text-gray-700/90 dark:text-white/90 font-light leading-relaxed p-6 backdrop-blur-sm rounded-3xl border border-white/10">
                      Ubah momen berharga menjadi kenangan digital yang abadi. Setiap cerita hidup dapat tersimpan dengan indah.
                    </p>
                  </motion.div>

                  <div className="flex items-center gap-6">
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
                      <div className="relative px-6 py-3 bg-black dark:bg-black rounded-2xl flex items-center gap-3">
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
                        <span className="text-base font-medium text-white dark:text-white">
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
                      <span className="text-base font-medium text-gray-900 group-hover:text-gray-700 dark:text-white dark:group-hover:text-white/90">
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
                        className="text-gray-900 group-hover:text-gray-700 dark:text-white group-hover:text-white/90"
                      >
                        →
                      </motion.div>
                    </motion.a>
                  </div>
                </div>

                {/* Stats */}
                <motion.div
                  className="grid grid-cols-3 gap-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.6 }}
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
                      value: memories.filter(m => m.type === 'image').length,
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
                          transition={{ delay: 1.6 + index * 0.1 }}
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
            </motion.div>

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
                          <ChevronLeftIcon className="w-8 h-8 text-gray-900 group-hover:scale-110 transition-transform" />
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
                          <ChevronRightIcon className="w-8 h-8 text-gray-900 group-hover:scale-110 transition-transform" />
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
                                  ? 'bg-gray-900 scale-125'
                                  : 'bg-gray-800 hover:bg-gray-700'
                              }`}
                              whileHover={{ scale: 1.5 }}
                              animate={index === previewIndex ? {
                                scale: [1, 1.2, 1],
                                opacity: [1, 0.8, 1],
                              } : {}}
                              transition={{ duration: 1.5, repeat: index === previewIndex ? Infinity : 0 }}
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
                        filePath={memory.type === 'image' ? memory.src! : memory.thumbnail!}
                        onDelete={fetchMemories}
                      />
                      <div 
                        className="memory-card relative overflow-hidden rounded-lg shadow-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMediaClick(memory, 'left');
                        }}
                      >
                        {memory.type === 'image' ? (
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
