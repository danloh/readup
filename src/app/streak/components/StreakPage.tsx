'use client';

import clsx from 'clsx';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MdDelete, MdEdit } from 'react-icons/md';
import { marked } from 'marked';

import { useEnv } from '@/context/EnvContext';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { loadUsage, UsageDay, UsageRecord } from '@/services/usageService';
import { useLibraryStore } from '@/store/libraryStore';
import { Review } from '@/types/book';
import { formatDateTime } from '@/utils/book';
import UserInfo from './UserInfo';
import HeatMap, { ActivityRecord } from './HeatMap';

const StreakPage = () => {
  const _ = useTranslation();
  const { appService, envConfig } = useEnv();
  const router = useRouter();
  const { library } = useLibraryStore();

  useTheme({ systemUIVisible: false });

  const [usage, setUsage] = useState<ActivityRecord>({});
  const [reviews, setReviews] = useState<Review[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const getUsage = async () => {
      try {
        const data: UsageRecord = await loadUsage(envConfig);
        const activityRecord: ActivityRecord = {};
        for (const [day, dayData] of Object.entries(data)) {
          const usageData: UsageDay = { readSeconds: 0, annotations: 0 };
          const records = Object.values(dayData);
          for (const rec of records) {
            usageData.readSeconds += (rec.readSeconds || 0);
            usageData.annotations += (rec.annotations || 0);
          }
          activityRecord[day] = usageData;
        }
        setUsage(activityRecord);
      } catch (err) {
        console.error('Failed to load usage data', err);
      }
    };

    const getReviews = async () => {
      if (!appService) return;
      try {
        const rs = await appService.loadReviews();
        setReviews(Array.isArray(rs) ? rs : []);
      } catch (e) {
        console.error('Failed to load reviews', e);
      }
    };
    
    getUsage();
    getReviews();
  }, [envConfig]);

  if (!appService) {
    return (
      <div className='mx-auto max-w-4xl px-4 py-8'>
        <div className='rounded-lg shadow-md'>
          <div className='flex min-h-[300px] items-center justify-center p-6'>
            <div className='text-base-content animate-pulse'>{_('Loading profile...')}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='profile-view w-full h-full p-2 border-t-2 border-base-100'>
      <div className='flex h-full w-full flex-col items-center bg-base-200'>
        <div className='flex flex-col gap-y-4 px-2 w-full overlfow-y-auto'>
          <UserInfo />
          <div className='flex items-center justify-center p-2'>
            <HeatMap data={usage} onClickCell={(d) => console.log('day click', d)} />
          </div>
          <div className='max-w-[835px] px-4 mt-4 mx-auto'>
            {reviews.length === 0 ? (
              <div className='text-sm text-muted'>{_('No reviews yet')}</div>
            ) : (
              <div className='flex flex-col gap-2'>
                {reviews.map((r) => {
                  const book = library.find((b) => b.hash === r.bookHash);
                  return (
                    <div 
                      key={r.id} 
                      className='p-2 shadow-sm flex items-start justify-between'
                    >
                      <div>
                        <div className='w-full flex flex-row items-center justify-between gap-2'>
                          <div className='text-xs text-success'>
                            {r.title || book?.title || r.bookHash}
                          </div>
                          <div className='flex gap-2 opacity-0 hover:opacity-70'>
                            <button 
                              className='btn btn-xs btn-ghost' 
                              onClick={() => router.push(`/write?id=${r.id}`)}
                              title={_('Edit')}
                            >
                              <MdEdit size={16} />
                            </button>
                            <button
                              className='btn btn-xs btn-ghost'
                              title={_('Delete')}
                              onClick={async () => {
                                const ok = confirm('Delete this review?');
                                if (!ok) return;
                                try {
                                  const rs = await appService.loadReviews();
                                  const updated = (rs || []).filter((x: any) => x.id !== r.id);
                                  await appService.saveReviews(updated);
                                  setReviews(updated);
                                } catch (e) {
                                  console.error('Failed to delete review', e);
                                }
                              }}
                            >
                              <MdDelete size={16} color={'orange'} />
                            </button>
                          </div>
                        </div>
                        <div
                          className={clsx(
                            'content prose prose-xl font-size-sm w-full mt-2',
                            expanded ? 'h-full' : 'max-h-[200px] overflow-auto'
                          )}
                          dir='auto'
                          dangerouslySetInnerHTML={{__html: marked.parse(r.text)}}
                        />
                        <div className='mt-1 text-center' onClick={() => setExpanded(prev => !prev)}>
                          -·-·-
                        </div>
                        <div className='text-xs opacity-65'>
                          {"⭐".repeat(r.rating || 1)} • {formatDateTime(r.createdAt!)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreakPage;
