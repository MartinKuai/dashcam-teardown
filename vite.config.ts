import { defineConfig } from 'vite';

// The built page lives at martinkuai.com/work/dashcam-teardown/ (the site's /work/ section); `vite preview`
// serves it there too. The dev server stays at the root so the test and review tools keep their URLs.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/work/dashcam-teardown/' : '/',
}));
