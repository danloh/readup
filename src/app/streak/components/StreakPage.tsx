'use client';

// import clsx from 'clsx';
import React, { useState, useEffect } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { loadUsage, UsageDay, UsageRecord } from '@/services/usageService';
import UserInfo from './UserInfo';
import HeatMap, { ActivityRecord } from './HeatMap';

const StreakPage = () => {
  const _ = useTranslation();
  const { appService, envConfig } = useEnv();

  useTheme({ systemUIVisible: false });

  const [usage, setUsage] = useState<ActivityRecord>({});

  useEffect(() => {
    (async () => {
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
    })();
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
        </div>
      </div>
    </div>
  );
};

export default StreakPage;
