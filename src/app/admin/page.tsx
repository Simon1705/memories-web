'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { ExclamationCircleIcon, TrashIcon } from '@heroicons/react/24/solid';
import { motion, AnimatePresence } from 'framer-motion';

interface Media {
  id: string;
  title?: string;
  url?: string;
  src?: string;
  thumbnail?: string;
  created_at: string;
  type: 'image' | 'video';
}

interface DeleteConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  type: 'image' | 'video';
}

function DeleteConfirmDialog({ isOpen, onClose, onConfirm, type }: DeleteConfirmProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl max-w-md w-full"
          >
            <div className="flex items-center space-x-3 text-red-500 mb-4">
              <TrashIcon className="w-6 h-6" />
              <h3 className="text-lg font-semibold">Delete {type}</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete this {type}? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function AdminPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Media[]>([]);
  const [videos, setVideos] = useState<Media[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string; type: 'image' | 'video' } | null>(null);
  const router = useRouter();

  const checkAdmin = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    checkAdmin();
    fetchMedia();
  }, [checkAdmin]);

  const fetchMedia = async () => {
    try {
      setError(null);
      
      // Fetch all memories
      const { data: memoriesData, error: memoriesError } = await supabase
        .from('memories')
        .select('*')
        .order('created_at', { ascending: false });

      if (memoriesError) {
        console.error('Error fetching memories:', memoriesError);
        throw memoriesError;
      }
      
      if (memoriesData) {
        const validPhotos = memoriesData.filter(item => {
          const mediaUrl = item.url || item.src;
          return item.type === 'image' && mediaUrl;
        }).map(item => ({
          ...item,
          url: item.url || item.src // Normalize to url field
        }));
        
        const validVideos = memoriesData.filter(item => {
          const mediaUrl = item.url || item.thumbnail;
          return item.type === 'video' && mediaUrl;
        }).map(item => ({
          ...item,
          url: item.url || item.thumbnail // Normalize to url field
        }));
        
        setPhotos(validPhotos);
        setVideos(validVideos);
      } else {
        setPhotos([]);
        setVideos([]);
      }
    } catch (error) {
      console.error('Error fetching media:', error);
      setError('Failed to load media. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, type: 'image' | 'video') => {
    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from('memories')
        .delete()
        .eq('id', id)
        .eq('type', type);

      if (deleteError) throw deleteError;

      // Update state locally instead of refetching
      if (type === 'image') {
        setPhotos(photos.filter(photo => photo.id !== id));
      } else {
        setVideos(videos.filter(video => video.id !== id));
      }
    } catch (error) {
      console.error('Error deleting media:', error);
      setError('Failed to delete media. Please try again.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p>Loading media...</p>
        </div>
      </div>
    );
  }

  const renderMediaItem = (item: Media) => {
    if (!item.url) return null;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.2 }}
        key={item.id}
        className="relative group bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
      >
        {item.type === 'image' ? (
          <div className="relative h-48">
            <Image
              src={item.url}
              alt={item.title || 'Photo'}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover"
              priority
            />
          </div>
        ) : (
          <div className="relative h-48">
            <video
              src={item.url}
              className="absolute inset-0 w-full h-full object-cover"
              controls
              preload="metadata"
            />
          </div>
        )}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity duration-200" />
        <button
          onClick={() => setDeleteConfirm({ show: true, id: item.id, type: item.type })}
          className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
        {item.title && (
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-black bg-opacity-50">
            <p className="text-white text-sm truncate">{item.title}</p>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <>
      <DeleteConfirmDialog
        isOpen={deleteConfirm?.show || false}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) {
            handleDelete(deleteConfirm.id, deleteConfirm.type);
          }
        }}
        type={deleteConfirm?.type || 'image'}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-center">
            <ExclamationCircleIcon className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Photos ({photos.length})</h2>
            {photos.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No photos available</p>
            ) : (
              <motion.div layout className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <AnimatePresence>
                  {photos.map(renderMediaItem)}
                </AnimatePresence>
              </motion.div>
            )}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Videos ({videos.length})</h2>
            {videos.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No videos available</p>
            ) : (
              <motion.div layout className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <AnimatePresence>
                  {videos.map(renderMediaItem)}
                </AnimatePresence>
              </motion.div>
            )}
          </section>
        </div>
      </div>
    </>
  );
} 
