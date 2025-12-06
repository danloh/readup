import clsx from 'clsx';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Book } from '@/types/book';
import { formatAuthors, formatTitle, getPrimaryLanguage } from '@/utils/book';
import { isWebAppPlatform } from '@/services/environment';
import { useLibraryStore } from '@/store/libraryStore';
import { eventDispatcher } from '@/utils/event';
import { navigateToLogin } from '@/utils/nav';
import { BookMetadata } from '@/libs/document';
import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useTranslation } from '@/hooks/useTranslation';
import Alert from '@/components/Alert';
import Dialog from '@/components/Dialog';
import Spinner from '@/components/Spinner';
import { useMetadataEdit } from './useMetadataEdit';
import BookDetailView from './BookDetailView';
import BookDetailEdit from './BookDetailEdit';
import SourceSelector from './SourceSelector';

interface BookDetailModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  showBtns?: boolean;
}

const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  isOpen,
  onClose,
  showBtns,
}) => {
  const _ = useTranslation();
  const { envConfig, appService } = useEnv();
  const router = useRouter();
  const { safeAreaInsets } = useThemeStore();
  const [loading, setLoading] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [bookMeta, setBookMeta] = useState<BookMetadata | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const { settings, setSettings } = useSettingsStore();
  const { updateBook } = useLibraryStore();
  const { clearBookData } = useBookDataStore();

  // Initialize metadata edit hook
  const {
    editedMeta,
    fieldSources,
    lockedFields,
    fieldErrors,
    searchLoading,
    showSourceSelection,
    availableSources,
    handleFieldChange,
    handleToggleFieldLock,
    handleLockAll,
    handleUnlockAll,
    handleAutoRetrieve,
    handleSourceSelection,
    handleCloseSourceSelection,
    resetToOriginal,
  } = useMetadataEdit(bookMeta);

  useEffect(() => {
    const loadingTimeout = setTimeout(() => setLoading(true), 300);
    const fetchBookDetails = async () => {
      const appService = await envConfig.getAppService();
      try {
        const details = book.metadata || (await appService.fetchBookDetails(book));
        setBookMeta(details);
        const size = await appService.getBookFileSize(book);
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
    setEditMode(false);
    onClose();
  };

  const handleEditMetadata = () => {
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    resetToOriginal();
    setEditMode(false);
  };

  const handleBookMetadataUpdate = async (book: Book, metadata: BookMetadata) => {
    book.metadata = metadata;
    book.title = formatTitle(metadata.title);
    book.author = formatAuthors(metadata.author);
    book.primaryLanguage = getPrimaryLanguage(metadata.language);
    book.updatedAt = Date.now();
    if (metadata.coverImageBlobUrl || metadata.coverImageUrl || metadata.coverImageFile) {
      book.coverImageUrl = metadata.coverImageBlobUrl || metadata.coverImageUrl;
      try {
        await appService?.updateCoverImage(
          book,
          metadata.coverImageBlobUrl || metadata.coverImageUrl,
          metadata.coverImageFile,
        );
      } catch (error) {
        console.warn('Failed to update cover image:', error);
      }
    }
    if (isWebAppPlatform()) {
      // Clear HTTP cover image URL if cover is updated with a local file
      if (metadata.coverImageBlobUrl) {
        metadata.coverImageUrl = undefined;
      }
    } else {
      metadata.coverImageUrl = undefined;
    }
    metadata.coverImageBlobUrl = undefined;
    metadata.coverImageFile = undefined;
    await updateBook(envConfig, book);
  };

  const handleSaveMetadata = () => {
    if (editedMeta && handleBookMetadataUpdate) {
      setBookMeta({ ...editedMeta });
      handleBookMetadataUpdate(book, editedMeta);
      setEditMode(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteAlert(true);
  };

  const handleBookDelete = async (book: Book) => {
    try {
      await appService?.deleteBook(book, 'local');
      await updateBook(envConfig, book);
      clearBookData(book.hash);
      // if (syncBooks) pushLibrary(); // FIXME
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
  
  const confirmDeleteAction = async () => {
    handleClose();
    setShowDeleteAlert(false);
    handleBookDelete(book);
  };

  const cancelDeleteAction = () => {
    setShowDeleteAlert(false);
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

  const onBookDownload = useCallback(
    async (book: Book, redownload = false) => {
      try {
        await appService?.downloadBook(book, false, redownload);
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
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appService],
  );

  const handleRedownload = async () => {
    handleClose();
    onBookDownload(book, true);
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
    <>
      <div className='fixed inset-0 z-50 flex items-center justify-center'>
        <Dialog
          title={editMode ? _('Edit Metadata') : _('Book Details')}
          isOpen={isOpen}
          onClose={handleClose}
          boxClassName={clsx(
            editMode ? 'sm:min-w-[600px] sm:max-w-[600px]' : 'sm:min-w-[480px] sm:max-w-[480px]',
            'sm:h-auto sm:max-h-[90%]',
          )}
          contentClassName='!px-6 !py-4'
        >
          <div className='flex w-full select-text items-start justify-center'>
            {editMode ? (
              <BookDetailEdit
                book={book}
                metadata={editedMeta}
                fieldSources={fieldSources}
                lockedFields={lockedFields}
                fieldErrors={fieldErrors}
                searchLoading={searchLoading}
                onFieldChange={handleFieldChange}
                onToggleFieldLock={handleToggleFieldLock}
                onAutoRetrieve={handleAutoRetrieve}
                onLockAll={handleLockAll}
                onUnlockAll={handleUnlockAll}
                onCancel={handleCancelEdit}
                onReset={resetToOriginal}
                onSave={handleSaveMetadata}
              />
            ) : (
              <BookDetailView
                book={book}
                metadata={bookMeta}
                fileSize={fileSize}
                onEdit={handleEditMetadata}
                onDelete={handleDelete}
                onDownload={handleRedownload}
                onUpload={handleReupload}
                showBtns={showBtns}
              />
            )}
          </div>
        </Dialog>

        {/* Source Selection Modal */}
        {showSourceSelection && (
          <SourceSelector
            sources={availableSources}
            isOpen={showSourceSelection}
            onSelect={handleSourceSelection}
            onClose={handleCloseSourceSelection}
          />
        )}

        {showDeleteAlert && (
          <div
            className={clsx('fixed bottom-0 left-0 right-0 z-50 flex justify-center')}
            style={{
              paddingBottom: `${(safeAreaInsets?.bottom || 0) + 16}px`,
            }}
          >
            <Alert
              title={_('Confirm Deletion')}
              message={_('Are you sure to delete the selected book?')}
              onCancel={cancelDeleteAction}
              onConfirm={confirmDeleteAction}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default BookDetailModal;
