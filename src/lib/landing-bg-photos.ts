/** Hero background photo pool. One photo is picked server-side per request
 *  (`page.tsx` is force-dynamic) so the SSR'd HTML already contains the
 *  chosen image — no client-side swap, no flash, no flicker. */
export const BG_PHOTOS = [
  "/bg.jpg",
  "/glasgow-bg.jpg",
  "/lincoln-library-bg.jpg",
  "/princeton-bg.jpg",
  "/germany-bg.jpg",
] as const;
