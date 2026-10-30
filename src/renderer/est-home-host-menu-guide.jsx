import PropTypes from 'prop-types';
import React from 'react';

import {getEstText} from './est-i18n';
import styles from './est-home-host-menu-guide.css';

// Original firmware menu bitmaps, kept in display row order.
// Spark: application/matrix/ui_manager.c and application/blue/blue.c (normalized to bit 4 on the left).
// NEW AI: Drivers/User/matrix/matrix.c, Font8X8 and batLevel (bit 7 on the left).
const MENUS = {
    'spark-ai': {
        columns: 5,
        firstBit: 4,
        frames: [
            {label: 'remote', rows: [14, 31, 31, 14, 4, 4, 31]},
            {label: 'bluetooth', rows: [6, 21, 13, 7, 13, 21, 6]},
            {label: 'pauto', rows: [14, 9, 9, 14, 8, 8, 8]},
            {label: 'program', number: 1, rows: [4, 12, 4, 4, 4, 4, 31]}
        ]
    },
    'new-ai': {
        columns: 7,
        firstBit: 7,
        background: '#ffffff',
        border: '#d6dce3',
        unlit: '#e7ebef',
        color: '#bc7515',
        frames: [
            {label: 'program', number: 1, rows: [0, 0x10, 0x30, 0x10, 0x10, 0x10, 0x10, 0x7C, 0]},
            {label: 'program', number: 19, rows: [0, 0x5C, 0x54, 0x54, 0x5C, 0x44, 0x44, 0x5C, 0]},
            {label: 'remote', rows: [0, 0x38, 0x7C, 0x7C, 0x38, 0x10, 0x10, 0x7C, 0]},
            {label: 'bluetooth', color: '#2675e2', rows: [0, 0x18, 0x54, 0x34, 0x18, 0x14, 0x34, 0x58, 0]},
            {label: 'battery', rows: [0, 0x38, 0x7C, 0x44, 0x7C, 0x7C, 0x7C, 0x7C, 0]}
        ]
    }
};

const HostMenuGuide = ({locale, productId}) => {
    const menu = MENUS[productId];
    if (!menu) return null;
    return (
        <div className={styles.hostMenuGuide}>
            <div className={styles.hostMenuStrip}>
                {menu.frames.map(frame => {
                    const label = getEstText(`home.hostMenu.${frame.label}`, locale, {number: frame.number});
                    const width = (menu.columns + 2) * 12;
                    const height = (frame.rows.length + 2) * 12;
                    return (
                        <figure
                            className={styles.hostMenuFrame}
                            key={`${frame.label}-${frame.number || ''}`}
                        >
                            <svg
                                aria-label={label}
                                role="img"
                                viewBox={`0 0 ${width} ${height}`}
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <title>{label}</title>
                                <rect
                                    fill={menu.background || '#24282c'}
                                    height={height}
                                    rx="6"
                                    stroke={menu.border || 'none'}
                                    width={width}
                                />
                                {frame.rows.map((row, rowIndex) => Array.from(
                                    {length: menu.columns},
                                    (unused, column) => (
                                        <rect
                                            fill={row & (1 << (menu.firstBit - column)) ?
                                                frame.color || menu.color || '#ffc46b' : menu.unlit || '#373c41'}
                                            height="8"
                                            key={`${rowIndex}-${column}`}
                                            rx="1"
                                            width="8"
                                            x={14 + (column * 12)}
                                            y={14 + (rowIndex * 12)}
                                        />
                                    )
                                ))}
                            </svg>
                            <figcaption>{label}</figcaption>
                        </figure>
                    );
                })}
            </div>
            <p className={styles.hostMenuCaption}>
                {getEstText('home.hostMenu.caption', locale)}
            </p>
        </div>
    );
};

HostMenuGuide.propTypes = {
    locale: PropTypes.string.isRequired,
    productId: PropTypes.string.isRequired
};

export default HostMenuGuide;
