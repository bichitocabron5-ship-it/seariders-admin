export type ApiGet = {
  ok: true;
  policy: { id: string; intervalMinutes: number; openTime: string; closeTime: string };
  categories: string[];
  limits: { category: string; maxUnits: number }[];
};
