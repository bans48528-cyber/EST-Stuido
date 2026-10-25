import {HardwareBleDriver} from '../hardware/ble-driver';
import {NEW_AI_BLE_SERVICE, NEW_AI_BLE_CHARACTERISTIC} from '../../common/new-ai-ble';

export class NewAiBleDriver extends HardwareBleDriver {
    constructor (options) {
        super({...options,
            service: NEW_AI_BLE_SERVICE,
            characteristic: NEW_AI_BLE_CHARACTERISTIC,
            namePrefixes: ['EST_BLUE'],
            errorPrefix: 'NEW_'});
    }
}
