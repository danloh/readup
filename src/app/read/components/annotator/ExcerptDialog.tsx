import clsx from 'clsx';
import React, { useState, useEffect, useRef } from 'react';
import { toPng } from 'html-to-image';
import QrCodeWithLogo from 'qrcode-with-logos'

import { Book, BookNote } from '@/types/book';
import { useTranslation } from '@/hooks/useTranslation';
import Dialog from '@/components/Dialog';
import { useAuth } from '@/context/AuthContext';
import { useEnv } from '@/context/EnvContext';
import { TextSelection } from '@/utils/sel';
import { isAuthError } from '@/utils/error';
import { eventDispatcher } from '@/utils/event';
import { uniqueId } from '@/utils/misc';
import { getContrastHex, hexToRgba } from '@/styles/themes';
import { useSettingsStore } from '@/store/settingsStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { useLibraryStore } from '@/store/libraryStore';
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
  const { appService, envConfig } = useEnv();
  const { settings } = useSettingsStore(); 
  const { getProgress, getViewSettings, getView } = useReaderStore();
  const { getConfig, saveConfig, updateBooknotes } = useBookDataStore();
  const progress = getProgress(bookKey);
  const viewSettings = getViewSettings(bookKey);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isRendering, setIsRendering] = useState(false);
  const [showContentPreview, setShowContentPreview] = useState(false);
  const [iframeHeight, setIframeHeight] = useState<string>('auto');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [shouldUploadBook, setShouldUploadBook] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [toAttachQr, setToAttachQr] = useState(true);
  const [qrAttached, setQrAttached] = useState(false);
  const [customHashtags, setCustomHashtags] = useState<string>('');

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

    const lang = localStorage?.getItem('i18nextLng') || navigator?.language;

    // Apply book's writing mode (vertical, RTL)
    const writingMode = viewSettings?.writingMode || 'auto';
    const isVertical = viewSettings?.vertical;
    const isRTL = viewSettings?.rtl;
    const direction = isRTL ? 'rtl' : 'ltr';

    // Complete HTML document with responsive styling
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="${direction}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          html {
            width: 100%;
            height: 100%;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
          }

          body {
            width: 100%;
            height: auto;
            color: ${styles.fontColor};
            background-color: ${styles.backgroundColor};
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            padding: 32px;
            max-width: 900px;
            margin: 0 auto;
            word-wrap: break-word;
            overflow-wrap: break-word;
            white-space: normal;
            font-size: 16px;
          }

          .double-border {
            border-width: 4px;
            border-style: double;
            border-color: ${hexToRgba(getContrastHex(styles.backgroundColor), 0.5)};
          }
          
          .header {
            margin-bottom: 32px;
            padding-bottom: 16px;
            border-bottom: 2px solid ${hexToRgba(getContrastHex(styles.backgroundColor), 0.3)};
            ${isVertical ? `writing-mode: ${writingMode};` : ''}
            ${isRTL ? `direction: rtl;` : ''}
          }
          
          .book-title {
            font-size: 22px;
            font-weight: 600;
            margin-bottom: 8px;
            color: ${styles.fontColor};
          }
          
          .book-meta {
            font-size: ${styles.fontSize * 0.6}px;
            color: ${hexToRgba(styles.fontColor, 0.6)};
            line-height: 1.4;
          }
          
          .book-meta-item {
            margin: 4px 0;
            overflow: hidden;
            display: -webkit-box;
            -webkit-box-orient: ${isVertical ? 'horizontal' : 'vertical'};
            -webkit-line-clamp: 1;
          }
          
          .excerpt {
            font-size: ${styles.fontSize}px;
            line-height: ${styles.lineHeight};
            color: ${styles.fontColor};
            letter-spacing: -0.3px;
            ${isVertical ? `writing-mode: ${writingMode};` : ''}
            ${isRTL ? `direction: rtl;` : ''}
          }

          .qr-code {
            margin-top: 4px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 2px;
          }
          .qr-code img {
            max-width: 64px;
            max-height: 64px;
          }
          .qr-code span {
            font-weight: bold;
            font-size: 12px;
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
      <body class="double-border">
        <div class="header">
          <div class="book-title">${book.title}</div>
          <div class="book-meta">
            ${book.author 
              ? `<div class="book-meta-item">© ${book.author}</div>`
              : ''
            }
            ${progress?.sectionLabel
              ? `<div class="book-meta-item">
                  § ${progress.sectionLabel}
                </div>`
              : ''
            }
            <div class="book-meta-item">
              ๏ ${new Date().toLocaleDateString(lang, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
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
    // Calculate iframe height based on content
    setTimeout(() => {
      const iframe = iframeRef.current;
      if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
        const contentHeight = iframe.contentDocument.body.scrollHeight;
        setIframeHeight(`${contentHeight}px`);
      }
    }, 100);  
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
      // onCancel();
      return;
    }
    
    setIsSharing(true);
    let bookUploaded = !!book.uploadedAt;

    try {
      // Upload book if toggle is enabled and book hasn't been uploaded yet
      if (shouldUploadBook && !book.uploadedAt && appService) {
        setIsUploading(true);
        eventDispatcher.dispatch('toast', {
          message: 'Uploading book to PDS...',
          timeout: 2000,
          type: 'info',
        });
        try {
          await appService.uploadBook(book, false);
          eventDispatcher.dispatch('toast', {
            message: 'Book uploaded successfully',
            timeout: 2000,
            type: 'info',
          });
          // persist change on book to the store to avoid re-upload
          await useLibraryStore.getState().updateBook(envConfig, book);
          bookUploaded = true;
        } catch (uploadError) {
          console.error('Failed to upload book:', uploadError);
          
          // Check if upload error is auth-related
          if (isAuthError(uploadError)) {
            eventDispatcher.dispatch('toast', {
              message: 'Authentication expired. Please sign in again.',
              timeout: 2000,
              type: 'warning',
            });
            setAuthDialogVisible(true);
            // onCancel();
            return;
          }
          
          eventDispatcher.dispatch('toast', {
            message: `Failed to upload book: ${uploadError}`,
            timeout: 2000,
            type: 'warning',
          });
          return;
        } finally {
          setIsUploading(false);
        }
      }

      // add location information for the share link
      let shareUrl = 'https://readup.cc';
      if (bookUploaded) {
        const loc = selection.cfi || selection.href;
        shareUrl = loc
          ? `https://readup.cc/read/${book.hash}?did=${user.did}&loc=${encodeURIComponent(loc)}`
          : `https://readup.cc/read/${book.hash}?did=${user.did}`;
      }

      // Add QR code to iframe
      let finalImageUrl = imageUrl;
      const iframe = toAttachQr && bookUploaded ? iframeRef.current : undefined;
      if (iframe && iframe.contentDocument && !qrAttached) {
        const iframeBody = iframe.contentDocument.body;
        const qrSection = iframe.contentDocument.createElement('div');
        // Generate QR code URL
        const qr = new QrCodeWithLogo({
          content: shareUrl,
          renderer: 'svg',
          width: 420,
          logo: { src: '/favicon.svg' }
        })
        const qrSvg = await qr.getSvgString();
        const qrCodeImageUrl = 'data:image/svg+xml,' + encodeURIComponent(qrSvg);
        qrSection.className = 'qr-code';
        qrSection.innerHTML = `<img src="${qrCodeImageUrl}" /><span>Readup.cc</span>`;
        iframeBody.appendChild(qrSection);

        // Wait for QR code image to load and render
        await Promise.race([
          new Promise<void>(resolve => {
            const img = qrSection.querySelector('img') as HTMLImageElement;
            if (img) {
              const onLoad = () => {
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                setTimeout(resolve, 500); // Wait after load to ensure rendering
              };
              const onError = () => {
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                setTimeout(resolve, 500);
              };
              img.addEventListener('load', onLoad, { once: true });
              img.addEventListener('error', onError, { once: true });
              
              // Check if already loaded (cached)
              if (img.complete) {
                onLoad();
              }
            } else {
              resolve();
            }
          }),
          new Promise<void>(resolve => setTimeout(resolve, 1000)) // Timeout after 1s
        ]);

        // Additional wait to ensure mobile browsers have rendered
        await new Promise(resolve => setTimeout(resolve, 200));

        // Regenerate image with QR code
        const dataUrlWithQR = await toPng(iframeBody, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: styles.backgroundColor,
          quality: 0.95,
        });
        setImageUrl(dataUrlWithQR);

        // Use the new image with QR code for sharing
        finalImageUrl = dataUrlWithQR;
        setQrAttached(true);
      }

      const agent = await getAtpAgent();
      
      // Build hashtags
      const defaultHashtags = '#booksky #readsky';
      const tagsToAdd = customHashtags
        .trim()
        .split(/\s+/)
        .filter(tag => tag.length > 0)
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
        .join(' ');
      const allHashtags = tagsToAdd ? `${defaultHashtags} ${tagsToAdd}` : defaultHashtags;

      const resp = await postWithImageAndLink(agent, {
        text: `Excerpt from book: ${book.title} ${allHashtags}`,
        imageData: finalImageUrl || imageUrl,
        altText: selection.text,
        url: shareUrl,
        linkTitle: bookUploaded ? 'Read the Book on Readup' : undefined
      });
      if (resp.success) {
        eventDispatcher.dispatch('toast', {
          message: 'Success to share in ATmosphere',
          timeout: 2000,
          type: 'info',
        });
        
        // also highlight the excerpted selection 
        const style = 'highlight';
        const color = settings.globalReadSettings.highlightStyles[style];
        const cfi = selection.cfi;
        if (cfi) {
          console.log('Excerpt and highlight: ', cfi);
          const annotation: BookNote = {
            id: uniqueId(),
            type: 'annotation',
            cfi,
            style,
            color,
            text: selection.text,
            note: '',
            page: progress?.page,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          const config = getConfig(bookKey)!;
          const { booknotes: annotations = [] } = config;
          const existingIdx = annotations.findIndex(
            (annotation) =>
              annotation.cfi === cfi &&
              annotation.type === 'annotation' &&
              annotation.style &&
              !annotation.deletedAt,
          );
          if (existingIdx === -1) {
            annotations.push(annotation);
            const view = getView(bookKey);
            view?.addAnnotation(annotation);
            const updatedConfig = updateBooknotes(bookKey, annotations);
            if (updatedConfig) {
              saveConfig(envConfig, bookKey, updatedConfig, settings);
            }
          }
        }
        onCancel();
      }
    } catch (error) {
      console.error('Error sharing excerpt:', error);
      
      // Check if error is auth-related
      if (isAuthError(error)) {
        eventDispatcher.dispatch('toast', {
          message: 'Authentication expired. Please sign in again.',
          timeout: 2000,
          type: 'warning',
        });
        setAuthDialogVisible(true);
        // onCancel();
        return;
      }
      
      eventDispatcher.dispatch('toast', {
        message: `Error on sharing excerpt: ${error}`,
        timeout: 2000,
        type: 'error',
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      title={_('Excerpt and Share')}
      onClose={onCancel}
      boxClassName='sm:!w-[75%] sm:h-auto sm:!max-h-[90vh] sm:!max-w-5xl'
      contentClassName='sm:!px-8 sm:!py-2'
    >
      <div className='flex flex-col gap-4 max-h-[80vh] px-2 overflow-y-auto'>
        {/* Style Customization Options */}
        <div className='border-b border-base-300 pb-2'>
          {(isUploading || isSharing) && (
            <div className='flex items-center justify-center gap-2'>
              <span className='loading loading-spinner loading-sm'></span>
              <span className='text-success'>{_('Processing...')}</span>
            </div>
          )}
          <h3 className='font-bold text-accent mb-2'>{_('Custom Theme')}</h3>
          <div className='flex flex-wrap items-center justify-start gap-2'>
            {/* Background Color */}
            <div className='flex items-center gap-2'>
              <label className='text-xs font-medium'>{_('Background Color')}</label>
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
              <label className='text-xs font-medium'>{_('Text Color')}</label>
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
              <label className='text-xs font-medium'>{_('Font Size')}</label>
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
              <label className='text-xs font-medium'>{_('Line Spacing')}</label>
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
          <h3 className='font-bold text-accent mb-2'>{_('Preview')}</h3>
          {isRendering ? (
            <div className='flex items-center justify-center h-[300px]'>
              <div className='flex flex-col items-center gap-3'>
                <span className='loading loading-spinner loading-lg'></span>
                <p className='text-sm text-base-content/70'>
                  {_('Generating image')}
                </p>
              </div>
            </div>
          ) : imageUrl ? (
            <div className='flex items-center justify-center'>
              <img
                src={imageUrl}
                alt='Excerpt preview'
                className='border border-base-300 rounded-sm bg-base-100 max-w-full h-auto object-contain'
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
        <div className='border-t border-base-300 p-2 hidden'>
          <button
            onClick={() => setShowContentPreview(!showContentPreview)}
            className='btn btn-sm btn-outline gap-2'
          >
            {showContentPreview ? '▼' : '▶'} {_('Preview')}
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
              height: iframeHeight,
              minHeight: '200px',
              display: selection.text ? 'block' : 'none',
              overflow: 'hidden',
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

        {/* Upload Book Option */}
        <div className='pt-4'>
          <label className='flex items-center gap-3 cursor-pointer'>
            <input
              type='checkbox'
              checked={shouldUploadBook}
              onChange={(e) => setShouldUploadBook(e.target.checked)}
              className='checkbox checkbox-xs'
              disabled={isUploading}
            />
            <span className='text-sm font-medium text-base-content'>
              {_('Upload book to PDS before sharing')}
            </span>
          </label>
          <p className='text-xs text-base-content/60 mt-1 ml-6'>
            {_('This will make your book discoverable in the Atmosphere')}
          </p>
        </div>

        {/* Attach QRCode Option */}
        <div className='pt-4'>
          <label className='flex items-center gap-3 cursor-pointer'>
            <input
              type='checkbox'
              checked={toAttachQr}
              onChange={(e) => setToAttachQr(e.target.checked)}
              className='checkbox checkbox-xs'
              disabled={isRendering}
            />
            <span className='text-sm font-medium text-base-content'>
              {_('Attach QR Code on sharing')}
            </span>
          </label>
        </div>

        {/* Hashtags Section */}
        <div className='pt-4'>
          <label className='text-sm font-medium text-base-content block mb-2'>
            {_('Add Hashtags')}
          </label>
          <input
            type='text'
            placeholder={_('Add hashtags (space-separated)...')}
            value={customHashtags}
            onChange={(e) => setCustomHashtags(e.target.value)}
            className='input input-sm input-bordered w-full'
          />
          <p className='text-xs text-base-content/60 mt-2'>
            {_('Default')}: #booksky #readsky {customHashtags && `+ ${customHashtags.trim().split(/\s+/).filter(tag => tag.length > 0).map(tag => tag.startsWith('#') ? tag : `#${tag}`).join(' ')}`}
          </p>
        </div>

        {/* Footer Actions */}
        <div className='mt-4 flex justify-center gap-4'>
          <button 
            onClick={onCancel} 
            className='btn btn-ghost btn-sm' 
            disabled={isUploading || isSharing}
          >
            {_('Cancel')}
          </button>
          <button 
            onClick={handleShare} 
            className='btn btn-primary btn-sm' 
            disabled={isRendering || isUploading || isSharing}
          >
            {isUploading ? (
              <>
                <span className='loading loading-spinner loading-xs'></span>
                {_('Uploading...')}
              </>
            ) : (
              isSharing ? _('Sharing') : _('Share')
            )}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default ExcerptDialog;
