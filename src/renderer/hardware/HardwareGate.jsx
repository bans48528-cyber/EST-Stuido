import PropTypes from 'prop-types';
import React from 'react';
import {HARDWARE_CHANGED_EVENT, getHardwareContext, isAiHardwareActive} from './context';

export default class HardwareGate extends React.Component {
    constructor (props) {
        super(props);
        this.state = getHardwareContext();
        this.update = () => this.setState(getHardwareContext());
    }
    componentDidMount () { window.addEventListener(HARDWARE_CHANGED_EVENT, this.update); }
    componentWillUnmount () { window.removeEventListener(HARDWARE_CHANGED_EVENT, this.update); }
    render () {
        const supported = this.props.feature === 'ai' ? isAiHardwareActive() :
            this.props.feature === 'compiler' ? Boolean(this.state.profile.compiler) :
                this.state.profile.adapter === (this.props.feature === 'spark' ? 'spark-usb' : 'est-hid');
        return !this.state.busy && supported ? this.props.children : null;
    }
}
HardwareGate.propTypes = {children: PropTypes.node, feature: PropTypes.string};

export const withEstHardware = Component => props => (
    <HardwareGate><Component {...props} /></HardwareGate>
);

export const withHardwareCompiler = Component => props => (
    <HardwareGate feature="compiler"><Component {...props} /></HardwareGate>
);

export const withSparkHardware = Component => props => (
    <HardwareGate feature="spark"><Component {...props} /></HardwareGate>
);
