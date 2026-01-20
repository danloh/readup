import clsx from 'clsx';
import React, { useState, useMemo, useEffect } from 'react';
import { marked } from 'marked';
import { Book } from '@/types/book';
import { useTranslation } from '@/hooks/useTranslation';
import Dialog from '@/components/Dialog';
import { useReaderStore } from '@/store/readerStore';
import { DEFAULT_NOTE_EXPORT_CONFIG } from '@/services/constants';
import { saveViewSettings } from '@/helpers/settings';
import { useEnv } from '@/context/EnvContext';
import { TextSelection } from '@/utils/sel';

interface ExcerptDialogProps {
  bookKey: string;
  isOpen: boolean;
  book: Book;
  selection: TextSelection;
  onCancel: () => void;
}

const ExcerptDialog: React.FC<ExcerptDialogProps> = ({
  bookKey,
  isOpen,
  book,
  selection,
  onCancel,
}) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { getViewSettings } = useReaderStore();
  const viewSettings = getViewSettings(bookKey);

  return (
    <Dialog
      isOpen={isOpen}
      title={_('Export Annotations')}
      onClose={onCancel}
      boxClassName='sm:!w-[75%] sm:h-auto sm:!max-h-[90vh] sm:!max-w-5xl'
      contentClassName='sm:!px-8 sm:!py-2'
    >
      <div className='flex flex-col gap-4'>
        <div className='space-y-2'>
            <div
              className={clsx(
                'bg-base-200 prose prose-sm max-w-none overflow-y-auto rounded-lg p-4',
                'max-h-[40vh] select-text break-words',
              )}
              dangerouslySetInnerHTML={{
                __html: `<p class="text-base-content/50">${_('No content to preview')}</p>`,
              }}
            />
        </div>

        {/* Footer Actions */}
        <div className='mt-4 flex justify-end gap-4'>
          <button onClick={onCancel} className='btn btn-ghost btn-sm'>
            {_('Cancel')}
          </button>
          <button
            // onClick={handleExport}
            className='btn btn-primary btn-sm'
          >
            {_('Share')}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default ExcerptDialog;
