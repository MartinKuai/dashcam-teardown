// Entry: the copy first, the 3D scene after. i18n.ts has no imports, so this chunk is small and the Chinese text
// (hidden by the inline script until i18n.ts runs) shows before three.js has loaded.
import './i18n';

void import('./main');
