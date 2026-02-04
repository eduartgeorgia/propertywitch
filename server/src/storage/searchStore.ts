import type { Listing } from "../domain/listing";

export type StoredSearch = {
  id: string;
  createdAt: string;
  listings: Listing[];
};

const store = new Map<string, StoredSearch>();

export const saveSearch = (search: StoredSearch) => {
  store.set(search.id, search);
};

export const getSearch = (id: string) => store.get(id);
