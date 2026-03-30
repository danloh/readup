import React, { memo, useCallback, useEffect, useState } from 'react';
import { CiHashtag } from "react-icons/ci";
import { IoMdLink, IoMdStar, IoMdStarOutline } from 'react-icons/io';
import { IoPlayOutline } from "react-icons/io5";
import { FcReadingEbook } from "react-icons/fc";

import { useEnv } from '@/context/EnvContext';
import { useRouter } from 'next/navigation';
import { mergeArrays } from '@/utils/book';
import { eventDispatcher } from '@/utils/event';
import { isWebAppPlatform } from '@/services/environment';
import { useTranslation } from '@/hooks/useTranslation';
import { FeedEpubService } from '../epub/feedEpubService';
import { TagManager } from './TagManager';
import { TagFilter } from './TagFilter';
import * as dataAgent from './dataAgent';
import { ArticleType, dateCompare, FeedType, fmtDatetime, getFavicon } from './dataAgent';

type Props = {
  channel: FeedType | null;
  isStarChannel?: boolean;
  entries: ArticleType[] | null;
  loading: boolean;
  showSide?: () => void;
  onPlayAudio?: (article: ArticleType) => void;
};

export function Channel(props: Props) {
  const { channel, isStarChannel, entries, loading, showSide, onPlayAudio } = props;

  if (loading) {
    return (
      <div className='flex items-center justify-center'>Loading...</div>
    );
  } else if (!entries) {
    return (<></>);
  }

  return (
    <div className='flex flex-col items-between justify-center'>
      <div className='flex flex-row items-center justify-start gap-2 p-2 bg-base-300'>
        <button className='btn btn-xs btn-ghost' onClick={showSide}>
          ☰
        </button>
        <b className='text-info' >{entries.length}</b>
        <b className='font-bold'>{channel?.title || (isStarChannel ? 'Starred' : '')}</b>
      </div>
      <ArticleList articles={entries} isInStar={isStarChannel} onPlayAudio={onPlayAudio} />
    </div>
  );
}

type ListProps = {
  articles: ArticleType[];
  isInStar?: boolean;
  onPlayAudio?: (article: ArticleType) => void;
};

