import { toValidURL } from '@/shared/lib/check';
import {
  getKnownLogRoute,
  isValidLogPath,
} from '@/features/log-viewer/log_url';
import type { RouteRecordRedirectOption } from 'vue-router';
import { createRouter, createWebHistory } from 'vue-router';

const routeModules = new Set<() => unknown>();
const recordModule = <T, S extends () => T>(v: S): S => {
  routeModules.add(v);
  return v;
};

const snapshotPage = recordModule(
  () => import('@/pages/snapshot/SnapshotPage.vue'),
);
const logPage = recordModule(() => import('@/pages/log/LogPage.vue'));

const getGithubAssetId = (v: unknown) => {
  return String(v).match(/^\d+/)?.[0]; // discard invalid characters
};

const redirectImport: RouteRecordRedirectOption = (to) => {
  const github_asset_id = getGithubAssetId(to.params.github_asset_id);
  if (!github_asset_id) {
    return { path: '/404' };
  }
  return {
    path: '/i/' + github_asset_id,
    query: to.query,
  };
};

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: recordModule(() => import('@/pages/home/HomePage.vue')),
      meta: { title: 'Home' },
    },
    {
      path: '/snapshot/:snapshotId',
      name: 'snapshot',
      component: snapshotPage,
      meta: { title: 'Snapshot' },
    },
    {
      path: '/i',
      component: recordModule(() => import('@/pages/import/ImportPage.vue')),
      meta: { title: 'Import snapshot' },
    },
    {
      path: '/i/:github_asset_id',
      component: snapshotPage,
      beforeEnter(to) {
        const github_asset_id = getGithubAssetId(to.params.github_asset_id);
        if (!github_asset_id) {
          return { path: '/404' };
        }
        if (github_asset_id != String(to.params.github_asset_id)) {
          return {
            path: '/i/' + github_asset_id,
            query: to.query,
          };
        }
      },
      meta: { title: 'Snapshot' },
    },
    {
      path: '/import',
      redirect(to) {
        return {
          path: '/i',
          query: to.query,
        };
      },
    },
    {
      path: `/import/:github_asset_id`,
      redirect: redirectImport,
    },
    {
      path: '/device',
      component: recordModule(() => import('@/pages/device/DevicePage.vue')),
      beforeEnter(to) {
        const u = toValidURL(String(to.query.url));
        if (u) {
          localStorage.setItem('device_link', u.origin);
          const query = { ...to.query };
          delete query.url;
          return { path: to.path, query, hash: to.hash };
        }
      },
      meta: { title: 'Connect device' },
    },
    {
      path: '/selector/library',
      component: recordModule(
        () => import('@/pages/selector-library/SelectorLibraryPage.vue'),
      ),
      meta: { title: 'Selector library' },
    },
    {
      path: '/selector',
      component: recordModule(
        () => import('@/pages/selector/SelectorPage.vue'),
      ),
      meta: { title: 'Selector' },
    },
    {
      path: '/svg',
      component: recordModule(() => import('@/pages/svg/SvgPage.vue')),
      meta: { title: 'SVG' },
    },
    {
      path: '/log',
      component: logPage,
      beforeEnter(to) {
        const queryUrl = Array.isArray(to.query.url)
          ? to.query.url[0]
          : to.query.url;
        if (typeof queryUrl == 'string') {
          return getKnownLogRoute(queryUrl);
        }
      },
      meta: { title: 'Log archive viewer' },
    },
    {
      path: '/log/:pathMatch(.*)*',
      component: logPage,
      beforeEnter(to) {
        if (!isValidLogPath(to.params.pathMatch)) return { path: '/404' };
      },
      meta: { title: 'Log archive viewer' },
    },
    {
      path: '/:pathMatch(.*)*',
      component: recordModule(
        () => import('@/pages/not-found/NotFoundPage.vue'),
      ),
    },
  ],
});

router.beforeEach((to) => {
  document.title = String(to.meta.title || 'GKD');
});

if (import.meta.env.PROD) {
  setTimeout(() => {
    // preload all route components
    routeModules.forEach((v) => v());
  }, 3000);
}

export default router;
