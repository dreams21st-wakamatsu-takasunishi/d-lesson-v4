import './style.css';

import { initApp } from './app/bootstrap.js';

initApp({
    buildCommit: import.meta.env.VITE_BUILD_COMMIT || 'local'
});
