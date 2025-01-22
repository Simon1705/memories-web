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

// Add type for custom animation info
interface CustomAnimationInfo {
  direction: number;
}

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
    date?: string;
    slideDirection?: 'left' | 'right' | null;
  } | null>(null);
  const [filteredMemories, setFilteredMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Add preview state and images
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewImages = [
    '/preview/curug.jpg',
    '/preview/horseman.jpg', 
    '/preview/sma.jpg',
    '/preview/smp.jpg',
    '/preview/barudak.jpg'
  ];

  // Add state for animation direction
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);

  // Add preview navigation function
  const handlePreviewNavigation = (direction: 'prev' | 'next') => {
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
    }, 3000);
  };

  // Auto-rotate timer ref
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

  const handleMediaClick = (memory: Memory, direction?: 'left' | 'right') => {
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
      slideDirection: direction || null
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
      <div className="relative min-h-screen mt-16">
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

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-20">
          {/* Hero Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-stretch min-h-[600px]">
            {/* Left Column - Text Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-8 py-8"
            >
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-block"
                >
                  <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100">
                    ✨ Capture memories forever
                  </span>
                </motion.div>
                <motion.h1
                  className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <span className="block dark:text-white text-gray-900">Create Your</span>
                  <span className="block mt-2">
                    <span className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                      Digital Time
                    </span>
                    <motion.span
                      className="inline-block ml-4 text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-purple-600"
                      animate={{
                        opacity: [1, 0.7, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatType: "reverse",
                      }}
                    >
                      Capsule
                    </motion.span>
                  </span>
                </motion.h1>
                <motion.p
                  className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  Perkara habis reset HP, semua backup hilang dan ini foto yang tersisa di PC. 
                  Boleh diupload aja yang mau mengabadikan 😃
                </motion.p>
              </div>

              {/* Action Buttons */}
              <motion.div
                className="flex flex-wrap gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsUploadModalOpen(true)}
                  className="group relative inline-flex items-center justify-center px-8 py-3 text-lg font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-full overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-pink-600 to-purple-600"
                    initial={false}
                    animate={{
                      x: ["0%", "100%"],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      repeatType: "reverse",
                    }}
                    style={{ opacity: 0.5 }}
                  />
                  <span className="relative flex items-center">
                    <PlusIcon className="w-5 h-5 mr-2" />
                    <span>Upload Memory</span>
                  </span>
                </motion.button>

                <motion.a
                  href="#memories"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('memories')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="inline-flex items-center justify-center px-8 py-3 text-lg font-medium text-purple-600 dark:text-purple-300 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <span>View Gallery</span>
                  <motion.svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 ml-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    animate={{
                      x: [0, 5, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      repeatType: "reverse",
                    }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </motion.svg>
                </motion.a>
              </motion.div>

              {/* Stats */}
              <motion.div
                className="grid grid-cols-3 gap-6 pt-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                {[
                  { label: 'Memories', value: memories.length },
                  { label: 'Photos', value: memories.filter(m => m.type === 'photo').length },
                  { label: 'Videos', value: memories.filter(m => m.type === 'video').length }
                ].map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    className="text-center p-4 rounded-2xl bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm"
                    whileHover={{ scale: 1.05 }}
                  >
                    <motion.div
                      className="text-3xl font-bold text-purple-600 dark:text-purple-400"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.7 + index * 0.1 }}
                    >
                      {stat.value}
                    </motion.div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{stat.label}</div>
                  </motion.div>
                ))}
              </motion.div>
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
                        filePath={memory.type === 'photo' ? memory.src! : memory.thumbnail!}
                        onDelete={fetchMemories}
                      />
                      <div 
                        className="memory-card relative overflow-hidden rounded-lg shadow-lg"
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
