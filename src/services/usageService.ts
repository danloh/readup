import { EnvConfigType } from '@/services/environment';

export type UsageDay = { readSeconds: number; annotations: number };
export type BookUsageDay = Record<string, UsageDay>; // Map<bookId, uUsageDay>
export type UsageRecord = Record<string, BookUsageDay>;

export const loadUsage = async (envConfig: EnvConfigType): Promise<UsageRecord> => {
  const appService = await envConfig.getAppService();
  try {
    const data = await appService.loadUsageData();
    return data || {};
  } catch (err) {
    console.error('Failed to load usage data', err);
    return {};
  }
};

export const saveUsage = async (envConfig: EnvConfigType, usage: UsageRecord) => {
  const appService = await envConfig.getAppService();
  await appService.saveUsageData(usage);
};

export const addReadSeconds = async (
  envConfig: EnvConfigType, bookKey_: string, secondsToAdd: number
) => {
  if (!envConfig) return;
  const appService = await envConfig.getAppService();
  const today = new Date();
  const dayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const data = (await appService.loadUsageData()) || {};
  const dayData = data[dayKey] || {}; 
  const bookKey = bookKey_.split('-')[0]!;
  const bookData = dayData[bookKey] || { readSeconds: 0, annotations: 0 };
  bookData.readSeconds = (bookData.readSeconds || 0) + Math.floor(secondsToAdd);
  dayData[bookKey] = bookData;
  data[dayKey] = dayData;
  await appService.saveUsageData(data);
};

export const incrementAnnotations = async (
  envConfig: EnvConfigType, bookKey_: string, count = 1
) => {
  const appService = await envConfig.getAppService();
  const today = new Date();
  const dayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const data = (await appService.loadUsageData()) || {};
  const dayData = data[dayKey] || {};
  const bookKey = bookKey_.split('-')[0]!;
  const bookData = dayData[bookKey] || { readSeconds: 0, annotations: 0 };
  bookData.annotations = (bookData.annotations || 0) + count;
  dayData[bookKey] = bookData;
  data[dayKey] = dayData;
  await appService.saveUsageData(data);
};
