import { remoteApi, type Api } from './api';
import { localApi } from './localApi';

export const isStatic =
  import.meta.env.MODE === 'gh-pages' || import.meta.env.VITE_STATIC === 'true';

export const api: Api = isStatic ? localApi : remoteApi;
