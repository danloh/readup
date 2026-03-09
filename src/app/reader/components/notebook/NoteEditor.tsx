import React, { useEffect, useRef, useState } from 'react';
import { useNotebookStore } from '@/store/notebookStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { TextSelection } from '@/utils/sel';
import { md5Fingerprint } from '@/utils/md5';
import { Book, BookNote } from '@/types/book';
import useShortcuts from '@/hooks/useShortcuts';
import TextEditor, { TextEditorRef } from '@/components/TextEditor';
import TextButton from '@/components/TextButton';
import { getAtpAgent } from '@/services/bsky/auth';
import { postText } from '@/services/bsky/xpost';

interface NoteEditorProps {
  onSave: (selection: TextSelection, note: string) => void;
  onEdit: (annotation: BookNote) => void;
  book: Book | null;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ onSave, onEdit, book }) => {
  const _ = useTranslation();
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
      // Post to Bluesky if enabled
      if (crossPostToBluesky) {
        try {
          const annotationText = getAnnotationText();
          const bookTitle = book?.title ? `\n\n ---${book?.title}` : '';
          const blueskyText = annotationText 
            ? `${currentValue}\n\n---\n\n${annotationText} ${bookTitle}`
            : `${currentValue} ${bookTitle}`;
          
          const agent = await getAtpAgent();
          // FIXME: how to handle the length limit? 
          await postText(agent, blueskyText);
          console.log('✅ Note cross-posted to Bluesky');
        } catch (error) {
          console.error('❌ Failed to cross-post to Bluesky:', error);
        }
      }

      if (notebookNewAnnotation) {
        onSave(notebookNewAnnotation, currentValue);
      } else if (notebookEditAnnotation) {
        notebookEditAnnotation.note = currentValue;
        onEdit(notebookEditAnnotation);
      }
    }
  };

  const handleEscape = () => {
    if (notebookNewAnnotation) {
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
