'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MdArrowBack, MdDelete, MdGridView, MdViewWeek } from 'react-icons/md';
import { BiCard } from 'react-icons/bi';
import clsx from 'clsx';

import { useVocabularyBookStore } from '@/store/vocabularyBookStore';
import { useVocabularyBook } from '@/hooks/useVocabularyBook';
import { useTranslation } from '@/hooks/useTranslation';
import { VocabularyCard } from './components/VocabularyCard';

export default function VocabularyPage() {
  const _ = useTranslation();
  const router = useRouter();
  const { isLoaded, save } = useVocabularyBook();
  const { getAllEntries, removeEntry, recordReview } = useVocabularyBookStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'study' | 'select' | 'grid'>('study');
  const [isDeleting, setIsDeleting] = useState(false);

  const allEntries = getAllEntries();
  const currentEntry = allEntries[currentIndex];

  useEffect(() => {
    if (!isLoaded) return;
    // Reset index if entries change
    if (currentIndex >= allEntries.length && allEntries.length > 0) {
      setCurrentIndex(0);
    }
  }, [allEntries.length, isLoaded, currentIndex]);

  const handleNext = () => {
    if (currentIndex < allEntries.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      recordReview(currentEntry!.id);
      save().catch(console.warn);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleDelete = async (id: string) => {
    removeEntry(id);
    if (currentIndex >= allEntries.length - 1) {
      setCurrentIndex(Math.max(0, currentIndex - 1));
    }
    try {
      await save();
    } catch (error) {
      console.warn('Failed to save after delete:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEntries.size === 0) return;
    setIsDeleting(true);
    try {
      for (const id of selectedEntries) {
        removeEntry(id);
      }
      setSelectedEntries(new Set());
      setViewMode('study');
      if (currentIndex >= allEntries.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1));
      }
      await save();
    } catch (error) {
      console.warn('Failed to save after bulk delete:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectToggle = (id: string) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleGridCardDelete = async (id: string) => {
    removeEntry(id);
    try {
      await save();
    } catch (error) {
      console.warn('Failed to save after delete:', error);
    }
  };

  if (!isLoaded) {
    return (
      <div className='flex items-center justify-center h-screen'>
        <div className='loading loading-spinner loading-lg' />
      </div>
    );
  }

  if (allEntries.length === 0) {
    return (
      <div className='flex h-screen flex-col'>
        {/* Header */}
        <div className='bg-base-200 border-b border-base-300 p-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <button
                type='button'
                onClick={() => router.back()}
                className='btn btn-ghost btn-sm'
              >
                <MdArrowBack size={20} />
              </button>
              <h1 className='text-xl font-bold'>{_('Vocabulary Book')}</h1>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className='flex flex-1 flex-col items-center justify-center px-4 text-center'>
          <div className='text-6xl mb-4'>📚</div>
          <h2 className='text-2xl font-bold mb-2'>{_('No Words Yet')}</h2>
          <p className='text-base-content/60 mb-6 max-w-sm'>
            {_('Add words to your vocabulary book from the dictionary to start learning!')}
          </p>
          <button
            type='button'
            onClick={() => router.back()}
            className='btn btn-primary'
          >
            {_('Back to Reader')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-screen flex-col bg-base-100'>
      {/* Header */}
      <div className='bg-base-200 border-b border-base-300 p-2'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-1'>
            <button
              type='button'
              onClick={() => {
                if (viewMode === 'select') {
                  setViewMode('study');
                  setSelectedEntries(new Set());
                } else {
                  router.back();
                }
              }}
              className='btn btn-ghost btn-xs'
            >
              <MdArrowBack size={20} />
            </button>
            <b className='text-lg font-bold'>
              {_('Vocabulary')} ({allEntries.length})
            </b>
          </div>
          <div className='flex gap-2'>
            {/* View Mode Toggles */}
            <button
              type='button'
              title={_('Study Mode')}
              onClick={() => {
                setViewMode('study');
                setSelectedEntries(new Set());
              }}
              className={clsx('btn btn-xs', viewMode === 'study' ? 'btn-primary' : 'btn-outline')}
            >
              <BiCard size={16} />
            </button>
            <button
              type='button'
              title={_('Grid View')}
              onClick={() => {
                setViewMode('grid');
                setSelectedEntries(new Set());
              }}
              className={clsx('btn btn-xs', viewMode === 'grid' ? 'btn-primary' : 'btn-outline')}
            >
              <MdGridView size={16} />
            </button>
            <button
              type='button'
              title={_('Select')}
              onClick={() => {
                setViewMode('select');
              }}
              className={clsx('btn btn-xs', viewMode === 'select' ? 'btn-primary' : 'btn-outline')}
            >
              <MdViewWeek size={16} />
            </button>

            {/* Delete Button - Show when items selected */}
            {viewMode === 'select' && selectedEntries.size > 0 && (
              <button
                type='button'
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className='btn btn-xs btn-error'
              >
                {isDeleting ? (
                  <>
                    <span className='loading loading-spinner loading-xs' />
                    {_('Deleting')}
                  </>
                ) : (
                  <>
                    <MdDelete size={16} /> {selectedEntries.size}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className='flex-1 overflow-hidden flex flex-col'>
        {viewMode === 'select' ? (
          // Selection Mode - List View
          <div className='flex-1 overflow-y-auto'>
            <div className='p-4 space-y-2'>
              {allEntries.map((entry) => (
                <div
                  key={entry.id}
                  className='flex items-center gap-3 p-4 rounded-lg border border-base-300 hover:bg-base-200 cursor-pointer'
                  onClick={() => handleSelectToggle(entry.id)}
                >
                  <input
                    type='checkbox'
                    checked={selectedEntries.has(entry.id)}
                    onChange={() => {}}
                    className='checkbox'
                  />
                  <div className='flex-1 min-w-0'>
                    <div className='font-semibold truncate'>{entry.word}</div>
                    <div className='text-sm text-base-content/60 truncate'>
                      {entry.definition}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          // Grid Mode - Show all words in grid
          <div className='flex-1 overflow-y-auto'>
            <div className='p-4'>
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max'>
                {allEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className='bg-gradient-to-br from-primary to-primary-focus rounded-lg p-4 text-white shadow-md hover:shadow-lg transition-shadow cursor-pointer group relative'
                    onClick={() => {
                      setCurrentIndex(allEntries.indexOf(entry));
                      setViewMode('study');
                    }}
                  >
                    <div className='absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity'>
                      <button
                        type='button'
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGridCardDelete(entry.id);
                        }}
                        className='btn btn-ghost btn-xs text-error'
                        title={_('Delete')}
                      >
                        <MdDelete size={16} />
                      </button>
                    </div>
                    <div className='font-bold text-lg mb-2 pr-6 break-words'>{entry.word}</div>
                    <div className='text-sm opacity-90 line-clamp-3 break-words'>
                      {entry.definition}
                    </div>
                    {entry.reviewCount !== undefined && entry.reviewCount > 0 && (
                      <div className='text-xs opacity-60 mt-2'>
                        Reviewed {entry.reviewCount}x
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Study Mode - Card Mode
          <div className='flex-1 flex flex-col items-center justify-center p-6'>
            {currentEntry && (
              <div className='w-full max-w-md'>
                {/* Card */}
                <VocabularyCard
                  entry={currentEntry}
                  onDelete={handleDelete}
                />

                {/* Progress Info */}
                <div className='mt-8 text-center'>
                  <div className='text-sm text-base-content/60 mb-4'>
                    {currentIndex + 1} / {allEntries.length}
                  </div>
                  <div className='w-full bg-base-300 rounded-full h-2 overflow-hidden'>
                    <div
                      className='bg-primary h-full transition-all duration-300'
                      style={{
                        width: `${((currentIndex + 1) / allEntries.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className='mt-8 flex gap-3 justify-center'>
                  <button
                    type='button'
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    className='btn btn-sm btn-outline disabled:opacity-50'
                  >
                    {_('Previous')}
                  </button>
                  <button
                    type='button'
                    onClick={handleNext}
                    disabled={currentIndex === allEntries.length - 1}
                    className='btn btn-sm btn-primary disabled:opacity-50'
                  >
                    {currentIndex === allEntries.length - 1 ? _('Completed') : _('Next')}
                  </button>
                </div>

                {/* Info Footer */}
                <div className='mt-6 text-center text-xs text-base-content/40 space-y-1'>
                  {currentEntry.reviewCount !== undefined && currentEntry.reviewCount > 0 && (
                    <div>
                      {_('Last reviewed')}: {currentEntry.lastReviewedAt ? new Date(currentEntry.lastReviewedAt).toLocaleDateString() : '—'}
                    </div>
                  )}
                  <div>
                    {_('Added')}: {new Date(currentEntry.addedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
