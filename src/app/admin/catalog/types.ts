export type ServiceRow = {
  id: string;
  name: string;
  category: string;
  isExternalActivity: boolean;
  isActive: boolean;
  requiresPlatform: boolean;
  requiresJetski: boolean;
  requiresMonitor: boolean;
  isLicense: boolean;
  visibleInStore: boolean;
  visibleInBooth: boolean;
  visibleInWeb: boolean;
};
