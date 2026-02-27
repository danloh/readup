import React, { useState } from 'react';
import { MdCollectionsBookmark, MdOutlineDelete, MdOutlineEdit } from 'react-icons/md';
import { LiaFileExportSolid } from 'react-icons/lia';

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
import ModalPortal from '@/components/ModalPortal';
import { useLibraryStore } from '@/store/libraryStore';
import { useEnv } from '@/context/EnvContext';
import BookCover from '../BookCover';

interface BookDetailViewProps {
  book: Book;
  metadata: BookMetadata | null;
  fileSize?: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onExport?: () => void;
  showBtns?: boolean;
}

const BookDetailView: React.FC<BookDetailViewProps> = ({
  book,
  metadata,
  fileSize,
  onEdit,
  onDelete,
  onExport,
  showBtns = true,
}) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { updateBook, addGroup } = useLibraryStore();
  
  const [showMarkDialog, setShowMarkDialog] = useState(false);
  const [newMark, setNewMark] = useState({ 
    group: book.groupName || '', 
    status: book.status || '',
  });

  const handleMarkBook = async () => {
    const group = newMark.group;
    const status = newMark.status.trim();
    let changed = true;
    // take blank group name as un-group
    if (!group && book.groupId) {
      book.groupId = '';
      book.groupName = '';
      book.updatedAt = Date.now();
    } else if (group && group !== book.groupName) {
      const newGroup = addGroup(group);
      book.groupId = newGroup.id;
      book.groupName = newGroup.name;
      book.updatedAt = Date.now();
    } else {
      changed = false;
    }
    
    if (status) {
      book.status = newMark.status;
      changed = true;
    } 
    handleCloseDialog();

    if (!changed) return;
    await updateBook(envConfig, book);
  };

  const handleCloseDialog = () => {
    setShowMarkDialog(false);
    // setNewMark({ group: '', status: '' });
  };

  return (
    <div className='relative w-full rounded-lg'>
      <div className='mb-6 me-4 flex h-32 items-start'>
        <div className='me-6 aspect-[28/41] h-32 shadow-lg'>
          <BookCover mode='list' book={book} />
        </div>
        <div className='title-author flex h-32 flex-col justify-between'>
          <div>
            <p className='text-base-content mb-1 line-clamp-2 break-words text-lg font-bold'>
              {formatTitle(book.title).replace(/\u00A0/g, ' ') || _('Untitled')}
            </p>
            <p className='text-neutral-content mb-1 line-clamp-1'>
              {formatTitle(metadata?.subtitle || '')}
            </p>
            <p className='text-neutral-content line-clamp-1'>
              {metadata?.series 
                ? `${metadata.series} ${metadata.seriesIndex || 1}/${metadata.seriesTotal || 1}` 
                : ''
              }
            </p>
            <p className='text-neutral-content line-clamp-1'>
              {formatAuthors(book.author, book.primaryLanguage) || _('Unknown')}
            </p>
            {(book.groupName || book.status) && (
              <p className='bg-base-200 px-2 py-1 rounded text-[10px] my-1 line-clamp-1'>
                {book.groupName || ''} {book.status || ''}
              </p>
            )}
          </div>
         <div className='flex flex-nowrap items-center gap-2 sm:gap-x-4'>
            {onEdit && showBtns && (
              <button
                onClick={onEdit}
                className={!metadata ? 'btn-disabled opacity-50' : ''}
                title={_('Edit Metadata')}
              >
                <MdOutlineEdit className='hover:fill-blue-500' />
              </button>
            )}
            {showBtns && (
              <button onClick={() => setShowMarkDialog(!showMarkDialog)} title={_('Mark')}>
                <MdCollectionsBookmark className='hover:fill-green-500' />
              </button>
            )}
            {book.downloadedAt && showBtns && onExport && (
              <button onClick={onExport} title={_('Export Book')}>
                <LiaFileExportSolid className='hover:fill-purple-500' />
              </button>
            )}
            {onDelete && showBtns && (
              <button onClick={onDelete} title={_('Delete from Device')}>
                <MdOutlineDelete className='fill-red-500 hover:fill-orange-500' />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className='text-base-content my-4'>
        <div className='mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3'>
          <div className='overflow-hidden pe-1 text-end sm:text-start'>
            <span className='font-bold'>{_('Publisher')}</span>
            <p className='text-neutral-content text-sm'>
              {formatPublisher(metadata?.publisher || '') || _('Unknown')}
            </p>
          </div>
          <div className='overflow-hidden pe-1 text-end sm:text-start'>
            <span className='font-bold'>{_('Published')}</span>
            <p className='text-neutral-content text-sm'>
              {formatDate(metadata?.published, true) || _('Unknown')}
            </p>
          </div>
          <div className='overflow-hidden pe-1 text-end sm:text-start'>
            <span className='font-bold'>{_('Language')}</span>
            <p className='text-neutral-content text-sm'>
              {formatLanguage(metadata?.language) || _('Unknown')}
            </p>
          </div>
          <div className='overflow-hidden pe-1 text-end sm:text-start'>
            <span className='font-bold'>{_('Identifier')}</span>
            <p className='text-neutral-content text-sm'>
              {normalizeIdentifier(metadata?.identifier || '') || _('Unknown')}
            </p>
          </div>
          <div className='overflow-hidden pe-1 text-end sm:text-start'>
            <span className='font-bold'>{_('Format')}</span>
            <p className='text-neutral-content text-sm'>{book.format || _('Unknown')}</p>
          </div>
          <div className='overflow-hidden pe-1 text-end sm:text-start'>
            <span className='font-bold'>{_('File Size')}</span>
            <p className='text-neutral-content text-sm'>{formatBytes(fileSize) || _('Unknown')}</p>
          </div>
          <div className='overflow-hidden pe-1 text-end sm:text-start'>
            <span className='font-bold'>{_('Updated')}</span>
            <p className='text-neutral-content text-sm'>{formatDate(book.updatedAt) || ''}</p>
          </div>
          <div className='overflow-hidden pe-1 text-end sm:text-start'>
            <span className='font-bold'>{_('Added')}</span>
            <p className='text-neutral-content text-sm'>{formatDate(book.createdAt) || ''}</p>
          </div>
          <div className='overflow-hidden pe-1 text-end sm:text-start'>
            <span className='font-bold'>{_('Subjects')}</span>
            <p className='text-neutral-content line-clamp-3 text-sm'>
              {formatAuthors(metadata?.subject || '') || _('Unknown')}
            </p>
          </div>
        </div>
        <div>
          <span className='font-bold'>{_('Description')}</span>
          <p
            className='text-neutral-content prose prose-sm max-w-full text-sm'
            dangerouslySetInnerHTML={{
              __html: metadata?.description || _('No description available'),
            }}
          ></p>
        </div>
      </div>

      {/* Mark Book Dialog */}
      {showMarkDialog && (
        <ModalPortal>
          <dialog className='modal modal-open'>
            <div className='modal-box'>
              <h3 className='mb-4 text-lg font-bold'>{_('Mark the Book')}</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleMarkBook();
                }}
                className='space-y-4'
              >
                <div className='form-control'>
                  <div className='label'>
                    <span className='label-text'>{_('Group Name')}</span>
                  </div>
                  <input
                    type='text'
                    value={newMark.group}
                    onChange={(e) => setNewMark({ ...newMark, group: e.target.value.trim() })}
                    placeholder={_('Collect Book in Group')}
                    className='input input-bordered placeholder:text-sm'
                  />
                </div>
                <div className='form-control'>
                  <div className='label'>
                    <span className='label-text'>{_('Status')}</span>
                  </div>
                  <input
                    type='text'
                    list='status-options'
                    value={newMark.status}
                    onChange={(e) => setNewMark({ ...newMark, status: e.target.value.trim() })}
                    placeholder={_('Status: todo, doing, done, ...')}
                    className='input input-bordered placeholder:text-sm'
                  />
                  <datalist id="status-options">
                    {['Todo', 'Doing', 'Done'].map((val) => (
                      <option key={val} value={_(val)}></option>
                    ))}
                  </datalist>
                  {/* <select
                    value={newMark.status}
                    onChange={(e) => setNewMark({ ...newMark, status: e.target.value.trim() })}
                    onKeyDown={(e) => e.stopPropagation()}
                    className='select bg-base-200 h-8 min-h-8 rounded-md border-none text-sm'
                  >
                    {['Todo', 'Doing', 'Done'].map((val) => (
                      <option key={val} value={val}>{_(val)}</option>
                    ))}
                  </select> */}
                </div>
                <div className='modal-action'>
                  <button
                    type='button'
                    onClick={handleCloseDialog}
                    className='btn btn-sm'
                  >
                    {_('Cancel')}
                  </button>
                  <button type='submit' className='btn btn-sm btn-primary'>
                    {_('Mark')}
                  </button>
                </div>
              </form>
            </div>
          </dialog>
        </ModalPortal>
      )}
    </div>
  );
};

export default BookDetailView;
