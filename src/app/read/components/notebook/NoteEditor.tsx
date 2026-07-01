import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useEnv } from '@/context/EnvContext';
import { useNotebookStore } from '@/store/notebookStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import useShortcuts from '@/hooks/useShortcuts';
import { TextSelection } from '@/utils/sel';
import { md5Fingerprint } from '@/utils/md5';
import { eventDispatcher } from '@/utils/event';
import { isAuthError } from '@/utils/error';
import { Book, BookNote } from '@/types/book';
import TextEditor, { TextEditorRef } from '@/components/TextEditor';
import TextButton from '@/components/TextButton';
import { setAuthDialogVisible } from '@/components/AuthWindow';
import { getAtpAgent } from '@/services/bsky/auth';
import { postWithExternalLink } from '@/services/bsky/xpost';

interface NoteEditorProps {
  onSave: (selection: TextSelection, note: string, url?: string) => void;
  onEdit: (annotation: BookNote) => void;
  book: Book | null;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ onSave, onEdit, book }) => {
  const _ = useTranslation();
  const { user } = useAuth();
  const { appService, envConfig } = useEnv();
  const {
    notebookNewAnnotation,
    notebookEditAnnotation,
    setNotebookNewAnnotation,
    setNotebookEditAnnotation,
    saveNotebookAnnotationDraft,
    getNotebookAnnotationDraft,
  } = useNotebookStore();

  const editorRef = useRef<TextEditorRef>(null);
  const [note, setNote] = useState('');
  const [crossPostToBluesky, setCrossPostToBluesky] = useState(false);
  const separatorWidth = useResponsiveSize(3);

  useEffect(() => {
    if (notebookEditAnnotation) {
      const noteText = notebookEditAnnotation.note;
      setNote(noteText);
      editorRef.current?.setValue(noteText);
      editorRef.current?.focus();
    } else if (notebookNewAnnotation) {
      const noteText = getAnnotationText();
      if (noteText) {
        const draftNote = getNotebookAnnotationDraft(md5Fingerprint(noteText)) || '';
        setNote(draftNote);
        editorRef.current?.setValue(draftNote);
        editorRef.current?.focus();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookNewAnnotation, notebookEditAnnotation]);

  const getAnnotationText = () => {
    return notebookEditAnnotation?.text || notebookNewAnnotation?.text || '';
  };

  const handleNoteChange = (value: string) => {
    setNote(value);
  };

  const handleBlur = () => {
    const currentValue = editorRef.current?.getValue();
    if (currentValue) {
      const noteText = getAnnotationText();
      if (noteText) {
        saveNotebookAnnotationDraft(md5Fingerprint(noteText), currentValue);
      }
    }
  };

  const handleSaveNote = async () => {
    const currentValue = editorRef.current?.getValue();
    if (currentValue) {
      let crosspostUrl: string | undefined = undefined;

      // Post to Bluesky if enabled
      if (crossPostToBluesky) {
        try {
          const agent = await getAtpAgent();
          const annotationText = getAnnotationText();
          const annotation = notebookNewAnnotation || notebookEditAnnotation;
          
          // Generate thumbnail image from selection text using quote-image
          let thumbBlob: Blob | undefined = undefined;
          if (annotationText && book) {
            try {
              await import('foliate-js/quote-image.js');
              const quoteImage = document.createElement('foliate-quoteimage');
              // Append to DOM temporarily to use the custom element
              console.log('quote image', quoteImage);
              document.body.appendChild(quoteImage);
              
              thumbBlob = await (quoteImage as any).getBlob({
                text: annotationText,
                title: book.title,
                author: book.author,
              });
              
              document.body.removeChild(quoteImage);
            } catch (error) {
              console.warn('⚠ Failed to generate quote image:', error);
            }
          }

          // Ensure book is uploaded to PDS before building share URL
          let shareUrl = 'https://readup.cc';
          let bookUploaded = !!book?.uploadedAt;

          if (!bookUploaded && book && appService) {
            try {
              await appService.uploadBook(book, false);
              // persist change on book to the store to avoid re-upload
              await useLibraryStore.getState().updateBook(envConfig, book);
              bookUploaded = true;
            } catch (uploadError) {
              if (isAuthError(uploadError)) {
                eventDispatcher.dispatch('toast', {
                  message: 'Authentication expired. Please sign in.',
                  timeout: 2000,
                  type: 'warning',
                });
                setAuthDialogVisible(true);
                // fallback to base URL
                bookUploaded = false;
              } else {
                console.error('Failed to upload book:', uploadError);
              }
            }
          }

          // Build share URL with book hash, user DID, and CFI (only if uploaded)
          if (bookUploaded && book?.hash && user?.did && annotation?.cfi) {
            shareUrl = `https://readup.cc/read/${book.hash}?did=${user.did}&loc=${encodeURIComponent(annotation.cfi)}`;
          } else if (bookUploaded && book?.hash && user?.did) {
            shareUrl = `https://readup.cc/read/${book.hash}?did=${user.did}`;
          }

          // Post with external link and thumbnail image
          const response = await postWithExternalLink(agent, {
            text: `${currentValue} #booksky #readsky`,
            url: shareUrl,
            title: book?.title || 'A highlight from a book',
            description: annotationText || currentValue,
            thumb: thumbBlob,
          });

          crosspostUrl = response.data?.uri;
          console.log('✅ Cross-posted to Bluesky:', crosspostUrl);
        } catch (error) {
          if (isAuthError(error)) {
            eventDispatcher.dispatch('toast', {
              message: 'Authentication expired. Please sign in.',
              timeout: 2000,
              type: 'warning',
            });
            setAuthDialogVisible(true);
          }
          console.error('❌ Failed to cross-post to Bluesky:', error);
        }
      }

      if (notebookNewAnnotation) {
        onSave(notebookNewAnnotation, currentValue, crosspostUrl);
      } else if (notebookEditAnnotation) {
        notebookEditAnnotation.note = currentValue;
        notebookEditAnnotation.crosspostUrl = crosspostUrl;
        onEdit(notebookEditAnnotation);
      }
    }
  };

  const handleEscape = () => {
    if (notebookNewAnnotation) {
      // Clearing the selection ends the creation flow; Notebook reacts to that
      // and tears down the empty placeholder highlight it created (#4791).
      setNotebookNewAnnotation(null);
    }
    if (notebookEditAnnotation) {
      setNotebookEditAnnotation(null);
    }
  };

  useShortcuts({
    onSaveNote: async () => {
      const currentValue = editorRef.current?.getValue();
      if (currentValue) {
        await handleSaveNote();
      }
    },
    onEscape: handleEscape,
  });

  const canSave = Boolean(note.trim());

  return (
    <div className='content booknote-item note-editor-container bg-base-100 mt-2 rounded-md p-2'>
      <div className='flex w-full'>
        <TextEditor
          ref={editorRef}
          value={note}
          onChange={handleNoteChange}
          onBlur={handleBlur}
          onSave={handleSaveNote}
          onEscape={handleEscape}
          placeholder={_('Add your notes here...')}
          spellCheck={false}
        />
      </div>

      <div className='flex items-center pt-2'>
        <div
          className='me-2 mt-0.5 min-h-full self-stretch rounded-xl bg-gray-300'
          style={{
            minWidth: `${separatorWidth}px`,
          }}
        ></div>
        <div className='content font-size-sm line-clamp-3'>
          <span className='content font-size-xs text-gray-500'>{getAnnotationText()}</span>
        </div>
      </div>

      <div className='flex items-center justify-between pt-2'>
        <label className='flex items-center gap-2 cursor-pointer'>
          <input
            type='checkbox'
            checked={crossPostToBluesky}
            onChange={(e) => setCrossPostToBluesky(e.target.checked)}
            className='checkbox checkbox-xs'
          />
          <span className='text-xs'>
            {_('Cross-post to Bluesky')}
          </span>
        </label>
      </div>

      <div className='flex justify-end space-x-3 p-2' dir='ltr'>
        <TextButton onClick={handleEscape}>{_('Cancel')}</TextButton>
        <TextButton onClick={handleSaveNote} disabled={!canSave}>
          {_('Save')}
        </TextButton>
      </div>
    </div>
  );
};

export default NoteEditor;
