import clsx from 'clsx';
import React, { useState, useEffect, useRef } from 'react';
import { toPng } from 'html-to-image';

import { Book } from '@/types/book';
import { useTranslation } from '@/hooks/useTranslation';
import Dialog from '@/components/Dialog';
import { useAuth } from '@/context/AuthContext';
import { TextSelection } from '@/utils/sel';
import { getContrastHex, hexToRgba } from '@/styles/color';
import { useReaderStore } from '@/store/readerStore';
import { eventDispatcher } from '@/utils/event';
import { setAuthDialogVisible } from '@/components/AuthWindow';
import { getAtpAgent } from '@/services/bsky/auth';
import { postWithImageAndLink } from '@/services/bsky/xpost';

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
  const { user } = useAuth();
  const { getProgress } = useReaderStore();
  const progress = getProgress(bookKey);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isRendering, setIsRendering] = useState(false);
  const [showContentPreview, setShowContentPreview] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Style customization state
  const [styles, setStyles] = useState({
    backgroundColor: '#ffffff',
    fontColor: '#111827',
    lineHeight: 1.8,
    fontSize: 18,
  });

  // Create and load iframe with styled content
  useEffect(() => {
    if (!isOpen || !selection.text) {
      return;
    }

    const iframe = iframeRef.current;
    if (!iframe) return;

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    // Complete HTML document with responsive styling
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          html, body {
            width: 100%;
            height: 100%;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: ${styles.fontColor};
            background-color: ${styles.backgroundColor};
          }
          
          body {
            padding: 32px;
            max-width: 900px;
            margin: 0 auto;
            word-wrap: break-word;
            overflow-wrap: break-word;
            white-space: normal;
            font-size: 16px;
          }
          
          .header {
            margin-bottom: 32px;
            padding-bottom: 16px;
            border-bottom: 2px solid ${hexToRgba(getContrastHex(styles.backgroundColor), 0.3)};
          }
          
          .book-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 8px;
            color: ${styles.fontColor};
          }
          
          .book-meta {
            font-size: 14px;
            color: ${hexToRgba(styles.fontColor, 0.6)};
            line-height: 1.4;
          }
          
          .book-meta-item {
            margin: 4px 0;
          }
          
          .excerpt {
            font-size: ${styles.fontSize}px;
            line-height: ${styles.lineHeight};
            color: ${styles.fontColor};
            letter-spacing: -0.3px;
          }
          
          p {
            margin-bottom: 1.5em;
          }
          
          p:last-child {
            margin-bottom: 0;
          }
          
          strong {
            font-weight: 600;
          }
          
          em {
            font-style: italic;
          }
          
          code {
            background-color: ${hexToRgba(styles.backgroundColor, 0.8)};
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 0.95em;
          }
          
          @media (max-width: 768px) {
            body {
              padding: 24px;
              font-size: 16px;
            }
            
            .excerpt {
              font-size: ${Math.max(14, styles.fontSize - 2)}px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="book-title">${book.title}</div>
          <div class="book-meta">
            ${book.author 
              ? `<div class="book-meta-item">${book.author}</div>`
              : ''
            }
            ${progress?.sectionLabel
              ? `<div class="book-meta-item">
                  ${progress.sectionLabel}
                </div>`
              : ''
            }
            <div class="book-meta-item">
              <b>Excerpted:</b> ${new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
        <div class="excerpt">${selection.text}</div>
      </body>
      </html>
    `;

    // Write to iframe
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();
  }, [isOpen, selection.text, styles, book, progress?.sectionLabel]);

  // Generate image from iframe
  useEffect(() => {
    if (!selection.text) {
      setImageUrl('');
      setIsRendering(false);
      return;
    }

    const generateImage = async () => {
      setIsRendering(true);
      try {
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentDocument) {
          console.error('iframe not available');
          setIsRendering(false);
          return;
        }

        // Wait for iframe to fully render
        await new Promise(resolve => setTimeout(resolve, 1000));

        const iframeBody = iframe.contentDocument.body;
        if (!iframeBody) {
          console.error('iframe body not found');
          setIsRendering(false);
          return;
        }

        // Ensure body has a computed font
        const bodyStyle = iframe.contentWindow?.getComputedStyle(iframeBody);
        console.log('Body font:', bodyStyle?.font);

        console.log('Generating image from iframe body');

        // Use html-to-image to capture the iframe content
        const dataUrl = await toPng(iframeBody, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: styles.backgroundColor,
          quality: 0.95,
        });

        console.log('Image generated successfully');
        setImageUrl(dataUrl);
      } catch (error) {
        console.error('Failed to generate image:', error);
        setImageUrl('');
      } finally {
        setIsRendering(false);
      }
    };

    generateImage();
  }, [selection.text, styles]);

  const handleShare = async () => {
    if (!user) {
      eventDispatcher.dispatch('toast', {
        message: 'Please Sign in then share',
        timeout: 2000,
        type: 'warning',
      });
      setAuthDialogVisible(true);
      onCancel();
    } else {
      // TODO
      const agent = await getAtpAgent();
      const resp = await postWithImageAndLink(agent, {
        text: `Excerpt from ${book.title}`,
        imageData: imageUrl,
        altText: selection.text,
        url: `https://readup.cc/read/${book.hash}?did=${user.did}`,
        linkTitle: 'Read the Book'
      });
      if (resp.success) {
        eventDispatcher.dispatch('toast', {
          message: 'Success to share on ATmosphere',
          timeout: 2000,
          type: 'info',
        });
      }
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      title={_('Excerpt')}
      onClose={onCancel}
      boxClassName='sm:!w-[75%] sm:h-auto sm:!max-h-[90vh] sm:!max-w-5xl'
      contentClassName='sm:!px-8 sm:!py-2'
    >
      <div className='flex flex-col gap-6 max-h-[80vh] overflow-y-auto'>
        {/* Style Customization Options */}
        <div className='border-b border-base-300 pb-4'>
          <h3 className='text-sm font-semibold text-base-content mb-3'>
            {_('Customize Style')}
          </h3>
          <div className='flex flex-wrap items-center justify-start gap-2'>
            {/* Background Color */}
            <div className='flex items-center gap-2'>
              <label className='text-xs font-medium'>Background:</label>
              <input
                type='color'
                value={styles.backgroundColor}
                onChange={(e) => setStyles({ ...styles, backgroundColor: e.target.value })}
                className='w-6 h-6 rounded cursor-pointer border'
                style={{ padding: '1px' }}
              />
            </div>

            {/* Font Color */}
            <div className='flex items-center gap-2'>
              <label className='text-xs font-medium'>Text:</label>
              <input
                type='color'
                value={styles.fontColor}
                onChange={(e) => setStyles({ ...styles, fontColor: e.target.value })}
                className='w-6 h-6 rounded cursor-pointer border'
                style={{ padding: '1px' }}
              />
            </div>

            {/* Font Size */}
            <div className='flex items-center gap-2'>
              <label className='text-xs font-medium'>Size:</label>
              <input
                type='number'
                min='12'
                max='28'
                value={styles.fontSize}
                onChange={(e) => setStyles(
                  { ...styles, fontSize: parseInt(e.target.value) || 18 }
                )}
                className='input input-xs w-14 h-8 p-1 text-center'
              />
            </div>

            {/* Line Height */}
            <div className='flex items-center gap-2'>
              <label className='text-xs font-medium text-base-content/70 whitespace-nowrap'>Height:</label>
              <input
                type='number'
                min='1.2'
                max='2.4'
                step='0.1'
                value={styles.lineHeight}
                onChange={(e) => setStyles(
                  { ...styles, lineHeight: parseFloat(e.target.value) || 1.8 }
                )}
                className='input input-xs w-14 h-8 p-1 text-center'
              />
            </div>
          </div>
        </div>

        {/* Image Preview */}
        <div className='space-y-2'>
          <h3 className='text-sm font-semibold text-base-content'>
            {_('Image Preview')}
          </h3>
          {isRendering ? (
            <div className='flex items-center justify-center h-[300px]'>
              <div className='flex flex-col items-center gap-3'>
                <span className='loading loading-spinner loading-lg'></span>
                <p className='text-sm text-base-content/70'>
                  {_('Generating image...')}
                </p>
              </div>
            </div>
          ) : imageUrl ? (
            <div className='flex items-center justify-center'>
              <img
                src={imageUrl}
                alt='Excerpt preview'
                className='border border-base-300 rounded-sm bg-base-100 max-w-full h-auto max-h-[40vh] object-contain'
              />
            </div>
          ) : (
            <div className='h-[200px] flex items-center justify-center'>
              <p className='text-sm text-base-content/50'>
                {_('No image yet')}
              </p>
            </div>
          )}
        </div>

        {/* Iframe Preview Toggle */}
        <div className='border-t border-base-300 pt-4 hidden'>
          <button
            onClick={() => setShowContentPreview(!showContentPreview)}
            className='btn btn-sm btn-outline gap-2'
          >
            {showContentPreview ? '▼' : '▶'} {_('Content Preview')}
          </button>
        </div>

        {/* Iframe Preview - Always rendered, hidden with opacity when not showing */}
        <div 
          style={{
            opacity: showContentPreview ? 1 : 0,
            maxHeight: showContentPreview ? 'none' : '0px',
            overflow: showContentPreview ? 'visible' : 'hidden',
            transition: 'opacity 0.3s ease-in-out',
          }}
          className='space-y-2 px-4'
        >
          <iframe
            ref={iframeRef}
            className='w-full border border-base-300 rounded-sm'
            style={{
              height: '400px',
              display: selection.text ? 'block' : 'none',
            }}
            title='Excerpt preview'
            sandbox='allow-same-origin'
          />
          {!selection.text && (
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
        <div className='mt-4 flex justify-end gap-4 border-t border-base-300 pt-4'>
          <button onClick={onCancel} className='btn btn-ghost btn-sm'>
            {_('Cancel')}
          </button>
          <button
            onClick={handleShare}
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
