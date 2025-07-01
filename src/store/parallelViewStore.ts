import { create } from 'zustand';

interface ParallelViewState {
  parallelViews: Set<string>[];
  setParallel: (bookKey1: string, bookKey2: string) => void;
  unsetParallel: (bookKey1: string, bookKey2: string) => void;
  areParallels: (bookKey1: string, bookKey2: string) => boolean;
  getParallels: (bookKey: string) => Set<string> | null;
}

export const useParallelViewStore = create<ParallelViewState>((set, get) => ({
  parallelViews: [],

  setParallel: (bookKey1: string, bookKey2: string) => {
    set((state) => {
      const newGroups = [...state.parallelViews];
      const group1 = newGroups.find((group) => group.has(bookKey1));
      const group2 = newGroups.find((group) => group.has(bookKey2));

      if (group1 && group2) {
        if (group1 !== group2) {
          group1.forEach((key) => group2.add(key));
          newGroups.splice(newGroups.indexOf(group1), 1);
        }
      } else if (group1) {
        group1.add(bookKey2);
      } else if (group2) {
        group2.add(bookKey1);
      } else {
        // Neither book is in a group, create a new group
        newGroups.push(new Set([bookKey1, bookKey2]));
      }

      return { parallelViews: newGroups };
    });
  },
  unsetParallel: (bookKey1: string, bookKey2: string) => {
    set((state) => {
      const newGroups = [...state.parallelViews];
      const group = newGroups.find((group) => group.has(bookKey1) && group.has(bookKey2));

      if (group) {
        group.delete(bookKey1);
        group.delete(bookKey2);

        // If the group becomes disjointed, split into separate groups
        const remainingKeys = Array.from(group);
        if (remainingKeys.length > 0) {
          newGroups.push(new Set(remainingKeys));
        }

        // Remove the original group
        newGroups.splice(newGroups.indexOf(group), 1);
      }

      return { parallelViews: newGroups };
    });
  },

  areParallels(bookKey1, bookKey2) {
    const { parallelViews } = get();
    return parallelViews.some((group) => group.has(bookKey1) && group.has(bookKey2));
  },

  getParallels(bookKey) {
    const { parallelViews } = get();
    return parallelViews.find((group) => group.has(bookKey)) || null;
  },
}));
