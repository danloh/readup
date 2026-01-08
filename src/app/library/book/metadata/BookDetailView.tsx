import React from 'react';
import { MdOutlineCloudUpload,MdOutlineDelete,MdOutlineEdit } from 'react-icons/md';

import { Book } from '@/types/book';
import { BookMetadata } from '@/libs/document';
import { useTranslation } from '@/hooks/useTranslation';
import {
  formatAuthors,
  formatDate,
  formatBytes,
  formatLanguage,
  formatPublisher,
  formatTitle,
  normalizeIdentifier,
} from '@/utils/book';
import BookCover from '../BookCover';

interface BookDetailViewProps {
  book: Book;
  metadata: BookMetadata;
  fileSize?: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onDeleteCloudBackup?: () => void;
  onDeleteLocalCopy?: () => void;
  onUpload?: () => void;
  showBtns?: boolean;
}

const BookDetailView: React.FC<BookDetailViewProps> = ({
  book,
  metadata,
  fileSize,
  onEdit,
  onDelete,
  onUpload,
  showBtns = true,
}) => {
  const _ = useTranslation();

  return (
    <div className='relative w-full rounded-lg'>
      <div className='mb-6 me-4 flex h-32 items-start'>
        <div className='me-10 aspect-[28/41] h-32 shadow-lg'>
          <BookCover mode='list' book={book} />
        </div>
        <div className='title-author flex h-32 flex-col justify-between'>
          <div>
            <p className='text-base-content mb-1 line-clamp-2 text-lg font-bold'>
              {formatTitle(book.title) || _('Untitled')}
            </p>
            <p className='text-neutral-content mb-1 line-clamp-1'>
              {formatTitle(metadata.subtitle || '')}
            </p>
            <p className='text-neutral-content line-clamp-1'>
              {metadata.series 
                ? `${metadata.series} ${metadata.seriesIndex || 1}/${metadata.seriesTotal || 1}` 
                : ''
              }
            </p>
            <p className='text-neutral-content line-clamp-1'>
              {formatAuthors(book.author, book.primaryLanguage) || _('Unknown')}
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-x-4'>
            {onEdit && showBtns && (
              <button onClick={onEdit} title={_('Edit Metadata')}>
                <MdOutlineEdit className='fill-base-content hover:fill-blue-500' />
              </button>
            )}
            {onDelete && showBtns && (
              <button onClick={onDelete} title={_('Delete from Device')}>
                <MdOutlineDelete className='fill-red-500 hover:fill-orange-500' />
              </button>
            )}
            {book.downloadedAt && onUpload && showBtns && (
              <button onClick={onUpload} title={_('Upload to Cloud')}>
                <MdOutlineCloudUpload className='fill-base-content hover:fill-blue-500' />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className='text-base-content my-4'>
        <div className='mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3'>
          <div className='overflow-hidden'>
            <span className='font-bold'>{_('Publisher')}</span>
            <p className='text-neutral-content text-sm'>
              {formatPublisher(metadata.publisher || '') || _('Unknown')}
            </p>
          </div>
          <div className='overflow-hidden'>
            <span className='font-bold'>{_('Published')}</span>
            <p className='text-neutral-content text-sm'>
              {formatDate(metadata.published, true) || _('Unknown')}
            </p>
          </div>
          <div className='overflow-hidden'>
            <span className='font-bold'>{_('Language')}</span>
            <p className='text-neutral-content text-sm'>
              {formatLanguage(metadata.language) || _('Unknown')}
            </p>
          </div>
          <div className='overflow-hidden'>
            <span className='font-bold'>{_('Identifier')}</span>
            <p className='text-neutral-content text-sm'>
              {normalizeIdentifier(metadata.identifier || '') || _('Unknown')}
            </p>
          </div>
          <div className='overflow-hidden'>
            <span className='font-bold'>{_('Format')}</span>
            <p className='text-neutral-content text-sm'>{book.format || _('Unknown')}</p>
          </div>
          <div className='overflow-hidden'>
            <span className='font-bold'>{_('File Size')}</span>
            <p className='text-neutral-content text-sm'>{formatBytes(fileSize) || _('Unknown')}</p>
          </div>
          <div className='overflow-hidden'>
            <span className='font-bold'>{_('Updated')}</span>
            <p className='text-neutral-content text-sm'>{formatDate(book.updatedAt) || ''}</p>
          </div>
          <div className='overflow-hidden'>
            <span className='font-bold'>{_('Added')}</span>
            <p className='text-neutral-content text-sm'>{formatDate(book.createdAt) || ''}</p>
          </div>
          <div className='overflow-hidden'>
            <span className='font-bold'>{_('Subjects')}</span>
            <p className='text-neutral-content line-clamp-3 text-sm'>
              {formatAuthors(metadata.subject || '') || _('Unknown')}
            </p>
          </div>
        </div>
        <div>
          <span className='font-bold'>{_('Description')}</span>
          <p
            className='text-neutral-content prose prose-sm max-w-full text-sm'
            dangerouslySetInnerHTML={{
              __html: metadata.description || _('No description available'),
            }}
          ></p>
        </div>
      </div>
    </div>
  );
};

export default BookDetailView;
