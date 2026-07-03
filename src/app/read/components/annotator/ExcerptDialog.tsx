import React, { useState, useEffect, useRef, useCallback } from 'react';
import QrCodeWithLogo from 'qrcode-with-logos';

import { Book, BookNote } from '@/types/book';
import { useTranslation } from '@/hooks/useTranslation';
import Dialog from '@/components/Dialog';
import { useAuth } from '@/context/AuthContext';
import { useEnv } from '@/context/EnvContext';
import { formatAuthors, formatTitle } from '@/utils/book';
import { TextSelection } from '@/utils/sel';
import { isAuthError } from '@/utils/error';
import { eventDispatcher } from '@/utils/event';
import { uniqueId } from '@/utils/misc';
import { useSettingsStore } from '@/store/settingsStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { useLibraryStore } from '@/store/libraryStore';
import { setAuthDialogVisible } from '@/components/AuthWindow';
import { getAtpAgent } from '@/services/bsky/auth';
import { postWithImageAndLink } from '@/services/bsky/xpost';
import { getContrastHex, hexToRgba } from '@/styles/themes';

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
  const [quoteImageBlob, setQuoteImageBlob] = useState<Blob | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const previewUrlRef = useRef<string | null>(null);
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
    lineHeight: 1.2,
    fontSize: 18,
    textAlign: 'center'
  });

  const loadImage = useCallback((src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    }), []
  );

  const buildShareUrl = useCallback((bookUploaded: boolean, cfi?: string) => {
    let shareUrl = 'https://readup.cc';
    if (bookUploaded && book && user) {
      const loc = cfi;
      shareUrl = loc
        ? `https://readup.cc/read/${book.hash}?did=${user.did}&loc=${encodeURIComponent(loc)}`
        : `https://readup.cc/read/${book.hash}?did=${user.did}`;
    }

    return shareUrl;
  }, [book, user])

  const createExcerptImageBlob = useCallback(async () => {
    if (!selection.text) {
      return null;
    }

    const writingMode =
      viewSettings?.writingMode === 'horizontal-tb' ||
      viewSettings?.writingMode === 'vertical-rl'
        ? viewSettings.writingMode
        : viewSettings?.vertical
          ? 'vertical-rl'
          : 'horizontal-tb';

    await import('foliate-js/quote-image.js');
    const quoteImage = document.createElement('foliate-quoteimage') as HTMLElement & {
      getBlob?: (payload: {
        title: string;
        author: string;
        text: string;
        progress?: string;
        options: Record<string, unknown>;
      }) => Promise<Blob>;
    };

    document.body.appendChild(quoteImage);

    try {
      return await quoteImage.getBlob?.({
        title: book.title,
        author: book.author,
        text: selection.text,
        progress: progress?.sectionLabel,
        options: {
          backgroundColor: styles.backgroundColor,
          color: styles.fontColor,
          fontSize: styles.fontSize,
          lineHeight: styles.lineHeight,
          padding: 56,
          writingMode,
          direction: viewSettings?.rtl ? 'rtl' : 'ltr',
          textAlign: styles.textAlign === 'default' 
            ? viewSettings?.rtl ? 'right' : 'left' 
            : styles.textAlign,
          titleColor: hexToRgba(getContrastHex(styles.fontColor), 0.8),
          borderColor: hexToRgba(getContrastHex(styles.backgroundColor), 0.3),
        },
      }) ?? null;
    } finally {
      document.body.removeChild(quoteImage);
    }
  }, [book, selection.text, styles, viewSettings]);

  const attachQrCodeToImage = useCallback(async (imageBlob: Blob, shareUrl: string) => {
    const objectUrl = URL.createObjectURL(imageBlob);
    const image = await loadImage(objectUrl);
    URL.revokeObjectURL(objectUrl);

    const originalWidth = image.naturalWidth || 1080;
    const originalHeight = image.naturalHeight || 1080;

    const qr = new QrCodeWithLogo({
      content: shareUrl,
      renderer: 'svg',
      width: 420,
      logo: { src: '/favicon.svg' },
    });
    const qrSvg = await qr.getSvgString();
    const qrDataUrl = `data:image/svg+xml,${encodeURIComponent(qrSvg)}`;
    const qrImage = await loadImage(qrDataUrl);

    const qrSize = Math.max(96, Math.round(originalWidth * 0.16));
    const labelFontSize = Math.max(14, Math.round(originalWidth / 56));
    const padding = 12;
    const extraHeight = qrSize + padding + labelFontSize + 12;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = originalWidth;
    finalCanvas.height = originalHeight + extraHeight;
    const finalCtx = finalCanvas.getContext('2d');
    if (!finalCtx) {
      return imageBlob;
    }

    finalCtx.drawImage(image, 0, 0, originalWidth, originalHeight);

    const x = (originalWidth - qrSize) / 2;
    const y = originalHeight + padding / 2;

    finalCtx.save();
    finalCtx.fillStyle = styles.backgroundColor;
    const rectX = 0; // x - 16;
    const rectY = y - 16;
    const rectWidth = originalWidth; //qrSize + 32;
    const rectHeight = qrSize + labelFontSize + 28;
    if (typeof finalCtx.roundRect === 'function') {
      finalCtx.roundRect(rectX, rectY, rectWidth, rectHeight, 0);
    } else {
      finalCtx.beginPath();
      finalCtx.rect(rectX, rectY, rectWidth, rectHeight);
      finalCtx.closePath();
    }
    finalCtx.fill();

    finalCtx.drawImage(qrImage, x, y, qrSize, qrSize);

    finalCtx.fillStyle = styles.fontColor;
    finalCtx.font = `${labelFontSize}px sans-serif`;
    finalCtx.textAlign = 'center';
    finalCtx.textBaseline = 'top';
    finalCtx.fillText('readup.cc', finalCanvas.width / 2, y + qrSize + 8);
    finalCtx.restore();

    console.log('final canvas', finalCanvas);

    return await new Promise<Blob>((resolve, reject) => {
      finalCanvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to render share image'));
        }
      }, 'image/png');
    });
  }, [loadImage, styles]);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setImageUrl('');
    setQuoteImageBlob(null);
    setIsRendering(false);
  }, []);

  useEffect(() => {
    if (!isOpen || !selection.text) {
      queueMicrotask(clearPreview);
      return;
    }

    let cancelled = false;

    const generateImage = async () => {
      setIsRendering(true);
      try {
        const blob = await createExcerptImageBlob();
        if (cancelled) {
          return;
        }

        if (!blob) {
          setImageUrl('');
          setQuoteImageBlob(null);
          return;
        }

        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
        }

        const finalBlob = toAttachQr 
          ? await attachQrCodeToImage(blob, buildShareUrl(!!book.uploadedAt)) 
          : blob;

        const objectUrl = URL.createObjectURL(finalBlob);
        previewUrlRef.current = objectUrl;
        setQuoteImageBlob(blob);
        setImageUrl(objectUrl);
      } catch (error) {
        console.error('Failed to generate excerpt image:', error);
        setImageUrl('');
        setQuoteImageBlob(null);
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    };

    void generateImage();

    return () => {
      cancelled = true;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, [clearPreview, createExcerptImageBlob, isOpen, selection.text, toAttachQr, book]);

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
              message: 'Authentication expired. Please sign in.',
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
      const shareUrl = buildShareUrl(bookUploaded, selection.cfi || selection.href);

      let finalImageBlob: Blob | null = quoteImageBlob;
      if (toAttachQr && bookUploaded && shareUrl && finalImageBlob && !qrAttached) {
        finalImageBlob = await attachQrCodeToImage(finalImageBlob, shareUrl);
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

      if (!finalImageBlob) {
        throw new Error('Unable to generate excerpt image');
      }

      const resp = await postWithImageAndLink(agent, {
        text: `📚💙 ${formatTitle(book.title)} © ${formatAuthors(book.author || book.metadata?.author || '')} ${allHashtags}`,
        imageData: finalImageBlob,
        altText: selection.text,
        url: shareUrl,
        linkTitle: bookUploaded ? 'Read the Book on Readup' : undefined
      });
      // const resp = {success: false};
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
              <label className='text-xs font-medium'>{_('Background')}</label>
              <input
                type='color'
                value={styles.backgroundColor}
                onChange={(e) => setStyles({ ...styles, backgroundColor: e.target.value })}
                className='w-8 h-6 rounded cursor-pointer bordered eink-bordered'
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
                className='w-8 h-6 rounded cursor-pointer bordered eink-bordered'
                style={{ padding: '1px' }}
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
                  { ...styles, lineHeight: parseFloat(e.target.value) || 1.2 }
                )}
                className='input input-xs w-14 text-center input-bordered eink-bordered'
              />
            </div>

            {/* Text Align */}
            <div className='flex items-center gap-2'>
              <label className='text-xs font-medium'>{_('Text Align')}</label>
              <select
                value={styles.textAlign}
                onChange={(e) => setStyles(
                  { ...styles, textAlign: e.target.value || 'center' }
                )}
                className='select select-xs select-bordered eink-bordered'
              >
                <option value='default'>{_('Default')}</option>
                <option value='center'>{_('Center')}</option>
                <option value='left'>{_('Left')}</option>
                <option value='right'>{_('Right')}</option>
              </select>
            </div>

            {/* Font Size */}
            <div className='flex items-center gap-2'>
              <label className='text-xs font-medium'>{_('Title Size')}</label>
              <input
                type='number'
                min='12'
                max='28'
                value={styles.fontSize}
                onChange={(e) => setStyles(
                  { ...styles, fontSize: parseInt(e.target.value) || 18 }
                )}
                className='input input-xs w-14 text-center input-bordered eink-bordered'
              />
            </div>
          </div>
        </div>

        {/* Image Preview */}
        <div className='space-y-2'>
          <h3 className='font-bold text-accent mb-2'>{_('Preview')}</h3>
          <div className='rounded-lg border border-base-300 bg-base-100/70 p-3'>
          {!selection.text ? (
            <div className='flex h-[220px] items-center justify-center rounded-md bg-base-200/70 text-sm text-base-content/50'>
              {_('No content to preview')}
            </div>
          ) : imageUrl ? (
            <div className='flex items-center justify-center'>
              <img
                src={imageUrl}
                alt='Excerpt preview'
                className='max-w-full rounded-sm border border-base-300 bg-base-100 object-contain shadow-sm'
              />
            </div>
          ) : (
            <div className='flex h-[220px] items-center justify-center rounded-md bg-base-200/70 text-sm text-base-content/50'>
              {_('Generating image')}
            </div>
          )}
          </div>
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