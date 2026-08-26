// This file does async imports of the heavy JSX, especially app.jsx, to avoid blocking the first render.
// The main index.html just contains a loading/splash screen which will display while this import loads.

import {ipcRenderer} from 'electron';

import ReactDOM from 'react-dom';

ipcRenderer.on('ready-to-show', () => {
    // Start without any element in focus, otherwise the first link starts with focus and shows an orange box.
    // We shouldn't disable that box or the focus behavior in case someone wants or needs to navigate that way.
    // This seems like a hack... maybe there's some better way to do avoid any element starting with focus?
    document.activeElement.blur();
});

const route = new URLSearchParams(window.location.search).get('route') || 'app';
let routeModulePromise;
switch (route) {
case 'loading':
    routeModulePromise = import('./loading.jsx');
    break;
case 'app':
    routeModulePromise = import('./app.jsx');
    break;
case 'about':
    routeModulePromise = import('./about.jsx');
    break;
case 'license':
    routeModulePromise = import('./license.jsx');
    break;
case 'privacy':
    routeModulePromise = import('./privacy.jsx');
    break;
}

routeModulePromise.then(routeModule => {
    const appTarget = document.getElementById('app');
    const routeElement = routeModule.default;
    ReactDOM.render(routeElement, appTarget);
}).catch(error => {
    // Avoid an unexplained white window when a route bundle fails to load.
    // The detailed error remains in the development terminal as well.
    console.error('RENDERER_ROUTE_LOAD_FAILED', error);
    const appTarget = document.getElementById('app');
    if (appTarget) {
        appTarget.innerHTML = `
            <div style="padding: 32px; color: #fff; background: #1f2430; font-family: sans-serif;">
                EST Studio 启动失败<br />
                <small>${String(error && error.message ? error.message : error)}</small>
            </div>
        `;
    }
});
