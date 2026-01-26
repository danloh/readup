import clsx from 'clsx';
import React, { useCallback, useState } from 'react';
import {
  MdClose,
  MdRefresh,
  MdPause,
  MdPlayArrow,
  MdCloudUpload,
  MdCloudDownload,
  MdCheckCircle,
  MdError,
  MdCancel,
  MdDeleteSweep,
  MdDeleteForever,
} from 'react-icons/md';

import { useTransferQueue } from '@/hooks/useTransferQueue';
import { useTranslation } from '@/hooks/useTranslation';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { useKeyDownActions } from '@/hooks/useKeyDownActions';
import { useLibraryStore } from '@/store/libraryStore';
import { 
  TransferItem, TransferStatus, TransferType, useTransferStore 
} from '@/store/transferStore';
import { Book } from '@/types/book';
import { formatBytes } from '@/utils/book';
import { useEnv } from '@/context/EnvContext';
import { useAuth } from '@/context/AuthContext';
import { eventDispatcher } from '@/utils/event';

const formatSpeed = (bytesPerSec: number): string => {
  return `${formatBytes(bytesPerSec) || '0 B'}/s`;
};

const formatDateTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return timeStr;
  } else if (isYesterday) {
    return `Yesterday ${timeStr}`;
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + timeStr;
  }
};

const StatusIcon: React.FC<{
  status: TransferStatus;
  type: 'upload' | 'download' | 'delete';
  size: number;
}> = ({ status, type, size }) => {
  switch (status) {
    case 'completed':
      return <MdCheckCircle className='text-success' size={size} />;
    case 'failed':
      return <MdError className='text-error' size={size} />;
    case 'cancelled':
      return <MdCancel className='text-warning' size={size} />;
    case 'in_progress':
    case 'pending':
    default:
      return type === 'upload' ? (
        <MdCloudUpload className='text-primary' size={size} />
      ) : type === 'delete' ? (
        <MdDeleteSweep className='text-primary' size={size} />
      ) : (
        <MdCloudDownload className='text-primary' size={size} />
      );
  }
};

const TransferItemRow: React.FC<{
  transfer: TransferItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onQueue: (book: Book, priority?: number) => void;
  iconSize: number;
  onQueueDelete?: (book: Book, priority?: number) => void;
}> = ({ transfer, onCancel, onRetry, onQueue, iconSize, onQueueDelete }) => {
  const _ = useTranslation();

  const completedLabel = {
    upload: _('Uploaded'),
    download: _('Downloaded'),
    delete: _('Deleted'),
  };

  return (
    <div className='hover:bg-base-200 flex items-center gap-3 rounded-lg p-3'>
      <StatusIcon status={transfer.status} type={transfer.type} size={iconSize} />
      <div className='min-w-0 flex-1'>
        <div className='truncate font-medium'>{transfer.bookTitle}</div>
        <div className='inline-flex gap-1 text-base-content/60 text-xs'>
          {(transfer.book?.fileSize || 0) > 0 && (
            <span className='text-info'>{formatBytes(transfer.book?.fileSize)}</span>
          )}
          {transfer.status === 'in_progress' && (
            <>
              {Math.round(transfer.progress)}% - {formatSpeed(transfer.transferSpeed)}
            </>
          )}
          {transfer.status === 'pending' && transfer.error && (
            <span className='text-warning'>{transfer.error}</span>
          )}
          {transfer.status === 'pending' && !transfer.error && _('Waiting...')}
          {transfer.status === 'failed' && (
            <span className='text-error'>{transfer.error || _('Failed')}</span>
          )}
          {transfer.status === 'completed' && (completedLabel[transfer.type] || _('Completed'))}
          {transfer.status === 'cancelled' && _('Cancelled')}
          {transfer.type === 'upload' 
            ? (<span className='text-info'><MdCloudUpload size={14} /></span>) 
            : (<span className='text-info'><MdCloudDownload size={14} /></span>)
          }
          {' · '}
          {formatDateTime(transfer.completedAt || transfer.startedAt || transfer.createdAt)}
          {onQueueDelete && transfer.book && transfer.type === 'download' && (
            <button
              onClick={() => {
                console.log('To delete in PDS');
                onQueueDelete(transfer.book!);
              }}
              className='link text-warning ml-2'
              title={_('Delete in PDS')}
            >
              <MdDeleteForever size={16} />
            </button>
          )}
        </div>

        {transfer.status === 'in_progress' && (
          <div className='bg-base-300 mt-1 h-1.5 w-full overflow-hidden rounded-full'>
            <div
              className='bg-primary h-full transition-all'
              style={{ width: `${transfer.progress}%` }}
            />
          </div>
        )}
      </div>

      <div className='flex items-center gap-1'>
        {(transfer.status === 'failed' || transfer.status === 'cancelled') && (
          <button
            onClick={() => onRetry(transfer.id)}
            className='btn btn-ghost btn-sm btn-circle'
            aria-label={_('Retry')}
          >
            <MdRefresh size={iconSize} />
          </button>
        )}
        {['pending', 'in_progress'].includes(transfer.status) && (
          <button
            onClick={() => onCancel(transfer.id)}
            className='btn btn-ghost btn-sm btn-circle'
            aria-label={_('Cancel')}
          >
            <MdClose size={iconSize} />
          </button>
        )}
        {transfer.status === 'can' && transfer.book && !transfer.book.uploadedAt && (
          <button
            onClick={() => onQueue(transfer.book!)}
            className='btn btn-ghost btn-sm btn-circle'
            aria-label={_('Queue')}
          >
            {transfer.type === 'upload' 
              ? (<MdCloudUpload size={iconSize} />) 
              : (<MdCloudDownload size={iconSize} />)
            }
          </button>
        )}
      </div>
    </div>
  );
};

