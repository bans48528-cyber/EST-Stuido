import React from 'react';
import {createPortal} from 'react-dom';
import EstAiMascot from './EstAiMascot.jsx';

import homeMenuIcon from './est-home-assets/home-menu-icon.png';
import {HARDWARE_CHANGED_EVENT, isAiHardwareActive} from './hardware/context';

import {
    EST_LOCALE_CHANGED_EVENT,
    getCurrentEstLocale,
    getEstText
} from './est-i18n';
import {
    EST_SHOW_HOME_EVENT,
    dispatchEstHomeEvent
} from './est-home-events';
import {
    EST_AI_MENU_STATE_EVENT,
    dispatchEstAiOpenRequest
} from './est-ai/est-ai-menu-events';

const MENU_BAR_SELECTOR = '[class*="menu-bar_menu-bar_"]';
const MAIN_MENU_SELECTOR = '[class*="menu-bar_main-menu_"]';
const FILE_MENU_SELECTOR = '[class*="menu-bar_file-menu_"]';
const TAIL_MENU_SELECTOR = '[class*="menu-bar_tail-menu_"]';
const CENTER_MENU_MAX_WIDTH = 252;
const CENTER_MENU_GAP = 12;
const CENTER_MENU_WIDTH_PROPERTY = '--est-centered-file-menu-width';
const HOME_BUTTON_CLASS = 'est-menu-bar-home-button';
const HOME_BUTTON_SELECTOR = `.${HOME_BUTTON_CLASS}`;
const HOME_BRAND_ITEM_CLASS = 'est-menu-bar-home-brand-item';
const AI_BUTTON_CLASS = 'est-menu-bar-ai-button';
const AI_BUTTON_SELECTOR = `.${AI_BUTTON_CLASS}`;

const getAiButtonLabel = locale => {
    if (locale === 'zh-tw') return 'AI 程式助手';
    if (locale === 'zh-cn') return 'AI 编程助手';
    if (locale === 'pt-br') return 'Assistente de IA';
    if (locale === 'ru') return 'ИИ-помощник';
    return 'AI Assistant';
};

const getContentBounds = element => {
    const childBounds = Array.from(element.children)
        .map(child => child.getBoundingClientRect())
        .filter(bounds => bounds.width > 0 && bounds.height > 0);

    if (!childBounds.length) {
        return element.getBoundingClientRect();
    }

    return {
        left: Math.min(...childBounds.map(bounds => bounds.left)),
        right: Math.max(...childBounds.map(bounds => bounds.right))
    };
};

class EstMenuBarLayout extends React.Component {
    constructor (props) {
        super(props);
        this.state = {mascotHost: null, aiVisible: true};
        this.handleMenuMutation = this.handleMenuMutation.bind(this);
        this.handleHomeButtonClick = this.handleHomeButtonClick.bind(this);
        this.handleAiButtonClick = this.handleAiButtonClick.bind(this);
        this.handleAiMenuState = this.handleAiMenuState.bind(this);
        this.handleLocaleChange = this.handleLocaleChange.bind(this);
        this.scheduleLayoutUpdate = this.scheduleLayoutUpdate.bind(this);
        this.updateLayout = this.updateLayout.bind(this);
    }

