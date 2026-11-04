import clsx from 'clsx';
import React, { useState } from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import { useKeyDownActions } from '@/hooks/useKeyDownActions';
import Dialog from '@/components/Dialog';

interface ImportFeedDialogProps {
  onCancel: () => void;
  /** Fetch the feed and import it. Rejects with a user-facing message on failure. */
  onSubmit: (url: string) => Promise<void>;
}

/**
 * Ask for an RSS / Atom / JSON Feed URL. Submitting a URL that was imported
 * before appends the feed's new articles to the existing book.
 */
const ImportFeedDialog: React.FC<ImportFeedDialogProps> = ({ onCancel, onSubmit }) => {
  const _ = useTranslation();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const trimmed = url.trim();
  const confirmDisabled = busy || !trimmed;

  const handleConfirm = async () => {
    if (confirmDisabled) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  useKeyDownActions({
    onConfirm: handleConfirm,
    onCancel: () => {
      if (!busy) onCancel();
    },
  });

  return (
    <Dialog
      isOpen
      title={_('Import from Feed')}
      onClose={() => !busy && onCancel()}
      boxClassName='sm:min-w-[480px] sm:max-w-[480px] sm:h-auto sm:max-h-[90%]'
      contentClassName='!px-6 !py-2'
    >
      <div className='flex flex-col gap-4 pt-2'>
        <label className='flex flex-col gap-1.5'>
          <span className='text-base-content/70 text-xs'>{_('Feed URL')}</span>
          <input
            type='url'
            inputMode='url'
            autoFocus
            spellCheck={false}
            autoCapitalize='off'
            autoCorrect='off'
            placeholder='https://example.com/feed.xml'
            value={url}
            disabled={busy}
            onChange={(e) => setUrl(e.target.value)}
            className={clsx(
              'input input-sm bg-base-100 border-base-content/20 w-full text-sm',
              'focus:border-base-content/40 focus:outline-none',
            )}
          />
          <span className='text-base-content/60 text-xs'>
            {_(
              'RSS, Atom and JSON feeds are supported. Import the same URL again to add new articles to the end of the book.',
            )}
          </span>
        </label>

        {error && (
          <p className='text-error text-sm' role='alert'>
            {error}
          </p>
        )}

        <div className='mt-1 flex justify-end gap-2 pb-2'>
          <button type='button' className='btn btn-ghost btn-sm' onClick={onCancel} disabled={busy}>
            {_('Cancel')}
          </button>
          <button
            type='button'
            className={clsx('btn btn-contrast btn-sm', confirmDisabled && 'btn-disabled')}
            disabled={confirmDisabled}
            onClick={handleConfirm}
          >
            {busy && <span className='loading loading-spinner loading-xs' />}
            {_('Import')}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default ImportFeedDialog;
