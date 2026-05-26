export type ApiGet = {
  ok: true;
  policy: { intervalMinutes: number; openTime: string; closeTime: string } | null;
  categories: string[];
  limits: { category: string; maxUnits: number }[];
  configurationRequired: boolean;
  configurationErrors: string[];
};
