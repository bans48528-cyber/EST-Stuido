import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import styles from './EstAiMascot.css';

export const EST_AI_MASCOT_STATES = ['idle', 'thinking', 'replying', 'success', 'error'];
const STATE_LABELS = {idle: '待机', thinking: '思考中', replying: '回复中', success: '完成', error: '遇到问题'};
let mascotSequence = 0;

// Layer geometry and motion adapted from the approved EST mascot motion prototype.
// Each mounted instance owns its paint-server IDs, including the menu portal instance.
class EstAiMascot extends React.PureComponent {
    constructor (props) {
        super(props);
        this.paintId = `est-mascot-${++mascotSequence}`;
        this.root = React.createRef();
        this.state = {
            focused: typeof document !== 'undefined' && typeof document.hasFocus === 'function' && document.hasFocus(),
            pageVisible: typeof document === 'undefined' || document.visibilityState !== 'hidden',
            intersecting: true
        };
        this.handleFocus = () => this.setState({focused: true});
        this.handleBlur = () => this.setState({focused: false});
        this.handleVisibility = () => this.setState({pageVisible: document.visibilityState !== 'hidden'});
    }

    componentDidMount () {
        this.mounted = true;
        window.addEventListener('focus', this.handleFocus);
        window.addEventListener('blur', this.handleBlur);
        document.addEventListener('visibilitychange', this.handleVisibility);
        if (typeof IntersectionObserver !== 'undefined') {
            this.observer = new IntersectionObserver(entries => {
                if (this.mounted) this.setState({intersecting: entries.some(entry => entry.isIntersecting)});
            });
            this.observer.observe(this.root.current);
        }
    }

    componentWillUnmount () {
        this.mounted = false;
        if (this.observer) this.observer.disconnect();
        window.removeEventListener('focus', this.handleFocus);
        window.removeEventListener('blur', this.handleBlur);
        document.removeEventListener('visibilitychange', this.handleVisibility);
    }

