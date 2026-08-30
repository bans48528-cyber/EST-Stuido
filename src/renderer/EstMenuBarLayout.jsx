import React from 'react';

import {
    EST_LOCALE_CHANGED_EVENT,
    getCurrentEstLocale,
    getEstText
} from './est-i18n';

const MENU_BAR_SELECTOR = '[class*="menu-bar_menu-bar_"]';
const MAIN_MENU_SELECTOR = '[class*="menu-bar_main-menu_"]';
const FILE_MENU_SELECTOR = '[class*="menu-bar_file-menu_"]';
const TAIL_MENU_SELECTOR = '[class*="menu-bar_tail-menu_"]';
const CENTER_MENU_MAX_WIDTH = 252;
const CENTER_MENU_GAP = 12;
const CENTER_MENU_WIDTH_PROPERTY = '--est-centered-file-menu-width';
const HOME_BUTTON_CLASS = 'est-menu-bar-home-button';
const HOME_BUTTON_SELECTOR = `.${HOME_BUTTON_CLASS}`;

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
        this.handleMenuMutation = this.handleMenuMutation.bind(this);
        this.handleHomeButtonClick = this.handleHomeButtonClick.bind(this);
        this.handleLocaleChange = this.handleLocaleChange.bind(this);
        this.scheduleLayoutUpdate = this.scheduleLayoutUpdate.bind(this);
        this.updateLayout = this.updateLayout.bind(this);
    }

    componentDidMount () {
        window.addEventListener('resize', this.scheduleLayoutUpdate);
        window.addEventListener(EST_LOCALE_CHANGED_EVENT, this.handleLocaleChange);
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
    }

    handleMenuMutation () {
        this.observeMenuParts();
        this.scheduleLayoutUpdate();
    }

    handleHomeButtonClick (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    handleLocaleChange () {
        this.updateHomeButtonText();
    }

    updateHomeButtonText () {
        if (!this.homeButton) {
            return;
        }
        const label = getEstText('menu.home', getCurrentEstLocale());
        this.homeButton.textContent = label;
        this.homeButton.setAttribute('aria-label', label);
    }

    ensureHomeButton (mainMenu) {
        const existingButton = mainMenu.querySelector(HOME_BUTTON_SELECTOR);
        if (existingButton) {
            existingButton.removeEventListener('click', this.handleHomeButtonClick);
            existingButton.addEventListener('click', this.handleHomeButtonClick);
            this.homeButton = existingButton;
            this.updateHomeButtonText();
            return;
        }

        const homeButton = document.createElement('button');
        homeButton.type = 'button';
        homeButton.className = HOME_BUTTON_CLASS;
        homeButton.addEventListener('click', this.handleHomeButtonClick);

        const logoItem = mainMenu.firstElementChild;
        if (logoItem && logoItem.nextSibling) {
            mainMenu.insertBefore(homeButton, logoItem.nextSibling);
        } else {
            mainMenu.appendChild(homeButton);
        }
        this.homeButton = homeButton;
        this.updateHomeButtonText();
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
        return null;
    }
}

export default EstMenuBarLayout;
