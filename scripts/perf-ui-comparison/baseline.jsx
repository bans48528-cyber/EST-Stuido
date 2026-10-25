import React from 'react';
import ReactDOM from 'react-dom';
import AppStateHOC from 'openblock-gui/src/lib/app-state-hoc.jsx';
import HashParserHOC from 'openblock-gui/src/lib/hash-parser-hoc.jsx';
import GUI from 'openblock-gui/src/containers/gui.jsx';

// Original OpenBlock GUI, without any EST loader or component replacement.
// IPC/network/device access is isolated by the comparison Electron host.
const target = document.getElementById('app');
GUI.setAppElement(target);
const App = AppStateHOC(HashParserHOC(GUI));
ReactDOM.render(<App
    canEditTitle
    isScratchDesktop
    canSave={false}
    showTelemetryModal={false}
    projectTitle="OpenBlock performance comparison"
    onShowMessageBox={() => Promise.resolve(false)}
/>, target);
