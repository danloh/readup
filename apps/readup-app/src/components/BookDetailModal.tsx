import clsx from 'clsx';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MdOutlineDelete,
  MdOutlineCloudDownload,
  MdOutlineCloudUpload,
  MdOutlineCloudOff,
} from 'react-icons/md';

import { eventDispatcher } from '@/utils/event';
import { useLibraryStore } from '@/store/libraryStore';
import { navigateToLogin } from '@/utils/nav';
import { Book } from '@/types/book';
import { BookDoc } from '@/libs/document';
import { useEnv } from '@/context/EnvContext';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  formatAuthors,
  formatDate,
  formatFileSize,
  formatLanguage,
  formatPublisher,
  formatSubject,
  formatTitle,
} from '@/utils/book';
import Alert from '@/components/Alert';
import Dialog from './Dialog';
import Spinner from './Spinner';
import BookCover from './BookCover';

interface DetailModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  showBtns?: boolean;
}

const BookDetailModal = ({ book, isOpen, onClose, showBtns = true }: DetailModalProps) => {
  const _ = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showDeleteCloudBackupAlert, setShowDeleteCloudBackupAlert] = useState(false);
  const [bookMeta, setBookMeta] = useState<BookDoc['metadata'] | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const { envConfig, appService } = useEnv();
  const { settings, setSettings } = useSettingsStore();

  const { updateBook } = useLibraryStore();

  useEffect(() => {
    const loadingTimeout = setTimeout(() => setLoading(true), 300);
    const fetchBookDetails = async () => {
      const appService = await envConfig.getAppService();
      try {
        const details = await appService.fetchBookDetails(book, settings);
        const size = await appService.getBookFileSize(book);
        setBookMeta(details);
        setFileSize(size);
      } finally {
        if (loadingTimeout) clearTimeout(loadingTimeout);
        setLoading(false);
      }
    };
    fetchBookDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book]);

  const handleClose = () => {
    setBookMeta(null);
    onClose();
  };

  const handleDelete = () => {
    setShowDeleteAlert(true);
  };

  const handleDeleteCloudBackup = () => {
    setShowDeleteCloudBackupAlert(true);
  };

  const onBookUpload = async (book: Book) => {
    try {
      await appService?.uploadBook(book);
      await updateBook(envConfig, book);

      eventDispatcher.dispatch('toast', {
        type: 'info',
        timeout: 2000,
        message: _('Book uploaded: {{title}}', {
          title: book.title,
        }),
      });
      return true;
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Not authenticated') && settings.keepLogin) {
          settings.keepLogin = false;
          setSettings(settings);
          navigateToLogin(router);
          return false;
        } else if (err.message.includes('Insufficient storage quota')) {
          eventDispatcher.dispatch('toast', {
            type: 'error',
            message: _('Insufficient storage quota'),
          });
          return false;
        }
      }
      eventDispatcher.dispatch('toast', {
        type: 'error',
        message: _('Failed to upload book: {{title}}', {
          title: book.title,
        }),
      });
      return false;
    }
  };

  const onBookDownload = async (book: Book) => {
    try {
      await appService?.downloadBook(book, false);
      await updateBook(envConfig, book);
      eventDispatcher.dispatch('toast', {
        type: 'info',
        timeout: 2000,
        message: _('Book downloaded: {{title}}', {
          title: book.title,
        }),
      });
      return true;
    } catch {
      eventDispatcher.dispatch('toast', {
        message: _('Failed to download book: {{title}}', {
          title: book.title,
        }),
        type: 'error',
      });
      return false;
    }
  };

  const onBookDelete = async (book: Book) => {
    try {
      await appService?.deleteBook(book, !!book.uploadedAt, true);
      await updateBook(envConfig, book);
      
      eventDispatcher.dispatch('toast', {
        type: 'info',
        timeout: 2000,
        message: _('Book deleted: {{title}}', {
          title: book.title,
        }),
      });
      return true;
    } catch {
      eventDispatcher.dispatch('toast', {
        message: _('Failed to delete book: {{title}}', {
          title: book.title,
        }),
        type: 'error',
      });
      return false;
    }
  };

  const onBookDeleteCloudBackup = async (book: Book) => {
    try {
      await appService?.deleteBook(book, !!book.uploadedAt, false);
      await updateBook(envConfig, book);
      
      eventDispatcher.dispatch('toast', {
        type: 'info',
        timeout: 2000,
        message: _('Deleted cloud backup of the book: {{title}}', {
          title: book.title,
        }),
      });
      return true;
    } catch (e) {
      console.error(e);
      eventDispatcher.dispatch('toast', {
        type: 'error',
        message: _('Failed to delete cloud backup of the book', {
          title: book.title,
        }),
      });
      return false;
    }
  };

  const confirmDelete = async () => {
    handleClose();
    setShowDeleteAlert(false);
    onBookDelete(book);
  };

  const confirmDeleteCloudBackup = async () => {
    handleClose();
    setShowDeleteCloudBackupAlert(false);
    onBookDeleteCloudBackup(book);
  };

  const handleRedownload = async () => {
    handleClose();
    onBookDownload(book);
  };

  const handleReupload = async () => {
    handleClose();
    onBookUpload(book);
  };

  if (!bookMeta)
    return (
      loading && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <Spinner loading />
        </div>
      )
    );

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      <Dialog
        title={_('Book Details')}
        isOpen={isOpen}
        onClose={handleClose}
        bgClassName='sm:bg-black/50'
        boxClassName='sm:min-w-[480px] sm:max-w-[480px] sm:h-auto sm:max-h-[90%]'
        contentClassName='!px-6 !py-2'
      >
        <div className='flex w-full select-text items-center justify-center'>
          <div className='relative w-full rounded-lg'>
            <div className='mb-6 me-4 flex h-32 items-start'>
              <div className='me-10 aspect-[28/41] h-32 shadow-lg'>
                <BookCover mode='list' book={book} />
              </div>
              <div className='title-author flex h-32 flex-col justify-between'>
                <div>
                  <p className='text-base-content mb-2 line-clamp-2 break-all text-lg font-bold'>
                    {formatTitle(book.title) || _('Untitled')}
                  </p>
                  <p className='text-neutral-content line-clamp-1'>
                    {formatAuthors(book.author, book.primaryLanguage) || _('Unknown')}
                  </p>
                </div>
                {showBtns && (
                  <div className='flex flex-wrap items-center gap-x-4'>
                    <button onClick={handleDelete}>
                      <MdOutlineDelete className='fill-red-500' />
                    </button>
                    {book.uploadedAt && (
                      <button onClick={handleDeleteCloudBackup}>
                        <MdOutlineCloudOff className='fill-red-500' />
                      </button>
                    )}
                    {book.uploadedAt && (
                      <button onClick={handleRedownload}>
                        <MdOutlineCloudDownload className='fill-base-content' />
                      </button>
                    )}
                    {book.downloadedAt && (
                      <button onClick={handleReupload}>
                        <MdOutlineCloudUpload className='fill-base-content' />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className='text-base-content my-4'>
              <div className='mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3'>
                <div className='overflow-hidden'>
                  <span className='font-bold'>{_('Publisher:')}</span>
                  <p className='text-neutral-content text-sm'>
                    {formatPublisher(bookMeta.publisher || '') || _('Unknown')}
                  </p>
                </div>
                <div className='overflow-hidden'>
                  <span className='font-bold'>{_('Published:')}</span>
                  <p className='text-neutral-content text-sm'>
                    {formatDate(bookMeta.published) || _('Unknown')}
                  </p>
                </div>
                <div className='overflow-hidden'>
                  <span className='font-bold'>{_('Updated:')}</span>
                  <p className='text-neutral-content text-sm'>{formatDate(book.updatedAt) || ''}</p>
                </div>
                <div className='overflow-hidden'>
                  <span className='font-bold'>{_('Added:')}</span>
                  <p className='text-neutral-content text-sm'>{formatDate(book.createdAt) || ''}</p>
                </div>
                <div className='overflow-hidden'>
                  <span className='font-bold'>{_('Language:')}</span>
                  <p className='text-neutral-content text-sm'>
                    {formatLanguage(bookMeta.language) || _('Unknown')}
                  </p>
                </div>
                <div className='overflow-hidden'>
                  <span className='font-bold'>{_('Subjects:')}</span>
                  <p className='text-neutral-content line-clamp-3 text-sm'>
                    {formatSubject(bookMeta.subject) || _('Unknown')}
                  </p>
                </div>
                <div className='overflow-hidden'>
                  <span className='font-bold'>{_('Format:')}</span>
                  <p className='text-neutral-content text-sm'>{book.format || _('Unknown')}</p>
                </div>
                <div className='overflow-hidden'>
                  <span className='font-bold'>{_('File Size:')}</span>
                  <p className='text-neutral-content text-sm'>
                    {formatFileSize(fileSize) || _('Unknown')}
                  </p>
                </div>
              </div>
              <div>
                <span className='font-bold'>{_('Description:')}</span>
                <p
                  className='text-neutral-content prose prose-sm text-sm'
                  dangerouslySetInnerHTML={{
                    __html: bookMeta.description || _('No description available'),
                  }}
                ></p>
              </div>
            </div>
          </div>
        </div>
      </Dialog>
      {showDeleteAlert && (
        <div
          className={clsx(
            'fixed bottom-0 left-0 right-0 z-50 flex justify-center',
            'pb-[calc(env(safe-area-inset-bottom)+16px)]',
          )}
        >
          <Alert
            title={_('Confirm Deletion')}
            message={_('Are you sure to delete the selected book?')}
            onCancel={() => {
              setShowDeleteAlert(false);
            }}
            onConfirm={confirmDelete}
          />
        </div>
      )}
      {showDeleteCloudBackupAlert && (
        <div
          className={clsx(
            'fixed bottom-0 left-0 right-0 z-50 flex justify-center',
            'pb-[calc(env(safe-area-inset-bottom)+16px)]',
          )}
        >
          <Alert
            title={_('Confirm Deletion')}
            message={_('Are you sure to delete the cloud backup of the selected book?')}
            onCancel={() => {
              setShowDeleteAlert(false);
            }}
            onConfirm={confirmDeleteCloudBackup}
          />
        </div>
      )}
    </div>
  );
};

export default BookDetailModal;
