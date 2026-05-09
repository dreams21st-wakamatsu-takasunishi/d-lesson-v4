import './style.css';

import { initApp } from './app/bootstrap.js';

globalThis.BUILD_COMMIT = import.meta.env.VITE_BUILD_COMMIT || 'local';

initApp({
    buildCommit: globalThis.BUILD_COMMIT
});
