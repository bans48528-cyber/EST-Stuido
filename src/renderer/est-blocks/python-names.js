import {HAN_PINYIN_DATA} from './pinyin-data';

const PYTHON_KEYWORDS = new Set([
    'false',
    'none',
    'true',
    'and',
    'as',
    'assert',
    'async',
    'await',
    'break',
    'class',
    'continue',
    'def',
    'del',
    'elif',
    'else',
    'except',
    'finally',
    'for',
    'from',
    'global',
    'if',
    'import',
    'in',
    'is',
    'lambda',
    'nonlocal',
    'not',
    'or',
    'pass',
    'raise',
    'return',
    'try',
    'while',
    'with',
    'yield'
]);

const EST_RESERVED_NAMES = new Set([
    'audio',
    'buttons',
    'color',
    'display',
    'drive',
    'est',
    'est_runtime',
    'generated_expressions',
    'generated_statement',
    'generated_statements',
    'gyro',
    'infrared',
    'led',
    'motor',
    'repeat',
    'rt',
    'run_module',
    'sensor',
    'touch',
    'ultrasonic'
]);

const HAN_PINYIN = Object.freeze({
    一: 'yi',
    二: 'er',
    三: 'san',
    四: 'si',
    五: 'wu',
    六: 'liu',
    七: 'qi',
    八: 'ba',
    九: 'jiu',
    十: 'shi',
    上: 'shang',
    下: 'xia',
    左: 'zuo',
    右: 'you',
    前: 'qian',
    后: 'hou',
    中: 'zhong',
    内: 'nei',
    外: 'wai',
    大: 'da',
    小: 'xiao',
    多: 'duo',
    少: 'shao',
    高: 'gao',
    低: 'di',
    快: 'kuai',
    慢: 'man',
    长: 'chang',
    短: 'duan',
    宽: 'kuan',
    窄: 'zhai',
    新: 'xin',
    旧: 'jiu',
    开: 'kai',
    关: 'guan',
    启: 'qi',
    动: 'dong',
    停: 'ting',
    止: 'zhi',
    行: 'xing',
    走: 'zou',
    跑: 'pao',
    转: 'zhuan',
    向: 'xiang',
    移: 'yi',
    进: 'jin',
    退: 'tui',
    升: 'sheng',
    降: 'jiang',
    旋: 'xuan',
    轮: 'lun',
    轴: 'zhou',
    电: 'dian',
    机: 'ji',
    马: 'ma',
    达: 'da',
    速: 'su',
    度: 'du',
    力: 'li',
    功: 'gong',
    率: 'lv',
    角: 'jiao',
    圈: 'quan',
    秒: 'miao',
    分: 'fen',
    时: 'shi',
    间: 'jian',
    次: 'ci',
    个: 'ge',
    值: 'zhi',
    量: 'liang',
    数: 'shu',
    据: 'ju',
    列: 'lie',
    表: 'biao',
    变: 'bian',
    参: 'can',
    名: 'ming',
    称: 'cheng',
    项: 'xiang',
    目: 'mu',
    序: 'xu',
    程: 'cheng',
    模: 'mo',
    块: 'kuai',
    函: 'han',
    返: 'fan',
    回: 'hui',
    设: 'she',
    置: 'zhi',
    取: 'qu',
    写: 'xie',
    入: 'ru',
    读: 'du',
    清: 'qing',
    除: 'chu',
    重: 'zhong',
    复: 'fu',
    循: 'xun',
    环: 'huan',
    如: 'ru',
    果: 'guo',
    否: 'fou',
    则: 'ze',
    等: 'deng',
    待: 'dai',
    直: 'zhi',
    到: 'dao',
    条: 'tiao',
    件: 'jian',
    真: 'zhen',
    假: 'jia',
    且: 'qie',
    或: 'huo',
    非: 'fei',
    比: 'bi',
    较: 'jiao',
    加: 'jia',
    减: 'jian',
    乘: 'cheng',
    余: 'yu',
    随: 'sui',
    圆: 'yuan',
    整: 'zheng',
    绝: 'jue',
    对: 'dui',
    文: 'wen',
    符: 'fu',
    串: 'chuan',
    图: 'tu',
    像: 'xiang',
    显: 'xian',
    示: 'shi',
    屏: 'ping',
    幕: 'mu',
    字: 'zi',
    体: 'ti',
    样: 'yang',
    式: 'shi',
    黑: 'hei',
    白: 'bai',
    红: 'hong',
    蓝: 'lan',
    绿: 'lv',
    黄: 'huang',
    棕: 'zong',
    色: 'se',
    亮: 'liang',
    暗: 'an',
    声: 'sheng',
    乐: 'yue',
    蜂: 'feng',
    鸣: 'ming',
    音: 'yin',
    频: 'pin',
    播: 'bo',
    放: 'fang',
    广: 'guang',
    消: 'xiao',
    息: 'xi',
    事: 'shi',
    触: 'chu',
    碰: 'peng',
    按: 'an',
    键: 'jian',
    传: 'chuan',
    感: 'gan',
    器: 'qi',
    颜: 'yan',
    距: 'ju',
    离: 'li',
    超: 'chao',
    波: 'bo',
    陀: 'tuo',
    螺: 'luo',
    仪: 'yi',
    光: 'guang',
    线: 'xian',
    巡: 'xun',
    校: 'xiao',
    准: 'zhun',
    反: 'fan',
    射: 'she',
    境: 'jing',
    方: 'fang',
    法: 'fa',
    类: 'lei',
    型: 'xing',
    端: 'duan',
    口: 'kou',
    槽: 'cao',
    位: 'wei',
    固: 'gu',
    版: 'ban',
    本: 'ben',
    连: 'lian',
    接: 'jie',
    运: 'yun',
    控: 'kong',
    制: 'zhi',
    自: 'zi',
    测: 'ce',
    试: 'shi',
    车: 'che',
    灯: 'deng',
    温: 'wen',
    湿: 'shi',
    气: 'qi',
    压: 'ya',
    流: 'liu',
    路: 'lu',
    径: 'jing',
    计: 'ji',
    总: 'zong',
    和: 'he',
    差: 'cha',
    平: 'ping',
    均: 'jun',
    最: 'zui',
    预: 'yu',
    警: 'jing',
    报: 'bao',
    告: 'gao',
    输: 'shu',
    出: 'chu',
    存: 'cun',
    储: 'chu',
    阈: 'yu',
    标: 'biao',
    坐: 'zuo',
    横: 'heng',
    纵: 'zong',
    半: 'ban',
    起: 'qi',
    点: 'dian',
    终: 'zhong',
    号: 'hao',
    通: 'tong',
    道: 'dao',
    障: 'zhang',
    碍: 'ai',
    避: 'bi',
    我: 'wo',
    你: 'ni',
    他: 'ta',
    她: 'ta',
    它: 'ta',
    不: 'bu',
    喜: 'xi',
    欢: 'huan',
    爱: 'ai',
    要: 'yao',
    想: 'xiang',
    知: 'zhi',
    学: 'xue',
    习: 'xi',
    做: 'zuo',
    看: 'kan',
    听: 'ting',
    说: 'shuo'
});

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const ASCII_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const isAscii = value => Array.from(value)
    .every(character => character.charCodeAt(0) <= 0x7f);

