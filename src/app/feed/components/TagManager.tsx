import React, { useState, useCallback } from 'react';
import { IoClose, IoAdd } from 'react-icons/io5';
import { useTranslation } from '@/hooks/useTranslation';
import { ArticleType } from './dataAgent';

type Props = {
  article: ArticleType;
  allTags: string[];
  onSave: (tags: string[]) => Promise<void>;
  onClose: () => void;
};

export function TagManager(props: Props) {
  const { article, allTags, onSave, onClose } = props;
  const _ = useTranslation();
  const [tags, setTags] = useState<string[]>(article.tags || []);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAddTag = useCallback((tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setNewTag('');
    }
  }, [tags]);

  const handleRemoveTag = useCallback((tag: string) => {
    setTags(tags.filter(t => t !== tag));
  }, [tags]);

  const handleAddNewTag = () => {
    if (newTag.trim()) {
      handleAddTag(newTag);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(tags);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
      <div className='bg-base-100 rounded-lg p-4 max-w-md w-full max-h-95 mx-4 overflow-auto'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-bold'>{_('Edit Tags')}</h3>
          <button
            onClick={onClose}
            disabled={saving}
            className='btn btn-ghost btn-sm btn-circle'
          >
            <IoClose size={20} />
          </button>
        </div>

        <div className='mb-4'>
          <p className='text-sm text-base-content/60 mb-2'>{article.title}</p>
        </div>

        {/* Existing tags */}
        <div className='mb-4'>
          <label className='label'>
            <span className='label-text'>{_('Current Tags')}</span>
          </label>
          <div className='flex flex-wrap gap-2 mb-2 min-h-8'>
            {tags.length === 0 ? (
              <span className='text-sm text-base-content/50'>{_('No tags yet')}</span>
            ) : (
              tags.map((tag) => (
                <div
                  key={tag}
                  className='badge badge-primary gap-1'
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    disabled={saving}
                    className='hover:text-error'
                  >
                    <IoClose size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add new tag */}
        <div className='mb-4'>
          <label className='label'>
            <span className='label-text'>{_('Add Tag')}</span>
          </label>
          <div className='flex gap-2'>
            <input
              type='text'
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddNewTag();
                }
              }}
              placeholder={_('Type tag name...')}
              className='input input-bordered input-sm flex-1'
              disabled={saving}
            />
            <button
              onClick={handleAddNewTag}
              disabled={saving || !newTag.trim()}
              className='btn btn-primary btn-sm'
            >
              <IoAdd size={18} />
            </button>
          </div>
        </div>

        {/* Suggested tags */}
        {allTags.length > 0 && (
          <div className='mb-4'>
            <label className='label'>
              <span className='label-text'>{_('Suggested Tags')}</span>
            </label>
            <div className='flex flex-wrap gap-2'>
              {allTags.filter(t => !tags.includes(t)).map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleAddTag(tag)}
                  disabled={saving}
                  className='badge badge-outline cursor-pointer hover:badge-primary'
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className='flex gap-2 justify-end'>
          <button
            onClick={onClose}
            disabled={saving}
            className='btn btn-ghost btn-sm'
          >
            {_('Cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className='btn btn-primary btn-sm'
          >
            {saving ? _('Saving') : _('Save')}
          </button>
        </div>
      </div>
    </div>
  );
}
