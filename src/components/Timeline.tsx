'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { format } from 'date-fns';
import { PlayIcon } from '@heroicons/react/24/solid';

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

interface TimelineProps {
  memories: Memory[];
  onMediaClick: (memory: Memory) => void;
}

export function Timeline({ memories, onMediaClick }: TimelineProps) {
  // Group memories by year and month
  const timelineGroups = memories.reduce((groups, memory) => {
    const date = new Date(memory.date);
    const year = date.getFullYear();
    const month = date.getMonth();

    const yearGroup = groups.find(g => g.year === year);
    if (yearGroup) {
      const monthGroup = yearGroup.months.find(m => m.month === month);
      if (monthGroup) {
        monthGroup.memories.push(memory);
      } else {
        yearGroup.months.push({ month, memories: [memory] });
      }
    } else {
      groups.push({
        year,
        months: [{ month, memories: [memory] }]
      });
    }
    return groups;
  }, [] as { year: number; months: { month: number; memories: Memory[] }[] }[]);

  // Sort groups by year (descending) and months (descending)
  timelineGroups.sort((a, b) => b.year - a.year);
  timelineGroups.forEach(group => {
    group.months.sort((a, b) => b.month - a.month);
  });

  const [selectedYear, setSelectedYear] = useState<number | null>(
    timelineGroups[0]?.year || null
  );

  const scrollToYear = (year: number) => {
    setSelectedYear(year);
    const element = document.getElementById(`year-${year}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen pb-16">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm py-4 mb-8">
        <div className="flex gap-2 overflow-x-auto pb-2 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {timelineGroups.map(({ year }) => (
            <button
              key={year}
              onClick={() => scrollToYear(year)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedYear === year
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {timelineGroups.map(({ year, months }) => (
          <div key={year} id={`year-${year}`} className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
              {year}
            </h2>
            {months.map(({ month, memories: monthMemories }) => (
              <div key={month} className="mb-12">
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-6">
                  {format(new Date(year, month), 'MMMM')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {monthMemories.map((memory) => (
                    <motion.div
                      key={memory.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                      onClick={() => onMediaClick(memory)}
                      className="relative group cursor-pointer rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
                    >
                      {memory.type === 'photo' ? (
                        <div className="relative aspect-video">
                          <Image
                            src={memory.src || ''}
                            alt={memory.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        </div>
                      ) : (
                        <div className="relative aspect-video">
                          <Image
                            src={memory.thumbnail || ''}
                            alt={memory.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <PlayIcon className="w-12 h-12 text-white drop-shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          {memory.duration && (
                            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/75 rounded text-white text-sm">
                              {memory.duration}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                        <h4 className="text-lg font-semibold text-white">
                          {memory.title}
                        </h4>
                        <p className="text-sm text-gray-200">
                          {format(new Date(memory.date), 'MMMM d, yyyy')}
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
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
} 