    render () {
        const {compact, animated, className} = this.props;
        const state = compact ? 'idle' : this.props.state;
        const running = animated && this.state.focused && this.state.pageVisible && this.state.intersecting;
        const id = name => `${this.paintId}-${name}`;
        const paint = name => `url(#${id(name)})`;
        return (
            <span
                ref={this.root}
                className={classNames(styles.mascot, className)}
                data-est-mascot="true"
                data-state={state}
                data-compact={compact}
                data-animated={running}
            >
                <svg
                    key={state}
                    viewBox={compact ? '18 -3 224 208' : '0 -22 260 252'}
                    role="img"
                    aria-labelledby={id('title')}
                    focusable="false"
                >
                    <title id={id('title')}>{`EST AI 机器人 · ${STATE_LABELS[state]}`}</title>
                    <defs>
                        <linearGradient
                            id={id('shell')}
                            x1="0"
                            y1="0"
                            x2=".85"
                            y2="1"
                        >
                            <stop stopColor="#fff" />
                            <stop
                                offset=".4"
                                stopColor="#edf7ff"
                            />
                            <stop
                                offset=".72"
                                stopColor="#cce8ff"
                            />
                            <stop
                                offset="1"
                                stopColor="#cefff5"
                            />
                        </linearGradient>
                        <linearGradient
                            id={id('edge')}
                            x2="1"
                            y2="1"
                        >
                            <stop stopColor="#a1ccff" /><stop
                                offset=".48"
                                stopColor="#e4f6ff"
                            />
                            <stop
                                offset="1"
                                stopColor="#63e4dd"
                            />
                        </linearGradient>
                        <linearGradient
                            id={id('screen')}
                            x1=".12"
                            y1="0"
                            x2=".85"
                            y2="1"
                        >
                            <stop stopColor="#3b8bf4" /><stop
                                offset=".48"
                                stopColor="#0871ea"
                            />
                            <stop
                                offset="1"
                                stopColor="#16c6db"
                            />
                        </linearGradient>
                        <linearGradient
                            id={id('error')}
                            x2=".85"
                            y2="1"
                        >
                            <stop stopColor="#7974d4" /><stop
                                offset=".5"
                                stopColor="#403ab0"
                            />
                            <stop
                                offset="1"
                                stopColor="#4978d6"
                            />
                        </linearGradient>
                        <radialGradient
                            id={id('gloss')}
                            cx=".18"
                            cy=".05"
                            r=".9"
                        >
                            <stop
                                stopColor="#fff"
                                stopOpacity=".65"
                            />
                            <stop
                                offset=".68"
                                stopColor="#fff"
                                stopOpacity="0"
                            />
                        </radialGradient>
                        <radialGradient
                            id={id('led')}
                            cx=".35"
                            cy=".25"
                            r=".8"
                        >
                            <stop stopColor="#f4ffff" /><stop
                                offset=".4"
                                stopColor="#b4fff2"
                            />
                            <stop
                                offset="1"
                                stopColor="#45cfea"
                            />
                        </radialGradient>
                        <radialGradient id={id('shadow')}>
                            <stop
                                stopColor="#339bdf"
                                stopOpacity=".3"
                            />
                            <stop
                                offset="1"
                                stopColor="#339bdf"
                                stopOpacity="0"
                            />
                        </radialGradient>
                    </defs>
                    <ellipse
                        className={styles.shadow}
                        cx="130"
                        cy="211"
                        rx="69"
                        ry="12"
                        fill={paint('shadow')}
                        aria-hidden="true"
                    />
                    <g
                        className={classNames(styles.effect, styles.thinkingEffect)}
                        aria-hidden="true"
                    >
                        <g
                            className={styles.orbit}
                            fill="#55dfc9"
                            stroke="#65dfd7"
                            strokeWidth="2"
                        >
                            <path
                                d="M85 29c12-15 34-20 55-16 15 3 28 10 33 21"
                                fill="none"
                                opacity=".5"
                            />
                            <circle
                                cx="87"
                                cy="29"
                                r="4"
                            /><circle
                                cx="157"
                                cy="20"
                                r="5"
                            />
                            <circle
                                cx="171"
                                cy="43"
                                r="3"
                            />
                        </g>
                    </g>
                    <g
                        className={classNames(styles.effect, styles.replyingEffect)}
                        aria-hidden="true"
                        fill="none"
                        stroke="#5fdcce"
                        strokeWidth="4"
                        strokeLinecap="round"
                    >
                        <path
                            className={styles.waveOne}
                            d="M22 103c-11 12-11 31 0 43M238 103c11 12 11 31 0 43"
                        />
                        <path
                            className={styles.waveTwo}
                            d="M10 94c-17 21-17 43 0 63M250 94c17 21 17 43 0 63"
                        />
                    </g>
                    <g
                        className={classNames(styles.effect, styles.successEffect)}
                        aria-hidden="true"
                        fill="#4cdec0"
                    >
                        <path
                            className={styles.spark}
                            d="M29 60l5 13 13 5-13 5-5 13-5-13-13-5 13-5z"
                        />
                        <path
                            className={classNames(styles.spark, styles.sparkTwo)}
                            d="M225 27l4 10 10 4-10 4-4 10-4-10-10-4 10-4z"
                        />
                        <path
                            className={styles.trail}
                            d="M27 161c17 41 64 58 106 43M208 177c24-18 31-39 28-63"
                            fill="none"
                            stroke="#66e5c7"
                            strokeWidth="3"
                            strokeLinecap="round"
                        />
                    </g>
                    <g
                        className={classNames(styles.effect, styles.errorEffect)}
                        aria-hidden="true"
                        stroke="#edb174"
                        strokeWidth="3"
                        strokeLinecap="round"
                    >
                        <path d="M41 169v16M31 174v9M219 169v16M229 174v9" />
                    </g>
                    <g className={styles.body}>
                        <g className={styles.antenna}>
                            <path
                                d="M130 56c0-19 3-29 20-37"
                                fill="none"
                                stroke={paint('edge')}
                                strokeWidth="13"
                                strokeLinecap="round"
                            />
                            <path
                                d="M128 51c0-17 5-26 19-33"
                                fill="none"
                                stroke="#f3ffff"
                                strokeWidth="5"
                                strokeLinecap="round"
                                opacity=".8"
                            />
                            <g className={styles.antennaTip}>
                                <circle
                                    cx="152"
                                    cy="18"
                                    r="12"
                                    fill={paint('led')}
                                    stroke="#b1f1fa"
                                />
                                <circle
                                    cx="149"
                                    cy="15"
                                    r="6"
                                    fill="#e8ffff"
                                    opacity=".85"
                                />
                            </g>
                        </g>
                        <ellipse
                            cx="130"
                            cy="51"
                            rx="19"
                            ry="8"
                            fill={paint('shell')}
                            stroke={paint('edge')}
                        />
                        <g className={classNames(styles.ear, styles.leftEar)}>
                            <rect
                                x="22"
                                y="94"
                                width="36"
                                height="65"
                                rx="18"
                                fill={paint('shell')}
                                stroke={paint('edge')}
                                strokeWidth="2"
                            />
                            <rect
                                className={styles.sideLight}
                                x="30"
                                y="102"
                                width="17"
                                height="48"
                                rx="9"
                                fill={paint('screen')}
                                stroke="#c5ffff"
                                strokeWidth="3"
                            />
                            <path
                                d="M29 110v27"
                                stroke="#fff"
                                strokeWidth="3"
                                strokeLinecap="round"
                                opacity=".8"
                            />
                        </g>
                        <g className={classNames(styles.ear, styles.rightEar)}>
                            <rect
                                x="202"
                                y="94"
                                width="36"
                                height="65"
                                rx="18"
                                fill={paint('shell')}
                                stroke={paint('edge')}
                                strokeWidth="2"
                            />
                            <rect
                                className={styles.sideLight}
                                x="213"
                                y="102"
                                width="17"
                                height="48"
                                rx="9"
                                fill={paint('screen')}
                                stroke="#c5ffff"
                                strokeWidth="3"
                            />
                        </g>
                        <rect
                            x="42"
                            y="49"
                            width="176"
                            height="144"
                            rx="49"
                            fill={paint('shell')}
                            stroke={paint('edge')}
                            strokeWidth="2"
                        />
                        <rect
                            x="47"
                            y="54"
                            width="166"
                            height="134"
                            rx="46"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="3"
                            opacity=".7"
                        />
                        <rect
                            x="58"
                            y="66"
                            width="144"
                            height="108"
                            rx="35"
                            fill="#9fdcff"
                            stroke="#fff"
                            strokeWidth="2"
                        />
                        <rect
                            className={styles.screen}
                            x="62"
                            y="70"
                            width="136"
                            height="100"
                            rx="32"
                            fill={paint(state === 'error' ? 'error' : 'screen')}
                            stroke={state === 'error' ? '#f3b778' : '#42bded'}
                            strokeWidth="2"
                        />
                        <rect
                            className={styles.screenGloss}
                            x="65"
                            y="73"
                            width="130"
                            height="93"
                            rx="30"
                            fill={paint('gloss')}
                            aria-hidden="true"
                        />
                        <path
                            d="M67 66c26-18 86-19 122 0"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="5"
                            strokeLinecap="round"
                            opacity=".65"
                            aria-hidden="true"
                        />
                        <g
                            className={classNames(styles.face, styles.idleFace)}
                            fill="#f3ffff"
                        >
                            <ellipse
                                className={styles.eye}
                                cx="101"
                                cy="116"
                                rx="10"
                                ry="15"
                            />
                            <ellipse
                                className={styles.eye}
                                cx="159"
                                cy="116"
                                rx="10"
                                ry="15"
                            />
                            <path
                                d="M115 143c9 9 21 9 30 0"
                                fill="none"
                                stroke="#f3ffff"
                                strokeWidth="7"
                                strokeLinecap="round"
                            />
                        </g>
                        <g
                            className={classNames(styles.face, styles.thinkingFace)}
                            fill="#f3ffff"
                        >
                            <ellipse
                                cx="100"
                                cy="116"
                                rx="10"
                                ry="15"
                            />
                            <circle
                                className={styles.loading}
                                cx="158"
                                cy="116"
                                r="17"
                                fill="none"
                                stroke="#f3ffff"
                                strokeWidth="5"
                                strokeLinecap="round"
                                strokeDasharray="1 10"
                            />
                            <path
                                d="M117 144c8 5 18 5 26 0"
                                fill="none"
                                stroke="#f3ffff"
                                strokeWidth="6"
                                strokeLinecap="round"
                            />
                        </g>
                        <g
                            className={classNames(styles.face, styles.replyingFace)}
                            fill="#f3ffff"
                        >
                            <ellipse
                                cx="101"
                                cy="110"
                                rx="10"
                                ry="14"
                            />
                            <ellipse
                                cx="159"
                                cy="110"
                                rx="10"
                                ry="14"
                            />
                            {[14, 23, 30, 23, 14].map((height, index) => (
                                <rect
                                    key={index}
                                    className={styles.eqBar}
                                    x={107 + (index * 10)}
                                    y={141 - (height / 2)}
                                    width="6"
                                    height={height}
                                    rx="3"
                                />
                            ))}
                        </g>
                        <g
                            className={classNames(styles.face, styles.successFace)}
                            fill="none"
                            stroke="#f3ffff"
                            strokeWidth="7"
                            strokeLinecap="round"
                        >
                            <path d="M88 119c8-10 18-10 26 0M146 119c8-10 18-10 26 0M113 141c11 13 24 13 34 0" />
                        </g>
                        <g
                            className={classNames(styles.face, styles.errorFace)}
                            fill="#f3ffff"
                        >
                            <path d="M91 107l20 5c0 23-20 23-20-5M149 112l20-5c0 28-20 28-20 5" />
                            <path
                                d="M115 147c5-7 10 7 15 0s10 7 15 0"
                                fill="none"
                                stroke="#f3ffff"
                                strokeWidth="6"
                                strokeLinecap="round"
                            />
                        </g>
                    </g>
                </svg>
            </span>
        );
    }
}

EstAiMascot.propTypes = {
    state: PropTypes.oneOf(EST_AI_MASCOT_STATES),
    compact: PropTypes.bool,
    animated: PropTypes.bool,
    className: PropTypes.string
};
EstAiMascot.defaultProps = {state: 'idle', compact: false, animated: true, className: ''};

export default EstAiMascot;