function ArticleList(props: ListProps) {
  const { articles, isInStar, onPlayAudio } = props;
  const { envConfig } = useEnv();
  const _ = useTranslation();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [showFreshEpubConfirm, setShowFreshEpubConfirm] = useState(false);
  const [freshTitle, setFreshTitle] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [articleToEdit, setArticleToEdit] = useState<ArticleType | null>(null);

  const sortedArticles = articles.length >= 2 
    ? articles.sort((n1, n2) => {
        return n2.published && n1.published 
          ? dateCompare(n2.published, n1.published)
          : 0;
      })
    : articles;

  // Filter articles by selected tags
  const filteredArticles = selectedTags.length === 0
    ? sortedArticles
    : sortedArticles.filter((article) => {
        if (!article.tags || article.tags.length === 0) return false;
        return selectedTags.some(tag => article.tags?.includes(tag));
      });

  const handleExportToEpub = useCallback(async (createFresh: boolean = false) => {
    if (createFresh && freshTitle.trim()) {
      eventDispatcher.dispatch('toast', {
        type: 'info',
        timeout: 2000,
        message: _('Need to name the fresh EPUB'),
      });
      return;
    }
    
    const articlesToExport = selectedTags.length > 0 ? filteredArticles : sortedArticles;
    
    if (articlesToExport.length === 0) {
      eventDispatcher.dispatch('toast', {
        type: 'warn',
        timeout: 2000,
        message: _('No articles to export'),
      });
      return;
    }

    setExporting(true);
    try {
      const appService = await envConfig.getAppService();
      const library = await appService.loadLibraryBooks();

      console.log('Starting EPUB export with', articlesToExport.length, 'articles', { createFresh });

      const { book, migrationWarnings } = await FeedEpubService.createOrUpdateEpub(
        articlesToExport,
        appService,
        library,
        createFresh,
        freshTitle
      );

      console.log('EPUB export completed. Book:', book);

      if (migrationWarnings.length > 0) {
        console.warn('Migration warnings:', migrationWarnings);
        const warningMsg = migrationWarnings.join('\n');
        eventDispatcher.dispatch('toast', {
          type: 'warn',
          timeout: 2000,
          message: _('EPUB updated. Annotation status: {{msg}}', { msg: warningMsg }),
        });
      } else {
        eventDispatcher.dispatch('toast', {
          type: 'info',
          timeout: 2000,
          message: _('EPUB created successfully')
        });
      }

      // Navigate to reader with the starred EPUB
      setTimeout(() => {
        console.log('Navigating to reader with book hash:', book.hash);
        router.push(`/reader/${book.hash}`);
      }, 500);
    } catch (error) {
      console.error('Failed to export to EPUB:', error);
      eventDispatcher.dispatch('toast', {
        type: 'warn',
        timeout: 2000,
        message: _('Failed to export')
      });
    } finally {
      setExporting(false);
      setShowFreshEpubConfirm(false);
    }
  }, [freshTitle, filteredArticles, sortedArticles, selectedTags.length]);

  return (
    <div className='flex flex-col'>
      {isInStar && sortedArticles.length > 0 && (
        <>
          {/* Tag Filter */}
          <TagFilter
            articles={sortedArticles}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
          />
          
          {/* Export button */}
          <div className='p-2 bg-base-200 border-b'>
            <div className='flex gap-2 items-start justify-center'>
              <div className='flex-1 flex gap-2 items-start justify-start'>
                <button
                  onClick={() => setShowFreshEpubConfirm(prev => !prev)}
                  disabled={exporting}
                  className='btn btn-sm btn-primary gap-2'
                >
                  <FcReadingEbook size={18} />
                  {exporting ? 'Creating EPUB...' : `Export to EPUB (${filteredArticles.length})`}
                </button>
              </div>
            </div>
            {showFreshEpubConfirm && (
              <div className='mt-3 p-2 bg-base-100 rounded border'>
                <p className='text-xs text-base-content/60 mb-2'>
                  Converts {selectedTags.length > 0 ? 'filtered ' : ''}starred articles into an EPUB book. Create or Update: annotations will persist across updates; Create Fresh: create EPUB from scratch.
                </p>
                <div className='flex gap-2'>
                  <button
                    onClick={() => handleExportToEpub(false)}
                    disabled={exporting}
                    className='btn btn-xs btn-warning'
                  >
                    Create or Update
                  </button>
                  <input
                    type='text'
                    value={freshTitle}
                    onChange={(e) => setFreshTitle(e.target.value.trim())}
                    placeholder='New EPUB Name'
                    className='input input-xs input-bordered'
                  />
                  <button
                    onClick={() => handleExportToEpub(true)}
                    disabled={exporting}
                    className='btn btn-xs btn-success'
                  >
                    Create Fresh
                  </button>
                  <button
                    onClick={() => setShowFreshEpubConfirm(false)}
                    disabled={exporting}
                    className='btn btn-xs btn-ghost'
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      <div className='p-2 space-y-2'>
        {filteredArticles.map((article: ArticleType, idx: number) => {
          return (
            <ArticleItem
              key={`${article.link}-${idx}`}
              entry={article}
              isInStar={isInStar}
              onPlayAudio={onPlayAudio}
              onEditTags={(article) => setArticleToEdit(article)}
            />
          )}
        )}
      </div>
      
      {/* Tag Manager Modal */}
      {articleToEdit && (
        <TagManager
          article={articleToEdit}
          allTags={Array.from(new Set(sortedArticles.flatMap(a => a.tags || [])))}
          onSave={async (tags) => {
            const appService = await envConfig.getAppService();
            const oldArticles = await appService.loadArticles();
            
            const updatedArticle = { ...articleToEdit, tags };
            const newArticles = mergeArrays(oldArticles, [updatedArticle], 'link');
            await appService.saveArticles(newArticles);
            
            // Update the local article object
            const articleIdx = articles.findIndex(a => a.link === articleToEdit.link);
            if (articleIdx >= 0 && articles[articleIdx]) {
              articles[articleIdx]!.tags = tags;
            }
          }}
          onClose={() => setArticleToEdit(null)}
        />
      )}
    </div>
  );
}

type ItemProps = {
  entry: ArticleType;
  isInStar?: boolean;
  onPlayAudio?: (article: ArticleType) => void;
  onEditTags?: (article: ArticleType) => void;
};

const ArticleItem = memo(function ArticleItm(props: ItemProps) {
  const { entry: article, isInStar, onPlayAudio, onEditTags } = props;
  const { envConfig } = useEnv();
  const [isStar, setIsStar] = useState(isInStar);
  const [expanded, setExpanded] = useState(false);

  const updateStar = async (article: ArticleType, toStar: boolean) => {
    const appService = await envConfig.getAppService();
    const oldArticles = await appService.loadArticles();
    
    // just change the status then merge to old articles
    if (toStar) {
      // ensure the content of article is fetched
      if (!article.content?.trim() && isWebAppPlatform()) {
        article = await dataAgent.fetchArticle(article.link);
      }
      article.status = 'star';
    } else {
      article.status = '';
    }
    const newArticles = mergeArrays(oldArticles, [article], 'link');
    await appService.saveArticles(newArticles);
  };

  return (
    <div className='flex flex-col items-start justify-center m-1 border border-base-300 rounded p-2'>
      <div 
        className='flex flex-row items-center justify-start' 
        onClick={() => setExpanded(prev => !prev)}
      >
        <h2 className='flex-1 text-lg text-info cursor-pointer'>{article.title}</h2>
      </div>
      {/* Tags display */}
      {article.tags && article.tags.length > 0 && (
        <div className='flex flex-wrap gap-1 mb-2'>
          {article.tags.map((tag) => (
            <span key={tag} className='badge badge-sm badge-outline'>
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className='flex flex-row items-center justify-start'>
        <img src={getFavicon(article.link!)} className='h-4 w-4 m-1' alt='>' loading='lazy' />
        <span className='m-1 text-sm'>
          {fmtDatetime(article.published || '')}
        </span>
        <a
          className='m-1'
          target='_blank'
          rel='noreferrer'
          href={article.link}
        >
          <IoMdLink size={20} />
        </a>
        {article.audio_url && (
          <span 
            className='m-1 cursor-pointer' 
            onClick={() => onPlayAudio?.(article)}
            title='Play audio'
          >
            <IoPlayOutline size={20} />
          </span>
        )}
        <span 
          className='m-1 cursor-pointer' 
          onClick={async () => {
            await updateStar(article, !isStar);
            setIsStar(!isStar);
          }}
        >
          {isInStar 
            ? (<IoMdStar size={20} className={`${isStar ? 'text-success' : 'text-info'}`} />)
            : (<IoMdStarOutline size={20} className={`${isStar ? 'text-success' : ''}`} />)
          }
        </span>
        {isInStar && (
          <span 
            className='m-1 cursor-pointer' 
            onClick={() => onEditTags?.(article)}
            title='Edit tags'
          >
            <CiHashtag size={18} />
          </span>
        )}
      </div>
      {expanded 
        ? <ArticleView entry={article} onClick={() => setExpanded(prev => !prev)} />
        : <ArticlePreview 
            content={article.description || ''} 
            onClick={() => setExpanded(prev => !prev)}
          />
      }
    </div>
  );
});

function ArticleView({ entry, onClick } : { entry: ArticleType; onClick: () => void; }) {
  const { envConfig } = useEnv();
  const [pageContent, setPageContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadArticle = async (entry: ArticleType) => {
      const link = entry?.link;
      if (!link || !link.trim()) {
        return;
      }

      let res = entry;
      if (isWebAppPlatform()) {
        try {
          res = await dataAgent.fetchArticle(link);
          // On Web, fetch full article here, save to loacl as cache
          const appService = await envConfig.getAppService();
          const localArticles = await appService.loadArticles();
          const newArticles = mergeArrays(localArticles, [res], 'link');
          await appService.saveArticles(newArticles);
        } catch(e) {
          console.error('Error on Fetch article on web: ', e);
          res = entry;
        }
      }

      const content = (res?.content || entry?.description || '').replace(
        /<a[^>]+>/gi,
        (a: string) => {
          return (!/\starget\s*=/gi.test(a)) ? a.replace(/^<a\s/, `<a target='_blank'`) : a;
        }
      );

      setPageContent(content);
      setLoading(false);
    };

    if (entry?.link) {
      loadArticle(entry);
    }
  }, [entry]);

  if (loading) {
    return (
      <div className='text-center px-2 py-4 text-success'>Loading...</div>
    );
  }

  return (
    <div className='h-full p-2'>
      <div
        className='content prose prose-sm'
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{__html: pageContent}}
      />
      <div className='mt-1 text-center' onClick={onClick}>-·-·-</div>
    </div>
  );
}

function ArticlePreview({ content, onClick } : { content: string; onClick: () => void; }) {
  const pageContent = content.replace(
    /<a[^>]+>/gi,
    (a: string) => {
      return (!/\starget\s*=/gi.test(a)) ? a.replace(/^<a\s/, `<a target='_blank'`) : a;
    }
  );

  return (
    <div className='h-full p-2' onClick={onClick}>
      <div
        className='content prose prose-sm max-h-[128px] overflow-auto'
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{__html: pageContent}}
      />
    </div>
  );
}
