'use client';

import clsx from 'clsx';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { MdError } from 'react-icons/md';
import { marked } from 'marked';

import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { getProfile, UserProfile } from '@/services/bsky/auth';
import { downloadPublicDataFile } from '@/services/bsky/atfile';
import { Review } from '@/types/book';
import { formatDateTime } from '@/utils/book';
import HeatMap, { ActivityRecord } from '@/app/streak/components/HeatMap';
import { UsageDay } from '@/services/usageService';

const PublicProfilePage = () => {
  const _ = useTranslation();
  const router = useRouter();
  const handle = router.query['handle'] as string;

  useTheme({ systemUIVisible: false });

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [usage, setUsage] = useState<ActivityRecord>({});
  const [reviews, setReviews] = useState<Review[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPublicProfile = async () => {
      if (!handle) {
        setError(_('No handle provided'));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get profile to resolve DID
        const userProfile = await getProfile(handle);
        if (!userProfile?.did) {
          throw new Error(_('User not found'));
        }
        setProfile(userProfile);

        // Load usage data
        try {
          const usageResult = await downloadPublicDataFile('usage.json', userProfile.did);
          if (usageResult.docData) {
            const text = await usageResult.docData.text();
            const usageData = JSON.parse(text);
            const activityRecord: ActivityRecord = {};
            
            for (const [day, dayData] of Object.entries(usageData)) {
              const usageDay: UsageDay = { readSeconds: 0, annotations: 0 };
              const records = Object.values(dayData as any);
              for (const rec of records) {
                const r = rec as any;
                usageDay.readSeconds += (r.readSeconds || 0);
                usageDay.annotations += (r.annotations || 0);
              }
              activityRecord[day] = usageDay;
            }
            setUsage(activityRecord);
          }
        } catch (err) {
          console.warn('Failed to load public usage data:', err);
          // Not critical, continue without usage data
        }

        // Load reviews data
        try {
          const reviewsResult = await downloadPublicDataFile('reviews.json', userProfile.did);
          if (reviewsResult.docData) {
            const text = await reviewsResult.docData.text();
            const reviewsData = JSON.parse(text);
            setReviews(Array.isArray(reviewsData) ? reviewsData : []);
          }
        } catch (err) {
          console.warn('Failed to load public reviews data:', err);
          // Not critical, continue without reviews
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to load public profile:', err);
        setError(
          err instanceof Error 
            ? err.message 
            : _('Failed to load profile')
        );
        setLoading(false);
      }
    };

    loadPublicProfile();
    console.log('load');
  }, [handle]);

  if (loading) {
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

  if (error) {
    return (
      <div className='mx-auto max-w-4xl px-4 py-8'>
        <div className='rounded-lg shadow-md bg-error bg-opacity-20'>
          <div className='flex min-h-[300px] items-center justify-center p-6'>
            <div className='flex gap-4 items-center'>
              <MdError size={24} className='text-error' />
              <div className='text-base-content'>{error}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className='mx-auto max-w-4xl px-4 py-8'>
        <div className='rounded-lg shadow-md'>
          <div className='flex min-h-[300px] items-center justify-center p-6'>
            <div className='text-base-content'>{_('Profile not found')}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='profile-view w-full h-full p-2 border-t-2 border-base-100'>
      <div className='flex h-full w-full flex-col items-center bg-base-200'>
        <div className='flex flex-col gap-y-4 px-2 w-full overflow-y-auto'>
          {/* User Header */}
          <div className='flex gap-4 items-center justify-center p-4'>
            {profile.avatar && (
              <img
                src={profile.avatar}
                alt={profile.handle}
                className='w-16 h-16 rounded-full'
              />
            )}
            <div>
              <h1 className='text-2xl font-bold'>{profile.displayName || profile.handle}</h1>
              <a href={`https://bsky.app/profile/${profile.handle}`}>@{profile.handle}</a>
              {profile.description && (
                <p className='text-sm mt-2 line-clamp-1'>{profile.description}</p>
              )}
            </div>
          </div>
          {/* Heat Map */}
          <div className='flex items-center justify-center p-2'>
            <HeatMap data={usage} onClickCell={(d) => console.log('day click', d)} />
          </div>

          {/* Reviews */}
          <div className='max-w-[835px] px-2 mt-4 mx-auto'>
            {reviews.length === 0 ? (
              <div className='text-sm text-muted'>{_('No reviews yet')}</div>
            ) : (
              <div className='flex flex-col gap-2'>
                {reviews.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((r) => {
                  return (
                    <div
                      key={r.id}
                      className='py-2 shadow-sm flex items-start justify-between'
                    >
                      <div className='w-full'>
                        <div className='w-full flex flex-row items-center justify-between gap-2'>
                          <div className='text-sm text-success'>
                            {r.title || r.book?.title}
                          </div>
                        </div>
                        <div className='text-xs opacity-65'>
                          {!!r.book && (
                            <a
                              className='mr-1'
                              title={r.book?.title}
                              href={`/read/${r.book?.hash}?did=${profile.did}`}
                            >
                              {r.book?.title.substring(0, 12)}
                            </a>
                          )}
                          {!!r.book && '•'}
                          {!!r.rating && (
                            <span className='mx-1'>{'⭐'.repeat(r.rating || 1)}</span>
                          )}
                          {!!r.rating && '•'}
                          <span className='ml-1'>{formatDateTime(r.createdAt!)}</span>
                        </div>
                        <div
                          className={clsx(
                            'content prose prose-xl font-size-sm w-full mt-2 max-w-none',
                            expanded ? 'h-full' : 'max-h-[200px] overflow-auto'
                          )}
                          dir='auto'
                          dangerouslySetInnerHTML={{ __html: marked.parse(r.text) }}
                        />
                        <div
                          className='mt-1 text-center cursor-pointer'
                          onClick={() => setExpanded((prev) => !prev)}
                        >
                          -·-·-
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

export default PublicProfilePage;
