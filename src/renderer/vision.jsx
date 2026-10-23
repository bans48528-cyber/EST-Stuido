import React from 'react';
import {ipcRenderer} from 'electron';
import EstVisionLab from './EstVisionLab.jsx';
import {setCurrentEstLocale} from './est-i18n';

setCurrentEstLocale(new URLSearchParams(window.location.search).get('locale'), {silent: true});

const closeWindow = () => ipcRenderer.invoke('est-vision-window-close');

export default <EstVisionLab onClose={closeWindow} />;
