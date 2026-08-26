const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const electronPath = require('electron');
const webpack = require('webpack');
const merge = require('webpack-merge');

const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const MONACO_DIR = path.resolve(__dirname, './node_modules/monaco-editor');
const EST_MENU_BAR_LOADER = path.resolve(__dirname, './scripts/est-menu-bar-loader.js');
const EST_BLOCKS_LOADER = path.resolve(__dirname, './scripts/est-blocks-loader.js');
const EST_TOOLBOX_LOADER = path.resolve(__dirname, './scripts/est-toolbox-loader.js');
const EST_VM_RUNTIME_LOADER = path.resolve(__dirname, './scripts/est-vm-runtime-loader.js');
const EST_PROGRAM_MODE_LOADER = path.resolve(__dirname, './scripts/est-program-mode-loader.js');
const OPENBLOCK_NATIVE_EDITORS_LOADER = path.resolve(
    __dirname,
    './scripts/openblock-native-editors-loader.js'
);
const EST_STATUS_PANEL = path.resolve(__dirname, './src/renderer/EstStatusPanel.jsx');
const EST_BLOCK_DEFINITIONS = path.resolve(__dirname, './src/renderer/est-blocks/definitions.js');
const EST_TOOLBOX = path.resolve(__dirname, './src/renderer/est-blocks/toolbox.js');
const EST_VM_BLOCKS = path.resolve(__dirname, './src/renderer/est-blocks/runtime.js');

// PostCss
const autoprefixer = require('autoprefixer');
const postcssVars = require('postcss-simple-vars');
const postcssImport = require('postcss-import');

const isProduction = (process.env.NODE_ENV === 'production');

const electronVersion = childProcess.execFileSync(electronPath, ['--version'], {
        encoding: 'utf8',
        env: {...process.env, NODE_OPTIONS: undefined}
    }).trim();
console.log(`Targeting Electron ${electronVersion}`); // eslint-disable-line no-console

const makeConfig = function (defaultConfig, options) {
    // electron-webpack may already inject a ProgressPlugin before this config is merged.
    // Remove it at the source because the generated progress stream can overwhelm the host app.
    defaultConfig.plugins = (defaultConfig.plugins || []).filter(plugin => (
        !plugin.constructor || plugin.constructor.name !== 'ProgressPlugin'
    ));

    const babelOptions = {
        // Explicitly disable babelrc so we don't catch various config in much lower dependencies.
        babelrc: false,
        plugins: [
            '@babel/plugin-syntax-dynamic-import',
            '@babel/plugin-transform-async-to-generator',
            '@babel/plugin-proposal-object-rest-spread'
        ],
        presets: [
            ['@babel/preset-env', {targets: {electron: electronVersion}}]
        ]
    };

    const sourceFileTest = options.useReact ? /\.jsx?$/ : /\.js$/;
    if (options.useReact) {
        babelOptions.presets = babelOptions.presets.concat('@babel/preset-react');
        babelOptions.plugins.push(['react-intl', {
            messagesDir: './translations/messages/'
        }]);
    }

    // TODO: consider adjusting these rules instead of discarding them in at least some cases
    if (options.disableDefaultRulesForExtensions) {
        defaultConfig.module.rules = defaultConfig.module.rules.filter(rule => {
            if (!(rule.test instanceof RegExp)) {
                // currently we don't support overriding other kinds of rules
                return true;
            }
            // disable default rules for any file extension listed here
            // we will handle these files in some other way (see below)
            // OR we want to avoid any processing at all (such as with fonts)
            const shouldDisable = options.disableDefaultRulesForExtensions.some(
                ext => rule.test.test(`test.${ext}`)
            );
            const statusWord = shouldDisable ? 'Discarding' : 'Keeping';
            console.log(`${options.name}: ${statusWord} electron-webpack default rule for ${rule.test}`);
            return !shouldDisable;
        });
    }

    const config = merge.smart(defaultConfig, {
        devtool: 'cheap-module-eval-source-map',
        mode: isProduction ? 'production' : 'development',
        module: {
            rules: [
                {
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\]components[/\\]menu-bar[/\\]menu-bar\.jsx$/,
                    enforce: 'pre',
                    loader: EST_MENU_BAR_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\]lib[/\\]blocks\.js$/,
                    enforce: 'pre',
                    loader: EST_BLOCKS_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\]lib[/\\]make-toolbox-xml\.js$/,
                    enforce: 'pre',
                    loader: EST_TOOLBOX_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\]reducers[/\\]program-mode\.js$/,
                    enforce: 'pre',
                    loader: EST_PROGRAM_MODE_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\](?:containers[/\\](?:blocks|prompt)|components[/\\](?:prompt[/\\]prompt|custom-procedures[/\\]custom-procedures))\.jsx$/,
                    enforce: 'pre',
                    loader: OPENBLOCK_NATIVE_EDITORS_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-vm[/\\]src[/\\]engine[/\\]runtime\.js$/,
                    enforce: 'pre',
                    loader: EST_VM_RUNTIME_LOADER
                },
                {
                    test: sourceFileTest,
                    include: options.babelPaths,
                    loader: 'babel-loader',
                    options: babelOptions
                },
                { // coped from scratch-gui
                    test: /\.css$/,
                    exclude: MONACO_DIR,
                    use: [{
                        loader: 'style-loader'
                    }, {
                        loader: 'css-loader',
                        options: {
                            modules: true,
                            importLoaders: 1,
                            localIdentName: '[name]_[local]_[hash:base64:5]',
                            camelCase: true
                        }
                    }, {
                        loader: 'postcss-loader',
                        options: {
                            ident: 'postcss',
                            plugins: function () {
                                return [
                                    postcssImport,
                                    postcssVars,
                                    autoprefixer
                                ];
                            }
                        }
                    }]
                },
                {
                    test: /\.(svg|png|wav|gif|jpg|ttf)$/,
                    loader: 'file-loader',
                    options: {
                        outputPath: 'static/assets/'
                    }
                },
                {
                    test: /\.css$/,
                    include: MONACO_DIR,
                    use: ['style-loader', 'css-loader']
                },
                {
                    test: /node_modules[/\\](iconv-lite)[/\\].+/,
                    resolve: {
                        aliasFields: ['main']
                    }
                }
            ]
        },
        plugins: [
            new webpack.DefinePlugin({
                'process.env.GA_ID': `"${process.env.GA_ID || 'UA-000000-01'}"`
            }),
            new webpack.SourceMapDevToolPlugin({
                filename: '[file].map'
            }),
            new MonacoWebpackPlugin({
                languages: ['c', 'cpp', 'python', 'lua', 'javascript'],
                features: ['!gotoSymbol']
            })
        ].concat(options.plugins || []),
        resolve: {
            cacheWithContext: false,
            symlinks: false,
            alias: {
                // act like scratch-gui has this line in its package.json:
                //   "browser": "./src/index.js"
                'openblock-gui$': path.resolve(__dirname, 'node_modules', 'openblock-gui', 'src', 'index.js'),
                'est-status-panel$': EST_STATUS_PANEL,
                'est-block-definitions$': EST_BLOCK_DEFINITIONS,
                'est-toolbox$': EST_TOOLBOX,
                'est-vm-blocks$': EST_VM_BLOCKS
            }
        }
    });

    // Keep build output small enough for IDE and agent terminals. The custom
    // development launcher also filters electron-webpack's hard-coded stats.
    config.stats = 'errors-only';

    fs.writeFileSync(
        `dist/webpack.${options.name}.js`,
        `module.exports = ${util.inspect(config, {depth: null})};\n`
    );

    return config;
};

module.exports = makeConfig;
