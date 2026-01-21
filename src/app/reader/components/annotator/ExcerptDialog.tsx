import clsx from 'clsx';
import React, { useState, useEffect } from 'react';

import { Book } from '@/types/book';
import { useTranslation } from '@/hooks/useTranslation';
import Dialog from '@/components/Dialog';
import { useReaderStore } from '@/store/readerStore';
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
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    const generateImage = async () => {
      if (!selection.text) {
        setImageUrl('');
        return;
      }

      try {
        // Create a temporary canvas for measuring text
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 1;
        tempCanvas.height = 1;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) throw new Error('Cannot get canvas context');

        const fontSize = 16;
        const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const fontString = `${fontSize}px ${fontFamily}`;
        tempCtx.font = fontString;

        const padding = 20;
        const canvasWidth = 1200;
        const maxWidth = canvasWidth - padding * 2;
        const lineHeight = 28;

        // Function to wrap text into lines with accurate pixel measurement
        const wrapText = (text: string, maxWidth: number): string[] => {
          const lines: string[] = [];
          const paragraphs = text.split('\n');

          for (const paragraph of paragraphs) {
            if (!paragraph.trim()) {
              lines.push('');
              continue;
            }

            const words = paragraph.split(/\s+/);
            let currentLine = '';

            for (const word of words) {
              if (!word) continue;
              const testLine = currentLine ? currentLine + ' ' + word : word;
              const metrics = tempCtx.measureText(testLine);
              
              console.log(`Word: "${word}", TestLine: "${testLine}", Width: ${metrics.width}, MaxWidth: ${maxWidth}`);

              if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
              } else {
                currentLine = testLine;
              }
            }

            if (currentLine) {
              lines.push(currentLine);
            }
          }

          return lines;
        };

        const textLines = wrapText(selection.text, maxWidth);
        console.log('Wrapped lines:', textLines);
        console.log('Total lines:', textLines.length);

        const canvasHeight = Math.max(150, padding * 2 + textLines.length * lineHeight + 20);

        // Create the actual canvas
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Cannot get canvas context');

        ctx.font = fontString;

        console.log('Canvas size:', canvasWidth, 'x', canvasHeight);

        // Draw background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw border
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);

        // Draw text
        ctx.fillStyle = '#1f2937';
        ctx.textBaseline = 'top';

        let y = padding;
        for (const line of textLines) {
          ctx.fillText(line, padding, y);
          y += lineHeight;
        }

        // Convert canvas to blob
        canvas.toBlob((blob) => {
          if (blob) {
            console.log('Image blob created, size:', blob.size, 'bytes');
            const blobUrl: string = URL.createObjectURL(blob);
            console.log('Blob URL created:', blobUrl);
            setImageUrl(blobUrl);
          } else {
            console.error('Failed to create blob from canvas');
            setImageUrl('');
          }
        }, 'image/png');
      } catch (error) {
        console.error('Failed to generate image:', error);
        setImageUrl('');
      }
    };

    generateImage();
  }, [selection.text]);

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
          {imageUrl ? (
            <img
              src={imageUrl}
              alt='Excerpt preview'
              className='bg-base-200 max-w-full h-auto rounded-lg p-4 max-h-[40vh] overflow-y-auto'
            />
          ) : (
            <div
              className={clsx(
                'bg-base-200 prose prose-sm max-w-none overflow-y-auto rounded-lg p-4',
                'max-h-[40vh] select-text break-words',
              )}
              dangerouslySetInnerHTML={{
                __html: `<p class="text-base-content/50">${_('No content to preview')}</p>`,
              }}
            />
          )}
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
