'use client';

import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import { motion } from 'framer-motion';
import { PlusIcon, HeartIcon } from '@heroicons/react/24/solid';
import { useState, useEffect } from 'react';

interface NavbarProps {
  onAddMemory?: () => void;
}

export function Navbar({ onAddMemory }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 20;
      setScrolled(isScrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div 
        className={`absolute inset-0 transition-all duration-300 ${
          scrolled 
            ? 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg shadow-lg'
            : 'bg-transparent'
        }`} 
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link 
              href="/" 
              className="flex items-center space-x-2 group"
            >
              <HeartIcon className="w-6 h-6 sm:w-8 sm:h-8 text-gradient transform transition-transform group-hover:scale-110" />
              <div className="relative">
                <span className="text-lg sm:text-2xl font-[var(--font-playfair)] font-bold text-gradient tracking-wide">Mémoire</span>
                <div className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500 group-hover:w-full transition-all duration-300" />
              </div>
            </Link>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-6">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAddMemory}
              className="relative px-2 sm:px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-medium hover:opacity-90 transition-all duration-300 flex items-center space-x-1 sm:space-x-2 text-sm sm:text-base shadow-lg hover:shadow-xl hover:shadow-purple-500/20"
            >
              <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Add Memory</span>
              <span className="sm:hidden">Add</span>
              <motion.div
                className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full opacity-0 group-hover:opacity-30 blur"
                animate={{
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
              />
            </motion.button>
            <div className="relative p-[1px] rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg group z-10">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg opacity-0 group-hover:opacity-20 blur pointer-events-none transition-opacity duration-300" />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </motion.nav>
  );
} 