'use client'

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEnv } from '@/context/EnvContext';
import { Book, Review } from '@/types/book';

const WritePage: React.FC = () => {
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
        if (idx !== -1) {
          reviews[idx] = { 
            ...reviews[idx], 
            id: reviewId, 
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
    <div className="p-4 max-w-[800px] mx-auto">
      <h2 className="text-lg font-bold mb-2">Write</h2>
      {book && (
        <>
          <div className="mb-2">{`Book: ${book.title}`}</div>
          <label className="block mb-2">
            Rating
            <select 
              value={rating} 
              onChange={(e) => setRating(Number(e.target.value))} 
              className="ml-2"
            >
              <option value={0}>Choose</option>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (<option key ={n} value={n}>{n}</option>))}
            </select>
          </label>
        </>
      )}
      <input
        type='text'
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full mt-1 p-2 rounded-md focus:outline-none"
      />
      <textarea 
        value={text} 
        onChange={(e) => setText(e.target.value)} 
        className="w-full h-80 mt-1 p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" 
      />
      <div className="flex gap-2 mt-2">
        <button className="btn btn-sm btn-primary" onClick={onSave} disabled={saving}>
          Save
        </button>
        <button className="btn btn-sm" onClick={() => router.back()} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default WritePage;
