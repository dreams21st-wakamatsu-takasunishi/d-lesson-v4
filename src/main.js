import '@fontsource/m-plus-rounded-1c/500.css';
import '@fontsource/m-plus-rounded-1c/700.css';
import './style.css';
import './styles/interface.css';

import { initApp } from './app/bootstrap.js';

globalThis.BUILD_COMMIT = import.meta.env.VITE_BUILD_COMMIT || 'local';

initApp({
    buildCommit: globalThis.BUILD_COMMIT
});
