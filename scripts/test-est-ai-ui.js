/* eslint-disable global-require, no-negated-condition */
// Isolated Electron renderer test. Never opens the user's project or makes an API request.
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

if (!process.env.EST_AI_UI_CHILD) {
    const result = spawnSync(process.execPath, [__filename], {
        env: {...process.env, EST_AI_UI_CHILD: '1', NODE_OPTIONS: '--openssl-legacy-provider'},
        stdio: 'inherit',
        windowsHide: true
    });
    process.exitCode = result.status === null ? 1 : result.status;
} else {
    const webpack = require('webpack');
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'est-ai-ui-'));
    const fixture = path.join(__dirname, 'ai-ui-test');
    webpack({
        mode: 'development',
        target: 'electron-renderer',
        entry: path.join(fixture, 'renderer.jsx'),
        output: {path: output, filename: 'renderer.js'},
        devtool: false,
        resolve: {
            extensions: ['.js', '.jsx'],
            alias: {'@electron/remote$': path.join(fixture, 'remote.js')}
        },
        module: {rules: [
            {test: /\.jsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        babelrc: false, presets: ['@babel/preset-react']
                    }
                }},
            {test: /\.css$/, use: ['style-loader', {loader: 'css-loader', options: {modules: true}}]},
            {test: /\.(png|svg)$/, use: [{loader: 'file-loader', options: {name: '[name].[ext]'}}]}
        ]}
    }, (error, stats) => {
        if (error || stats.hasErrors()) {
            console.error(error || stats.toString({all: false, errors: true}));
            process.exitCode = 1;
            return;
        }
        fs.copyFileSync(path.join(fixture, 'index.html'), path.join(output, 'index.html'));
        const result = spawnSync(require('electron'), [path.join(fixture, 'main.js'), output], {
            env: {...process.env, NODE_OPTIONS: ''}, stdio: 'inherit', windowsHide: true
        });
        process.exitCode = result.status === null ? 1 : result.status;
    });
}
