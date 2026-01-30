'use client';

import React, { useEffect, useState } from 'react';
import HeatMap, { ActivityRecord } from './HeatMap';
import { useEnv } from '@/context/EnvContext';
import * as usageService from '@/services/usageService';

export default function StreakHeatMap() {
  const { envConfig } = useEnv();
  const [data, setData] = useState<ActivityRecord>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!envConfig) return;
      const usage = await usageService.loadUsage(envConfig);
      if (!mounted) return;
      const record: ActivityRecord = {};
      for (const [d, v] of Object.entries(usage)) {
        // record[d] = {
        //   activityNum: Math.ceil((v.readSeconds || 0) / 60) + (v.annotations || 0),
        //   readNum: Math.ceil((v.readSeconds || 0) / 60),
        //   noteNum: v.annotations || 0,
        // };
      }
      setData(record);
    })();
    return () => { mounted = false; };
  }, [envConfig]);

  const handleCellClick = (date: string) => {
    console.log('Day clicked', date);
  };

  return (
    <div>
      <HeatMap data={data} onClickCell={handleCellClick} />
    </div>
  );
}
