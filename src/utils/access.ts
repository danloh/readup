import { User } from "@/services/bsky/auth";

export const getAuth = (): User => {
  const user = localStorage.getItem('user') ?? '{}';
  return JSON.parse(user) as User;
};

export const getAccessToken = async (): Promise<string | null> => {
  const user = localStorage.getItem('user') ?? '{}';
  return JSON.parse(user).access ?? null;
};

export const getUserID = async (): Promise<string | null> => {
  const user = localStorage.getItem('user') ?? '{}';
  return JSON.parse(user).id ?? null;
};

export const validateUserAndToken = async (authHeader: string | null | undefined) => {
  if (!authHeader) return {};

  return {};
};
