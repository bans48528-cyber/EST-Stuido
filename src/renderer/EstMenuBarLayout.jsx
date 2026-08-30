import React from 'react';

const MENU_BAR_SELECTOR = '[class*="menu-bar_menu-bar_"]';
const MAIN_MENU_SELECTOR = '[class*="menu-bar_main-menu_"]';
const FILE_MENU_SELECTOR = '[class*="menu-bar_file-menu_"]';
const TAIL_MENU_SELECTOR = '[class*="menu-bar_tail-menu_"]';
const CENTER_MENU_MAX_WIDTH = 252;
const CENTER_MENU_GAP = 12;
const CENTER_MENU_WIDTH_PROPERTY = '--est-centered-file-menu-width';

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
        this.scheduleLayoutUpdate = this.scheduleLayoutUpdate.bind(this);
        this.updateLayout = this.updateLayout.bind(this);
    }

    componentDidMount () {
        window.addEventListener('resize', this.scheduleLayoutUpdate);
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
        if (this.layoutFrame) {
            window.cancelAnimationFrame(this.layoutFrame);
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
    }

    handleMenuMutation () {
        this.observeMenuParts();
        this.scheduleLayoutUpdate();
    }

    observeMenuParts () {
        const menuBar = document.querySelector(MENU_BAR_SELECTOR);
        if (!menuBar) {
            return;
        }

        const mainMenu = menuBar.querySelector(MAIN_MENU_SELECTOR);
        const fileMenu = menuBar.querySelector(FILE_MENU_SELECTOR);
        const tailMenu = menuBar.querySelector(TAIL_MENU_SELECTOR);

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