    componentDidMount () {
        window.addEventListener('resize', this.scheduleLayoutUpdate);
        window.addEventListener(EST_LOCALE_CHANGED_EVENT, this.handleLocaleChange);
        window.addEventListener(EST_AI_MENU_STATE_EVENT, this.handleAiMenuState);
        window.addEventListener(HARDWARE_CHANGED_EVENT, this.handleAiMenuState);
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(this.scheduleLayoutUpdate);
        }
        if (typeof MutationObserver !== 'undefined') {
            this.mutationObserver = new MutationObserver(this.handleMenuMutation);
        }
        this.observeMenuParts();
        this.scheduleLayoutUpdate();
    }

    componentWillUnmount () {
        window.removeEventListener('resize', this.scheduleLayoutUpdate);
        window.removeEventListener(EST_LOCALE_CHANGED_EVENT, this.handleLocaleChange);
        window.removeEventListener(EST_AI_MENU_STATE_EVENT, this.handleAiMenuState);
        window.removeEventListener(HARDWARE_CHANGED_EVENT, this.handleAiMenuState);
        if (this.layoutFrame) {
            window.cancelAnimationFrame(this.layoutFrame);
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        if (this.homeButton && this.homeButton.parentNode) {
            this.homeButton.removeEventListener('click', this.handleHomeButtonClick);
            this.homeButton.parentNode.removeChild(this.homeButton);
            this.homeButton = null;
        }
        if (this.homeBrandItem) {
            this.homeBrandItem.classList.remove(HOME_BRAND_ITEM_CLASS);
            this.homeBrandItem = null;
        }
        if (this.aiButton && this.aiButton.parentNode) {
            this.aiButton.removeEventListener('click', this.handleAiButtonClick);
            this.aiButton.parentNode.removeChild(this.aiButton);
            this.aiButton = null;
        }
    }

    handleMenuMutation () {
        this.observeMenuParts();
        this.scheduleLayoutUpdate();
    }

    handleHomeButtonClick (event) {
        event.preventDefault();
        event.stopPropagation();
        dispatchEstHomeEvent(EST_SHOW_HOME_EVENT);
    }

    handleAiButtonClick (event) {
        event.preventDefault();
        event.stopPropagation();
        dispatchEstAiOpenRequest();
    }

    handleAiMenuState () {
        this.updateAiButtonState();
        this.scheduleLayoutUpdate();
    }

    handleLocaleChange () {
        this.updateHomeButtonText();
        this.updateAiButtonText();
    }

    updateAiButtonText () {
        if (!this.aiButton) return;
        const label = getAiButtonLabel(getCurrentEstLocale());
        const labelElement = this.aiButton.querySelector('.est-menu-bar-ai-button-label');
        if (labelElement && labelElement.textContent !== label) labelElement.textContent = label;
        this.aiButton.setAttribute('aria-label', label);
        this.aiButton.setAttribute('title', label);
    }

    updateAiButtonState () {
        if (!this.aiButton) return;
        const state = window.estAiMenuState || {visible: true, open: false};
        this.aiButton.hidden = state.visible === false || !isAiHardwareActive();
        this.aiButton.setAttribute('aria-pressed', state.open ? 'true' : 'false');
        if (this.state.aiVisible !== !this.aiButton.hidden) {
            this.setState({aiVisible: !this.aiButton.hidden});
        }
    }

    updateHomeButtonText () {
        if (!this.homeButton) {
            return;
        }
        const label = getEstText('menu.home', getCurrentEstLocale());
        this.homeButton.setAttribute('aria-label', label);
        this.homeButton.setAttribute('title', label);
    }

    decorateHomeButton (homeButton) {
        if (homeButton.querySelector('.est-menu-bar-home-icon')) return;

        homeButton.textContent = '';
        const icon = document.createElement('img');
        icon.className = 'est-menu-bar-home-icon';
        icon.src = homeMenuIcon;
        icon.alt = '';
        icon.draggable = false;
        icon.setAttribute('aria-hidden', 'true');
        homeButton.appendChild(icon);
    }

    ensureHomeButton (mainMenu) {
        const logoItem = mainMenu.firstElementChild;
        if (!logoItem) return;
        logoItem.classList.add(HOME_BRAND_ITEM_CLASS);
        this.homeBrandItem = logoItem;

        const existingButton = mainMenu.querySelector(HOME_BUTTON_SELECTOR);
        if (existingButton) {
            existingButton.removeEventListener('click', this.handleHomeButtonClick);
            existingButton.addEventListener('click', this.handleHomeButtonClick);
            this.decorateHomeButton(existingButton);
            if (existingButton.parentNode !== logoItem) logoItem.appendChild(existingButton);
            this.homeButton = existingButton;
            this.updateHomeButtonText();
            return;
        }

        const homeButton = document.createElement('button');
        homeButton.type = 'button';
        homeButton.className = HOME_BUTTON_CLASS;
        homeButton.addEventListener('click', this.handleHomeButtonClick);
        this.decorateHomeButton(homeButton);
        logoItem.appendChild(homeButton);
        this.homeButton = homeButton;
        this.updateHomeButtonText();
    }

    ensureAiButton (tailMenu) {
        const existingButton = tailMenu.querySelector(AI_BUTTON_SELECTOR);
        if (existingButton) {
            existingButton.removeEventListener('click', this.handleAiButtonClick);
            existingButton.addEventListener('click', this.handleAiButtonClick);
            this.aiButton = existingButton;
            this.decorateAiButton(existingButton);
            this.updateAiButtonText();
            this.updateAiButtonState();
            return;
        }

        const aiButton = document.createElement('button');
        aiButton.type = 'button';
        aiButton.className = AI_BUTTON_CLASS;
        aiButton.addEventListener('click', this.handleAiButtonClick);

        const label = document.createElement('span');
        label.className = 'est-menu-bar-ai-button-label';
        aiButton.appendChild(label);

        tailMenu.insertBefore(aiButton, tailMenu.firstChild);
        this.aiButton = aiButton;
        this.decorateAiButton(aiButton);
        this.updateAiButtonText();
        this.updateAiButtonState();
    }

    decorateAiButton (button) {
        let host = button.querySelector('.est-menu-bar-ai-avatar');
        if (!host) {
            const oldIcon = button.querySelector('.est-menu-bar-ai-button-icon');
            if (oldIcon) oldIcon.remove();
            host = document.createElement('span');
            host.className = 'est-menu-bar-ai-avatar';
            button.insertBefore(host, button.firstChild);
        }
        if (this.state.mascotHost !== host) this.setState({mascotHost: host});
    }

    observeMenuParts () {
        const menuBar = document.querySelector(MENU_BAR_SELECTOR);
        if (!menuBar) {
            return;
        }

        const mainMenu = menuBar.querySelector(MAIN_MENU_SELECTOR);
        const fileMenu = menuBar.querySelector(FILE_MENU_SELECTOR);
        const tailMenu = menuBar.querySelector(TAIL_MENU_SELECTOR);
        if (mainMenu) {
            this.ensureHomeButton(mainMenu);
        }
        if (tailMenu) {
            this.ensureAiButton(tailMenu);
        }

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            [
                menuBar,
                mainMenu,
                fileMenu,
                tailMenu,
                ...Array.from(mainMenu ? mainMenu.children : []),
                ...Array.from(tailMenu ? tailMenu.children : [])
            ].filter(Boolean).forEach(element => this.resizeObserver.observe(element));
        }

        if (this.mutationObserver && this.observedMenuBar !== menuBar) {
            this.mutationObserver.disconnect();
            this.mutationObserver.observe(menuBar, {
                childList: true,
                characterData: true,
                subtree: true
            });
            this.observedMenuBar = menuBar;
        }
    }

    scheduleLayoutUpdate () {
        if (this.layoutFrame) {
            window.cancelAnimationFrame(this.layoutFrame);
        }
        this.layoutFrame = window.requestAnimationFrame(this.updateLayout);
    }

    updateLayout () {
        this.layoutFrame = null;
        const menuBar = document.querySelector(MENU_BAR_SELECTOR);
        if (!menuBar) {
            return;
        }

        const mainMenu = menuBar.querySelector(MAIN_MENU_SELECTOR);
        const tailMenu = menuBar.querySelector(TAIL_MENU_SELECTOR);
        if (!mainMenu || !tailMenu) {
            return;
        }

        const menuBounds = menuBar.getBoundingClientRect();
        const mainBounds = getContentBounds(mainMenu);
        if (this.aiButton && !this.aiButton.hidden) {
            const currentWidth = this.aiButton.getBoundingClientRect().width;
            const extraForLabel = 158 - currentWidth;
            const gap = getContentBounds(tailMenu).left - mainBounds.right;
            const compact = menuBounds.width <= 1100 || gap - extraForLabel < CENTER_MENU_GAP * 2;
            this.aiButton.classList.toggle('est-menu-bar-ai-compact', compact);
        }
        const tailBounds = getContentBounds(tailMenu);
        const centerX = menuBounds.left + (menuBounds.width / 2);
        const leftSpace = centerX - mainBounds.right - CENTER_MENU_GAP;
        const rightSpace = tailBounds.left - centerX - CENTER_MENU_GAP;
        const availableWidth = Math.min(
            CENTER_MENU_MAX_WIDTH,
            Math.max(0, Math.floor(Math.min(leftSpace, rightSpace) * 2))
        );

        menuBar.style.setProperty(CENTER_MENU_WIDTH_PROPERTY, `${availableWidth}px`);
    }

    render () {
        return this.state.mascotHost ? createPortal(
            <EstAiMascot
                compact
                animated={this.state.aiVisible}
            />,
            this.state.mascotHost
        ) : null;
    }
}

export default EstMenuBarLayout;
