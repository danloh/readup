'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { MdDelete } from 'react-icons/md';
import type { VocabularyEntry } from '@/store/vocabularyBookStore';

interface VocabularyCardProps {
  entry: VocabularyEntry;
  onDelete?: (id: string) => void;
}

export const VocabularyCard: React.FC<VocabularyCardProps> = ({ entry, onDelete }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className='h-64 w-full'
      style={{
        perspective: '1000px',
      }}
    >
      <div
        className={clsx(
          'relative w-full h-full transition-transform duration-500 ease-in-out',
          isFlipped && '[transform:rotateY(180deg)]',
        )}
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front side - Word */}
        <div
          className='absolute w-full h-full bg-gradient-to-br from-primary to-primary-focus rounded-xl shadow-lg p-2 flex flex-col items-center justify-center text-center cursor-pointer'
          style={{
            backfaceVisibility: 'hidden',
          }}
          onClick={() => setIsFlipped(true)}
        >
          <div className='text-sm opacity-60 mb-4'>Tap to reveal</div>
          <h2 className='text-4xl font-bold text-white mb-4 break-words'>{entry.word}</h2>
          {entry.source && (
            <div className='text-xs opacity-40 mt-4'>{entry.source}</div>
          )}
        </div>

        {/* Back side - Definition */}
        <div
          className='absolute w-full h-full bg-gradient-to-br from-secondary to-secondary-focus rounded-xl shadow-lg p-2 flex flex-col items-center justify-center cursor-pointer'
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
          onClick={() => setIsFlipped(false)}
        >
          <div className='text-sm opacity-60 mb-4'>Tap to flip</div>
          <div 
            className='overflow-auto max-h-48 text-sm' 
            dangerouslySetInnerHTML={{ __html: entry.definition }} 
          />
          {entry.reviewCount !== undefined && entry.reviewCount > 0 && (
            <div className='text-xs opacity-40 mt-4'>Reviewed {entry.reviewCount}x</div>
          )}
        </div>
      </div>

      {/* Delete button */}
      {onDelete && (
        <button
          type='button'
          onClick={(e) => {
            e.stopPropagation();
            onDelete(entry.id);
          }}
          className='absolute -top-10 right-0 btn btn-ghost btn-sm text-error hover:bg-error/10'
          title='Delete'
        >
          <MdDelete size={18} />
        </button>
      )}
    </div>
  );
};
