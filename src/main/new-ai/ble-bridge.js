import {HardwareBleBridge} from '../hardware/ble-bridge';
import {NewAiError} from './protocol';

export class NewAiBleBridge extends HardwareBleBridge {
    constructor (options) {
        super({scanTimeout: 60000, ...options, channelPrefix: 'new-ai', errorPrefix: 'NEW_', ErrorType: NewAiError});
    }
}