type FilterType = 'all' | 'active' | 'pending' | 'completed' | 'failed' | 'pds';

const TransferQueuePanel: React.FC = () => {
  const _ = useTranslation();
  const { user } = useAuth();
  const { appService } = useEnv();
  const iconSize = useResponsiveSize(20);
  const setIsOpen = useTransferStore((state) => state.setIsTransferQueueOpen);
  const { setLibrary, getVisibleLibrary } = useLibraryStore();
  const {
    transfers,
    stats,
    isQueuePaused,
    cancelTransfer,
    retryTransfer,
    retryAllFailed,
    pauseQueue,
    resumeQueue,
    clearCompleted,
    clearFailed,
    queueUpload,
    queueDownload,
    queueDelete, 
  } = useTransferQueue();

  const [filter, setFilter] = useState<FilterType>('all');

  const onClose = () => setIsOpen(false);
  const divRef = useKeyDownActions({ onCancel: onClose, onConfirm: onClose });

  const booksToTransfers = (books: Book[], typ: TransferType) => books.map(
    (book) => {
      const canTransfer: TransferItem = {
        id: book.hash,
        bookHash: book.hash,
        bookTitle: book.title,
        type: typ,
        status: 'can',
        progress: 0,
        totalBytes: book.fileSize || 0,
        transferredBytes: 0,
        transferSpeed: 0,
        retryCount: 0,
        maxRetries: 3,
        createdAt: book.createdAt || Date.now(),
        priority: 100,
        isBackground: false,
        book,
      };
      return canTransfer;
    }
  );

  // all books as temp tranfer items
  const allCanTransfer = booksToTransfers(getVisibleLibrary(), 'upload');
  const [pdsBooksToDownload, setPdsBooksToDownload] = useState<Book[]>([]);
  const [pdsLoaded, setPdsLoaded] = useState(false);
  const [pdsCanTransfer, setPdsCanTransfer] = useState<TransferItem[]>([]);
  const booksToUpload = getVisibleLibrary().filter(
    (book) => book.downloadedAt && !book.uploadedAt
  );

  const listBooksInPds = async () => {
    console.log('List books record in PDS...');
    const res = await appService?.listPdsBooks();
    const books = res ? res[0] : [];
    const libraryBooks = res ? res[1] : [];
    // save to library? 
    setLibrary(libraryBooks);
    setPdsBooksToDownload(books);
    setPdsCanTransfer(booksToTransfers(books, 'download'));
    setPdsLoaded(true);
  };

  const handleSetFilter = useCallback(
    async (f: FilterType) => {
      if (f === 'pds' && !user) {
        eventDispatcher.dispatch('toast', {
          type: 'error',
          timeout: 10000,
          message: _('Need to Log in'),
        });
        console.log('Not Auth');
      }
      if (f === 'pds' && user && !pdsLoaded) {
        await listBooksInPds();
      }
      setFilter(f);
    }, [],
  );

  const handleUploadAll = () => {
    booksToUpload.forEach((book) => queueUpload(book));
  };

  const handleDownloadAll = () => {
    pdsBooksToDownload.forEach((book) => queueDownload(book));
  };

  const toFilterItems = filter === 'all' 
    ? allCanTransfer 
    : filter === 'pds' 
      ? pdsCanTransfer 
      : transfers;
  const filteredTransfers = toFilterItems
    .filter((t) => {
      switch (filter) {
        case 'active':
          return ['pending', 'in_progress'].includes(t.status);
        case 'pending':
          return t.status === 'pending';
        case 'completed':
          return t.status === 'completed';
        case 'failed':
          return t.status === 'failed' || t.status === 'cancelled';
        default:
          return true;
      }
    })
    .sort((a, b) => {
      // Sort by status priority then by createdAt
      const statusOrder: Record<TransferStatus, number> = {
        in_progress: 0,
        pending: 1,
        failed: 2,
        cancelled: 3,
        completed: 4,
        can: 10, // just for temp 
      };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return b.createdAt - a.createdAt;
    });

  const filterLabels: Record<FilterType, string> = {
    all: _('All'),
    active: _('Active'),
    pending: _('Pending'),
    completed: _('Completed'),
    failed: _('Failed'),
    pds: _('PDS'),
  };

  const getStat = (f: FilterType) => {
    switch (f) {
      case 'active':
        return stats.active;
      case 'pending':
        return stats.pending;
      case 'completed':
        return stats.completed;
      case 'failed':
        return stats.failed;
      case 'pds':
        return pdsCanTransfer.length;
      default:
        return allCanTransfer.length;
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className='absolute inset-0 bg-black/50' onClick={onClose} />
      <div
        ref={divRef}
        className={clsx(
          'modal-box bg-base-100 relative flex max-h-[85%] min-h-[65%] w-[95%] flex-col rounded-2xl p-0 shadow-xl',
          'min-w-64 max-w-lg overflow-hidden',
        )}
      >
        {/* Header */}
        <div className='border-base-300 flex items-center justify-between border-b p-4'>
          <h2 className='text-lg font-semibold'>{_('Transfer Queue')}</h2>
          <div className='flex items-center gap-2'>
            {booksToUpload.length > 0 && (
              <button
                onClick={handleUploadAll}
                className='btn btn-ghost btn-sm gap-1'
                title={_('Upload All')}
                aria-label={_('Upload All')}
              >
                <MdCloudUpload size={iconSize} className='text-primary' />
                <span className='text-xs'>{booksToUpload.length}</span>
              </button>
            )}
            {pdsBooksToDownload.length > 0 && (
              <button
                onClick={handleDownloadAll}
                className='btn btn-ghost btn-sm gap-1'
                title={_('Download All')}
                aria-label={_('Download All')}
              >
                <MdCloudDownload size={iconSize} className='text-secondary' />
                <span className='text-xs'>{pdsBooksToDownload.length}</span>
              </button>
            )}
            <button
              onClick={isQueuePaused ? resumeQueue : pauseQueue}
              className='btn btn-ghost btn-sm btn-circle'
              title={isQueuePaused ? _('Resume Transfers') : _('Pause Transfers')}
              aria-label={isQueuePaused ? _('Resume Transfers') : _('Pause Transfers')}
            >
              {isQueuePaused ? <MdPlayArrow size={iconSize} /> : <MdPause size={iconSize} />}
            </button>
            <button
              onClick={onClose}
              className='btn btn-ghost btn-sm btn-circle'
              title={_('Close')}
              aria-label={_('Close')}
            >
              <MdClose size={iconSize} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className='border-base-300 flex gap-2 border-b p-2'>
          {(['all', 'active', 'pending', 'completed', 'failed', 'pds'] as const).map((f) => (
            <button
              key={f}
              onClick={() => handleSetFilter(f)}
              className={clsx(
                'rounded-sm px-2 py-1 text-sm transition-colors',
                filter === f ? 'bg-primary text-primary-content' : 'bg-base-200 hover:bg-base-300',
              )}
            >
              {filterLabels[f]}: {getStat(f)}
            </button>
          ))}
        </div>

        {/* Transfer list */}
        <div className='flex-1 overflow-y-auto p-2'>
          {filteredTransfers.length === 0 ? (
            <div className='text-base-content/60 py-8 text-center'>{_('No transfers')}</div>
          ) : (
            filteredTransfers.map((transfer) => (
              <TransferItemRow
                key={transfer.id}
                transfer={transfer}
                onCancel={cancelTransfer}
                onRetry={retryTransfer}
                onQueue={transfer.type === 'upload' ? queueUpload : queueDownload}
                onQueueDelete={
                  transfer.book && transfer.type === 'download'
                    ? queueDelete 
                    : undefined
                }
                iconSize={iconSize}
              />
            ))
          )}
        </div>

        {/* Footer actions */}
        <div className='border-base-300 flex items-center justify-between border-t p-4'>
          <div className='flex items-center gap-2'>
            {stats.failed > 0 && (
              <button onClick={retryAllFailed} className='btn btn-ghost btn-sm gap-1'>
                <MdRefresh size={iconSize - 2} />
                {_('Retry All')}
              </button>
            )}
          </div>
          <div className='flex items-center gap-2'>
            {stats.completed > 0 && (
              <button onClick={clearCompleted} className='btn btn-ghost btn-sm gap-1'>
                <MdDeleteSweep size={iconSize - 2} />
                {_('Clear Completed')}
              </button>
            )}
            {stats.failed > 0 && (
              <button onClick={clearFailed} className='btn btn-ghost btn-sm gap-1'>
                <MdDeleteSweep size={iconSize - 2} />
                {_('Clear Failed')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferQueuePanel;
