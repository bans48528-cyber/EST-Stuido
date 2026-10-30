import newCatalog from './new-ai/catalog.json';
import {newBlockText} from './new-ai/messages';
import sparkCatalog from './spark-ai/catalog.json';
import {sparkText} from './spark-ai/messages';

import EST_HOME_BLOCK_GUIDE_CATEGORIES from './est-home-block-guide';
import {getProductBlockDescription} from './est-home-product-block-descriptions';
import {getEstText, normalizeEstLocale} from './est-i18n';

const PRODUCT_CATALOGS = {
    'spark-ai': {
        catalog: sparkCatalog,
        prefix: 'spark_',
        text: (row, locale) => sparkText(row.id, locale, row.definition.message0)
    },
    'new-ai': {
        catalog: newCatalog,
        prefix: 'new_',
        text: (row, locale) => newBlockText(row.id, normalizeEstLocale(locale), row.definition.message0)
    }
};

const CATEGORY_ORDER = [
    'motor', 'combined_motor', 'matrix', 'sound', 'events', 'control',
    'sensing', 'cameraRecognition', 'grayv2', 'operators'
];

const CATEGORY_TITLES = {
    motor: 'category.motor',
    combined_motor: 'category.movement',
    matrix: 'home.blockGuide.category.matrix',
    sound: 'category.sound',
    events: 'category.event',
    control: 'category.control',
    sensing: 'category.sensing',
    cameraRecognition: 'home.blockGuide.category.camera',
    grayv2: 'home.blockGuide.category.grayv2',
    operators: 'home.blockGuide.category.operators'
};

const cleanBlockLabel = message => String(message || '')
    .replace(/%%/g, '%')
    .replace(/%\d+/g, '…')
    .replace(/(?:…\s*){2,}/g, '… ')
    .replace(/\s+([，。？！；：,.?!;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

const blockKind = row => {
    const extensions = row.definition.extensions || [];
    if (extensions.includes('shape_hat')) return 'event';
    if (extensions.includes('output_boolean')) return 'boolean';
    if (extensions.some(extension => /^output_/.test(extension))) return 'reporter';
    if (Object.keys(row.definition).filter(key => /^args\d+$/.test(key))
        .some(key => row.definition[key].some(argument => argument.type === 'input_statement'))) return 'branch';
    if (['control_break', 'control_stop'].includes(row.id)) return 'terminal';
    return 'statement';
};

export const getProductBlockGuideCategories = (productId, locale) => {
    if (!PRODUCT_CATALOGS[productId]) return EST_HOME_BLOCK_GUIDE_CATEGORIES;
    const source = PRODUCT_CATALOGS[productId];
    return CATEGORY_ORDER.map(categoryId => ({
        id: `${productId}-${categoryId}`,
        title: CATEGORY_TITLES[categoryId],
        items: source.catalog.blocks.filter(row => row.category === categoryId).map(row => ({
            id: `${source.prefix}${row.id}`,
            name: cleanBlockLabel(source.text(row, locale)),
            description: getProductBlockDescription(productId, row.id, locale) ||
                getEstText(`home.blockGuide.kind.${blockKind(row)}`, locale)
        }))
    })).filter(category => category.items.length);
};

export const getProductBlockGuideIds = (productId, locale) => getProductBlockGuideCategories(productId, locale)
    .reduce((ids, category) => ids.concat(category.items.map(item => {
        if (typeof item === 'string') return item;
        return item.id;
    })), []);

export default getProductBlockGuideCategories;
