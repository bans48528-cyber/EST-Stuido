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
const EST_HARDWARE_WORKSPACE_LOADER = path.resolve(__dirname, './scripts/est-hardware-workspace-loader.js');
const EST_GUI_CLEANUP_LOADER = path.resolve(__dirname, './scripts/est-gui-cleanup-loader.js');
const EST_GUI_CONTAINER_LOADER = path.resolve(__dirname, './scripts/est-gui-container-loader.js');
const EST_APP_STATE_LOADER = path.resolve(__dirname, './scripts/est-app-state-loader.js');
const EST_LOCALES_LOADER = path.resolve(__dirname, './scripts/est-locales-loader.js');
const EST_LOCAL_PROJECT_FETCHER_LOADER = path.resolve(
    __dirname,
    './scripts/est-local-project-fetcher-loader.js'
);
const EST_PROJECT_FILE_LOADER = path.resolve(__dirname, './scripts/est-project-file-loader.js');
const EST_ALERTS_LOADER = path.resolve(__dirname, './scripts/est-alerts-loader.js');
const EST_TUTORIAL_DECKS_LOADER = path.resolve(__dirname, './scripts/est-tutorial-decks-loader.js');
const EST_EXTENSION_LIBRARY_LOADER = path.resolve(__dirname, './scripts/est-extension-library-loader.js');
const EST_EXTENSION_MANAGER_LOADER = path.resolve(__dirname, './scripts/est-extension-manager-loader.js');
const EST_DEFAULT_PROJECT_LOADER = path.resolve(__dirname, './scripts/est-default-project-loader.js');
const EST_HEADLESS_COSTUME_LOADER = path.resolve(__dirname, './scripts/est-headless-costume-loader.js');
const EST_VM_PROJECT_COMPAT_LOADER = path.resolve(
    __dirname,
    './scripts/est-vm-project-compat-loader.js'
);
const EST_VM_MANAGER_LOADER = path.resolve(__dirname, './scripts/est-vm-manager-loader.js');
const EST_BLOCKS_LOADER = path.resolve(__dirname, './scripts/est-blocks-loader.js');
const EST_TOOLBOX_LOADER = path.resolve(__dirname, './scripts/est-toolbox-loader.js');
const EST_VM_RUNTIME_LOADER = path.resolve(__dirname, './scripts/est-vm-runtime-loader.js');
const EST_PROGRAM_MODE_LOADER = path.resolve(__dirname, './scripts/est-program-mode-loader.js');
const EST_CODE_GENERATOR_LOADER = path.resolve(__dirname, './scripts/est-code-generator-loader.js');
const EST_PYTHON_GENERATOR_HEADER_LOADER = path.resolve(
    __dirname,
    './scripts/est-python-generator-header-loader.js'
);
const EST_DEVICE_DATA_LOADER = path.resolve(__dirname, './scripts/est-device-data-loader.js');
const OPENBLOCK_NATIVE_EDITORS_LOADER = path.resolve(
    __dirname,
    './scripts/openblock-native-editors-loader.js'
);
const EST_STATUS_PANEL = path.resolve(__dirname, './src/renderer/EstStatusPanel.jsx');
const EST_HARDWARE_STATUS_BUTTON = path.resolve(__dirname, './src/renderer/EstHardwareStatusButton.jsx');
const EST_CODE_DRAWER = path.resolve(__dirname, './src/renderer/EstCodeDrawer.jsx');
const EST_CODE_DRAWER_TOGGLE = path.resolve(__dirname, './src/renderer/EstCodeDrawerToggle.jsx');
const EST_MENU_BAR_LAYOUT = path.resolve(__dirname, './src/renderer/EstMenuBarLayout.jsx');
const EST_MENU_LOGO = path.resolve(__dirname, './src/renderer/est-menu-logo.png');
const EST_PROGRAM_CONTROLS = path.resolve(__dirname, './src/renderer/EstProgramControls.jsx');
const EST_BLOCK_DEFINITIONS = path.resolve(__dirname, './src/renderer/est-blocks/definitions.js');
const EST_TOOLBOX = path.resolve(__dirname, './src/renderer/est-blocks/toolbox.js');
const EST_VM_BLOCKS = path.resolve(__dirname, './src/renderer/est-blocks/runtime.js');
const EST_PYTHON_GENERATOR = path.resolve(__dirname, './src/renderer/est-blocks/python-generator.js');
const EST_EXTENSION_LIBRARY = path.resolve(__dirname, './src/renderer/est-extensions/library.js');
const EST_DEFAULT_PROJECT = path.resolve(__dirname, './src/renderer/est-project/default-project.js');

// PostCss
const autoprefixer = require('autoprefixer');
const postcssVars = require('postcss-simple-vars');
const postcssImport = require('postcss-import');

const electronVersion = childProcess.execFileSync(electronPath, ['--version'], {
    encoding: 'utf8',
    env: {...process.env, NODE_OPTIONS: undefined} // eslint-disable-line no-undefined
}).trim();
console.log(`Targeting Electron ${electronVersion}`); // eslint-disable-line no-console

