import { EnvConfigType } from '@/services/environment';

export type UsageDay = { readSeconds: number; annotations: number };
export type UsageRecord = Record<string, UsageDay>;

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

export const addReadSeconds = async (envConfig: EnvConfigType, secondsToAdd: number) => {
  if (!envConfig) return;
  const appService = await envConfig.getAppService();
  const today = new Date();
  const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const data = (await appService.loadUsageData()) || {};
  const day = data[key] || { readSeconds: 0, annotations: 0 };
  day.readSeconds = (day.readSeconds || 0) + Math.floor(secondsToAdd);
  data[key] = day;
  await appService.saveUsageData(data);
};

export const incrementAnnotations = async (envConfig: EnvConfigType, count = 1) => {
  const appService = await envConfig.getAppService();
  const today = new Date();
  const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const data = (await appService.loadUsageData()) || {};
  const day = data[key] || { readSeconds: 0, annotations: 0 };
  day.annotations = (day.annotations || 0) + count;
  data[key] = day;
  await appService.saveUsageData(data);
};
