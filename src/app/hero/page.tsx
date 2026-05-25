'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  const features = [
    {
      icon: '📚',
      title: 'Multi-Format Reading',
      description: 'EPUB, PDF, MOBI, AZW, CBZ and more.',
    },
    {
      icon: '✏️',
      title: 'Rich Annotations',
      description: 'Highlight, underline, and annotate with ease.',
    },
    {
      icon: '🔗',
      title: 'Share to Bluesky',
      description: 'Share excerpts directly with formatted images.',
    },
    {
      icon: '📖',
      title: 'Track Progress',
      description: 'Monitor reading statistics and milestones.',
    },
    {
      icon: '🔍',
      title: 'Full-Text Search',
      description: 'Quickly find passages within your books.',
    },
    {
      icon: '🎨',
      title: 'Customizable Theme',
      description: 'Fonts, colors, and spacing to your preference.',
    },
  ];

  const handleGetStarted = () => {
    router.push('/library');
  };

  return (
    <div 
      className='min-h-screen'
      style={{
        background: '#faf6f1',
      }}
    >
      {/* Navigation */}
      <nav className='sticky top-0 z-50 border-b-2' style={{ background: '#f5ead6', borderColor: '#c4975a' }}>
        <div className='max-w-6xl mx-auto px-4 py-4 flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <span 
              className='text-2xl font-bold'
              style={{ color: '#6b4423', fontFamily: 'Georgia, serif' }}
            >
              Readup
            </span>
          </div>
          <button
            onClick={() => router.push('/library')}
            className='px-6 py-2 font-semibold transition hover:shadow-md'
            style={{
              background: '#c4975a',
              color: '#f5ead6',
            }}
          >
            {'Library'}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section 
        className='min-h-[65vh] flex items-center justify-center px-4 py-20'
        style={{
          background: 'linear-gradient(135deg, #d9cfc7 0%, #e8ddd2 100%)',
        }}
      >
        <div className='max-w-2xl text-center'>
          <h1 
            className='text-5xl md:text-6xl font-bold mb-6 leading-tight'
            style={{ color: '#6b4423', fontFamily: 'Georgia, serif' }}
          >
            Feed with Books
          </h1>
          <p 
            className='text-lg md:text-xl mb-10 leading-relaxed font-serif'
            style={{ color: '#8b6f47' }}
          >
            A refined feed and ebook reader designed for readers who care about the details. Annotate, highlight, and share your favorite passages.
          </p>
          <button
            onClick={handleGetStarted}
            className='px-10 py-3 text-lg font-semibold transition hover:shadow-lg border-3 hover:scale-105'
            style={{
              background: '#c4975a',
              color: '#f5ead6',
              borderColor: '#6b4423',
              fontFamily: 'Georgia, serif',
            }}
          >
            Start Reading
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section 
        className='py-20 px-4'
        style={{ background: '#faf6f1' }}
      >
        <div className='max-w-6xl mx-auto'>
          <div className='text-center mb-16'>
            <h2 
              className='text-4xl font-bold mb-2'
              style={{ color: '#6b4423', fontFamily: 'Georgia, serif' }}
            >
              Crafted Features
            </h2>
            <div 
              className='w-16 h-1 mx-auto mt-4'
              style={{ background: '#c4975a' }}
            />
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {features.map((feature, index) => (
              <div
                key={index}
                className='p-6 transition hover:shadow-md hover:scale-105'
                style={{
                  background: '#f5ead6',
                }}
              >
                <div className='text-4xl mb-4'>{feature.icon}</div>
                <h3 
                  className='text-lg font-bold mb-2'
                  style={{ color: '#6b4423', fontFamily: 'Georgia, serif' }}
                >
                  {feature.title}
                </h3>
                <p 
                  className='text-sm font-serif'
                  style={{ color: '#8b6f47' }}
                >
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Highlights Section */}
      <section 
        className='py-20 px-4'
        style={{
          background: 'linear-gradient(135deg, #e8ddd2 0%, #d9cfc7 100%)',
        }}
      >
        <div className='max-w-5xl mx-auto'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-12'>
            <div className='text-center'>
              <div 
                className='text-5xl font-bold mb-3'
                style={{ color: '#c4975a' }}
              >
                ∞
              </div>
              <h3 
                className='text-lg font-bold mb-2 font-serif'
                style={{ color: '#6b4423' }}
              >
                All Formats
              </h3>
              <p 
                className='text-sm font-serif'
                style={{ color: '#8b6f47' }}
              >
                Read any book format you have
              </p>
            </div>
            <div className='text-center'>
              <div 
                className='text-5xl font-bold mb-3'
                style={{ color: '#c4975a' }}
              >
                🔄
              </div>
              <h3 
                className='text-lg font-bold mb-2 font-serif'
                style={{ color: '#6b4423' }}
              >
                Sync Seamlessly
              </h3>
              <p 
                className='text-sm font-serif'
                style={{ color: '#8b6f47' }}
              >
                Progress synced across devices
              </p>
            </div>
            <div className='text-center'>
              <div 
                className='text-5xl font-bold mb-3'
                style={{ color: '#c4975a' }}
              >
                🌐
              </div>
              <h3 
                className='text-lg font-bold mb-2 font-serif'
                style={{ color: '#6b4423' }}
              >
                Share Stories
              </h3>
              <p 
                className='text-sm font-serif'
                style={{ color: '#8b6f47' }}
              >
                Share with your Bluesky community
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section 
        className='py-20 px-4'
        style={{ background: '#faf6f1' }}
      >
        <div className='max-w-2xl mx-auto text-center'>
          <h2 
            className='text-4xl font-bold mb-4 font-serif'
            style={{ color: '#6b4423' }}
          >
            Ready to Read Better?
          </h2>
          <p 
            className='text-base mb-8 font-serif'
            style={{ color: '#8b6f47' }}
          >
            Join readers who believe books deserve to be read beautifully.
          </p>
          <button
            onClick={handleGetStarted}
            className='px-10 py-3 text-lg font-semibold transition hover:shadow-lg hover:scale-105'
            style={{
              background: '#c4975a',
              color: '#f5ead6',
              fontFamily: 'Georgia, serif',
            }}
          >
            Build Your Library
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer 
        className='text-center py-8'
        style={{
          background: '#d9cfc7',
        }}
      >
        <p 
          className='font-serif text-sm mb-1'
          style={{ color: '#6b4423' }}
        >
          Crafted with care for book lovers
        </p>
        <p 
          className='text-xs'
          style={{ color: '#8b6f47' }}
        >
          © MMXXVI Readup. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