const stableHash = value => {
    let hash = 2166136261;
    for (const character of Array.from(String(value))) {
        hash ^= character.codePointAt(0);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(36);
};

const fallbackHanToken = character => `han_${stableHash(character)}`;

const isCjkUnifiedIdeograph = codePoint => (
    codePoint === 0x3007 ||
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0x20000 && codePoint <= 0x2a6df) ||
    (codePoint >= 0x2a700 && codePoint <= 0x2b73f) ||
    (codePoint >= 0x2b740 && codePoint <= 0x2b81f) ||
    (codePoint >= 0x2b820 && codePoint <= 0x2ceaf) ||
    (codePoint >= 0x2ceb0 && codePoint <= 0x2ebef) ||
    (codePoint >= 0x30000 && codePoint <= 0x3134f)
);

const isReservedIdentifier = (name, reservedDict = null) => (
    PYTHON_KEYWORDS.has(name) ||
    EST_RESERVED_NAMES.has(name) ||
    /^stack_\d+$/.test(name) ||
    Boolean(reservedDict && reservedDict[name])
);

export const isValidEstPythonIdentifier = name => (
    typeof name === 'string' &&
    name.length > 0 &&
    ASCII_IDENTIFIER.test(name) &&
    isAscii(name)
);

export const toEstPythonIdentifier = (value, reservedDict = null, fallbackPrefix = 'name') => {
    const original = String(value || '');
    const normalized = original.normalize('NFKD')
        .replace(COMBINING_MARKS, '');
    const tokens = [];
    let asciiBuffer = '';

    const flushAscii = () => {
        if (!asciiBuffer) return;
        tokens.push(asciiBuffer.toLowerCase());
        asciiBuffer = '';
    };

    for (const character of Array.from(normalized)) {
        if (/^[A-Za-z0-9]$/.test(character)) {
            asciiBuffer += character;
            continue;
        }
        flushAscii();
        const codePoint = character.codePointAt(0);
        if (isCjkUnifiedIdeograph(codePoint)) {
            tokens.push(HAN_PINYIN[character] || HAN_PINYIN_DATA[character] || fallbackHanToken(character));
        }
    }
    flushAscii();

    let identifier = tokens.join('_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    if (!identifier) {
        identifier = original ? `${fallbackPrefix}_${stableHash(original)}` : fallbackPrefix;
    }
    if (/^[0-9]/.test(identifier)) {
        identifier = `value_${identifier}`;
    }
    if (isReservedIdentifier(identifier, reservedDict)) {
        identifier = `${identifier}_value`;
    }
    return identifier;
};

