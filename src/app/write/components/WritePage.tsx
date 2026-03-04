'use client'

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { marked } from 'marked';

import { useEnv } from '@/context/EnvContext';
import { Book, Review } from '@/types/book';
import { formatAuthors, formatTitle } from '@/utils/book';
import { useTranslation } from '@/hooks/useTranslation';

const WritePage = () => {
  const _ = useTranslation();
  const router = useRouter();
  const search = useSearchParams();
  const bookHash = search?.get('book') || '';
  const reviewId = search?.get('id') || '';
  const { appService } = useEnv();

  const [book, setBook] = useState<Book | undefined>(undefined);
  const [rating, setRating] = useState<number>(0);
  const [title, setTitle] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  useEffect(() => {
    (async () => {
      if (!appService || !reviewId) return;
      try {
        if (reviewId.trim()) {
          const reviews = await appService.loadReviews();
          const r = reviews.find((x: any) => x.id === reviewId);
          if (r) {
            setRating(r.rating || 0);
            setTitle(r.title || '');
            setText(r.text || '');
            setBook(r.book);
          }
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [appService, reviewId]);

  useEffect(() => {
    (() => {
      const bookJson = localStorage.getItem('toReviewBook');
      if (!bookJson) return;
      const book: Book = JSON.parse(bookJson);
      if (book.hash !== bookHash) return;
      setBook(book);
    })();
  }, [bookHash]);

  const onSave = async () => {
    if (!appService) return;
    setSaving(true);
    try {
      const reviews = await appService.loadReviews();
      if (reviewId) {
        const idx = reviews.findIndex((x: Review) => x.id === reviewId);
        if (idx >= 0) {
          reviews[idx] = { 
            ...reviews[idx]!, 
            title, 
            rating, 
            text, 
            updatedAt: Date.now() 
          };
        } else {
          reviews.push({ 
            id: reviewId, 
            bookHash, 
            book,
            title: title, 
            rating, 
            text, 
            createdAt: Date.now() 
          });
        }
      } else {
        const newReview = {
          id: String(Date.now()),
          bookHash,
          book,
          title: title,
          rating,
          text,
          createdAt: Date.now(),
        };
        reviews.push(newReview);
      }
      await appService.saveReviews(reviews);
      router.back();
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[100vh-52px] h-full py-4 px-8 w-full mx-auto">
      {book && (
        <>
          <div className=''>
            <h4 className='line-clamp-2 w-[90%] text-sm font-semibold'>
              {formatTitle(book.title).replace(/\u00A0/g, ' ')}
            </h4>
            <p className='truncate text-xs opacity-75'>{formatAuthors(book.author)}</p>
          </div>
          <label className="block mb-2">
            {_('Rating')}
            <select 
              value={rating} 
              onChange={(e) => setRating(Number(e.target.value))} 
              className="ml-2 bg-base-100 text-sm"
            >
              <option value={0}>{_('Choose')}</option>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (<option key ={n} value={n}>{n}</option>))}
            </select>
          </label>
        </>
      )}
      <input
        type='text'
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={_('Title')}
        className="w-full mt-1 p-2 rounded-md bg-base-100 focus:outline-none focus:ring-1 focus:ring-blue-500" 
        required
      />
      <div className="flex-1 flex flex-col">
        {mode === 'write' && (
          <textarea 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            placeholder={_('Start to write...')}
            className="flex-1 w-full mt-1 p-2 rounded-md bg-base-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none overflow-y-auto" 
            required
          />
        )}
        {mode === 'preview' && (
          <div 
            className="flex-1 prose max-w-none w-full mt-1 p-2 rounded-md bg-base-100 overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: marked.parse(text) }}
          />
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <button className="btn btn-sm btn-primary" onClick={onSave} disabled={saving}>
          {_('Save')}
        </button>
        <button className="btn btn-sm" onClick={() => router.back()} disabled={saving}>
          {_('Cancel')}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === 'write' ? 'preview' : 'write')}
          className="btn btn-sm btn-outline"
        >
          {mode === 'write' ? _('Preview') : _('Write')}
        </button>
      </div>
    </div>
  );
};

export default WritePage;
