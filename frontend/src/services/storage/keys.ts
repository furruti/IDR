export const LOCAL_STORAGE_KEYS = ['cctvs:cctv_data_v1','SGI_activos','RCK_data'] as const;
export type LocalStorageKey = (typeof LOCAL_STORAGE_KEYS)[number] | string;