const makeConfig = function (defaultConfig, options) {
    const isProduction = defaultConfig.mode === 'production';

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

    const buildPlugins = [new webpack.DefinePlugin({
        'process.env.GA_ID': `"${process.env.GA_ID || 'UA-000000-01'}"`
    })];
    if (!isProduction) {
        buildPlugins.push(new webpack.SourceMapDevToolPlugin({
            filename: '[file].map'
        }));
    }
    buildPlugins.push(new MonacoWebpackPlugin({
        languages: ['python'],
        features: ['!gotoSymbol']
    }));

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
        devtool: isProduction ? false : 'cheap-module-eval-source-map',
        mode: isProduction ? 'production' : 'development',
        module: {
            rules: [
                {
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\]components[/\\]menu-bar[/\\]menu-bar\.jsx$/,
                    enforce: 'pre',
                    loader: EST_MENU_BAR_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\]components[/\\]hardware[/\\]hardware\.jsx$/,
                    enforce: 'pre',
                    loader: EST_HARDWARE_WORKSPACE_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\]components[/\\]gui[/\\]gui\.jsx$/,
                    enforce: 'pre',
                    loader: EST_GUI_CLEANUP_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\]containers[/\\]gui\.jsx$/,
                    enforce: 'pre',
                    loader: EST_GUI_CONTAINER_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\]lib[/\\]app-state-hoc\.jsx$/,
                    enforce: 'pre',
                    loader: EST_APP_STATE_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-l10n[/\\]locales[/\\]editor-msgs\.js$/,
                    enforce: 'pre',
                    loader: EST_LOCALES_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\]lib[/\\]project-fetcher-hoc\.jsx$/,
                    enforce: 'pre',
                    loader: EST_LOCAL_PROJECT_FETCHER_LOADER
                },
                {
                    // eslint-disable-next-line max-len
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\](?:containers[/\\]sb3-downloader|lib[/\\](?:sb-file-uploader-hoc|titled-hoc))\.jsx$/,
                    enforce: 'pre',
                    loader: EST_PROJECT_FILE_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\]lib[/\\]alerts[/\\]index\.jsx$/,
                    enforce: 'pre',
                    loader: EST_ALERTS_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\]lib[/\\]libraries[/\\]decks[/\\]index\.jsx$/,
                    enforce: 'pre',
                    loader: EST_TUTORIAL_DECKS_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\]lib[/\\]libraries[/\\]extensions[/\\]index\.jsx$/,
                    enforce: 'pre',
                    loader: EST_EXTENSION_LIBRARY_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\]lib[/\\]default-project[/\\]index\.js$/,
                    enforce: 'pre',
                    loader: EST_DEFAULT_PROJECT_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-vm[/\\]src[/\\]extension-support[/\\]extension-manager\.js$/,
                    enforce: 'pre',
                    loader: EST_EXTENSION_MANAGER_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-vm[/\\]src[/\\]import[/\\]load-costume\.js$/,
                    enforce: 'pre',
                    loader: EST_HEADLESS_COSTUME_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-vm[/\\]src[/\\]virtual-machine\.js$/,
                    enforce: 'pre',
                    loader: EST_VM_PROJECT_COMPAT_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\]lib[/\\]vm-manager-hoc\.jsx$/,
                    enforce: 'pre',
                    loader: EST_VM_MANAGER_LOADER
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
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\]lib[/\\](?:code-generator|device)\.js$/,
                    enforce: 'pre',
                    loader: EST_CODE_GENERATOR_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-blocks[/\\]python_compressed\.js$/,
                    enforce: 'pre',
                    loader: EST_PYTHON_GENERATOR_HEADER_LOADER
                },
                {
                    test: /node_modules[/\\]openblock-gui[/\\]src[/\\]lib[/\\]vm-listener-hoc\.jsx$/,
                    enforce: 'pre',
                    loader: EST_DEVICE_DATA_LOADER
                },
                {
                    // eslint-disable-next-line max-len
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
                    test: /\.(svg|png|ico|wav|gif|jpg|ttf)$/,
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
        plugins: buildPlugins.concat(options.plugins || []),
        resolve: {
            cacheWithContext: false,
            symlinks: false,
            alias: {
                // act like scratch-gui has this line in its package.json:
                //   "browser": "./src/index.js"
                'openblock-gui$': path.resolve(__dirname, 'node_modules', 'openblock-gui', 'src', 'index.js'),
                'est-status-panel$': EST_STATUS_PANEL,
                'est-hardware-status-button$': EST_HARDWARE_STATUS_BUTTON,
                'est-code-drawer$': EST_CODE_DRAWER,
                'est-code-drawer-toggle$': EST_CODE_DRAWER_TOGGLE,
                'est-menu-bar-layout$': EST_MENU_BAR_LAYOUT,
                'est-menu-logo$': EST_MENU_LOGO,
                'est-program-controls$': EST_PROGRAM_CONTROLS,
                'est-block-definitions$': EST_BLOCK_DEFINITIONS,
                'est-toolbox$': EST_TOOLBOX,
                'est-vm-blocks$': EST_VM_BLOCKS,
                'est-python-generator$': EST_PYTHON_GENERATOR,
                'est-extension-library$': EST_EXTENSION_LIBRARY,
                'est-default-project$': EST_DEFAULT_PROJECT
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