const variableNameType = ScratchBlocks => (
    ScratchBlocks &&
    ScratchBlocks.Variables &&
    ScratchBlocks.Variables.NAME_TYPE
) || 'variable';

const developerVariableType = ScratchBlocks => (
    ScratchBlocks &&
    ScratchBlocks.Names &&
    ScratchBlocks.Names.DEVELOPER_VARIABLE_TYPE
) || 'DEVELOPER_VARIABLE';

const createNameDatabase = (ScratchBlocks, generator) => {
    let browserBlockly = null;
    if (typeof window === 'undefined') {
        browserBlockly = null;
    } else {
        browserBlockly = window.Blockly;
    }
    const Names = (ScratchBlocks && ScratchBlocks.Names) ||
        (browserBlockly && browserBlockly.Names);
    if (Names) {
        return new Names(generator.RESERVED_WORDS_);
    }
    return {
        reservedDict_: Object.create(null),
        variablePrefix_: '',
        setVariableMap (map) {
            this.variableMap_ = map;
        },
        getNameForUserVariable_ (id) {
            const variable = this.variableMap_ &&
                typeof this.variableMap_.getVariableById === 'function' &&
                this.variableMap_.getVariableById(id);
            return variable ? variable.name : null;
        }
    };
};

export const installEstPythonNameSanitizer = (ScratchBlocks, generator) => {
    if (!generator) return;
    if (!generator.variableDB_) {
        generator.variableDB_ = createNameDatabase(ScratchBlocks, generator);
    }
    const database = generator.variableDB_;
    if (!database || database.estPythonNamesInstalled_) return;

    if (typeof database.setVariableMap !== 'function') {
        database.setVariableMap = function (map) {
            this.variableMap_ = map;
        };
    }
    if (typeof database.getNameForUserVariable_ !== 'function') {
        database.getNameForUserVariable_ = function (id) {
            const variable = this.variableMap_ &&
                typeof this.variableMap_.getVariableById === 'function' &&
                this.variableMap_.getVariableById(id);
            return variable ? variable.name : null;
        };
    }

    database.reset = function () {
        this.db_ = Object.create(null);
        this.dbReverse_ = Object.create(null);
        this.variableMap_ = null;
    };

    database.safeName_ = function (name) {
        return toEstPythonIdentifier(name, this.reservedDict_);
    };

    database.getDistinctName = function (name, type) {
        const isVarType = type === variableNameType(ScratchBlocks) ||
            type === developerVariableType(ScratchBlocks);
        const prefix = isVarType ? (this.variablePrefix_ || '') : '';
        const baseName = this.safeName_(name);
        let candidate = baseName;
        let index = 2;
        while (this.dbReverse_[candidate] || isReservedIdentifier(candidate, this.reservedDict_)) {
            candidate = `${baseName}_${index}`;
            index += 1;
        }
        this.dbReverse_[candidate] = true;
        return prefix + candidate;
    };

    database.getName = function (name, type) {
        let sourceName = name;
        if (type === variableNameType(ScratchBlocks) &&
            typeof this.getNameForUserVariable_ === 'function') {
            const variableName = this.getNameForUserVariable_(name);
            if (variableName) {
                sourceName = variableName;
            }
        }

        const normalized = sourceName ?
            `${String(sourceName).toLowerCase()}_${type}` :
            `null_${type}`;
        const isVarType = type === variableNameType(ScratchBlocks) ||
            type === developerVariableType(ScratchBlocks);
        const prefix = isVarType ? (this.variablePrefix_ || '') : '';
        if (this.db_ && normalized in this.db_) {
            return prefix + this.db_[normalized];
        }

        const safeName = this.getDistinctName(sourceName, type);
        if (!this.db_) this.db_ = Object.create(null);
        this.db_[normalized] = safeName.slice(prefix.length);
        return safeName;
    };

    database.estPythonNamesInstalled_ = true;
    database.reset();
};
