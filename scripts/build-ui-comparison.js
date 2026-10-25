/* eslint-disable global-require, no-negated-condition */
// Compile both variants with the same toolchain; never change installed dependencies or worktree sources.
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');
if (!process.env.EST_COMPARE_BUILD_CHILD) {
    const result = spawnSync(process.execPath, [__filename, ...process.argv.slice(2)], {
        env: {...process.env, EST_COMPARE_BUILD_CHILD: '1', NODE_OPTIONS: '--openssl-legacy-provider'},
        stdio: 'inherit',
        windowsHide: true
    });
    process.exitCode = result.status === null ? 1 : result.status;
} else {
    const webpack = require('webpack');
    const makeConfig = require('../webpack.makeConfig');
    const root = path.resolve(__dirname, '..');
    const output = path.resolve(process.argv[2]);
    const html = '<!doctype html><html lang="zh-cn"><head><meta charset="utf-8">' +
        '<style>html,body,#app{height:100%;width:100%;margin:0}body{overflow:hidden}</style>' +
        '</head><body><div id="app"></div><script src="renderer.js"></script></body></html>';
    (async () => {
        for (const variant of (process.argv.includes('--baseline-only') ? ['baseline'] : ['baseline', 'est'])) {
            const destination = path.join(output, variant);
            fs.mkdirSync(destination, {recursive: true});
            const config = makeConfig({mode: 'development',
                target: 'electron-renderer',
                context: root,
                entry: path.join(__dirname, 'perf-ui-comparison', `${variant}.jsx`),
                output: {path: destination, filename: 'renderer.js', publicPath: ''},
                module: {rules: []},
                plugins: [],
                devtool: false,
                node: {fs: 'empty', net: 'empty', tls: 'empty'},
                optimization: {minimize: false}}, {
                name: 'renderer-comparison',
                useReact: true,
                babelPaths: [path.join(root, 'src'), path.join(root, 'scripts'),
                    /node_modules[\\/]openblock-[^\\/]+[\\/]src/,
                    /node_modules[\\/]scratch-[^\\/]+[\\/]src/,
                    /node_modules[\\/]pify/],
                plugins: []
            });
            if (variant === 'baseline') {
                config.module.rules = config.module.rules.filter(rule => !(
                    typeof rule.loader === 'string' && rule.loader.startsWith(path.join(root, 'scripts'))
                ));
            }
            config.resolve.modules = ['node_modules', path.join(root, 'node_modules')];
            config.resolveLoader = {modules: ['node_modules', path.join(root, 'node_modules')]};
            config.devtool = false;
            config.plugins = config.plugins.filter(plugin => plugin.constructor.name !== 'SourceMapDevToolPlugin');
            await new Promise((resolve, reject) => webpack(config, (error, stats) => {
                if (error || stats.hasErrors()) {
                    reject(error || new Error(stats.toString({all: false, errors: true}))); return;
                }
                resolve();
            }));
            fs.writeFileSync(path.join(destination, 'index.html'), html);
            console.log(`Compiled comparison ${variant}: ${destination}`);
        }
    })().catch(error => {
        console.error(error); process.exitCode = 1;
    });
}
