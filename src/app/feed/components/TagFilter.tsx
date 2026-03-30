import React, { useMemo } from 'react';
import { IoClose } from 'react-icons/io5';
import { ArticleType } from './dataAgent';

type Props = {
  articles: ArticleType[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
};

export function TagFilter(props: Props) {
  const { articles, selectedTags, onTagsChange } = props;

  // Get all unique tags from articles
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    articles.forEach((article) => {
      if (article.tags) {
        article.tags.forEach((tag) => {
          tagSet.add(tag);
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [articles]);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const clearFilters = () => {
    onTagsChange([]);
  };

  if (availableTags.length === 0) {
    return null;
  }

  return (
    <div className='p-2 bg-base-200 border-b'>
      <div className='flex items-center gap-2 flex-wrap'>
        <span className='text-sm font-semibold'>
          {selectedTags.length > 0 ? `Tags(${selectedTags.length} selected):` : 'Tags:'}
        </span>
        {availableTags.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          const count = articles.filter(
            (a) => a.tags?.includes(tag)
          ).length;

          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`badge gap-1 cursor-pointer transition-all ${
                isSelected ? 'badge-primary' : 'badge-outline hover:text-primary'
              }`}
            >
              {tag}
              <span className='text-xs'>({count})</span>
            </button>
          );
        })}
        {selectedTags.length > 0 && (
          <button
            onClick={clearFilters}
            className='btn btn-xs btn-ghost gap-1'
          >
            <IoClose size={16} />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
