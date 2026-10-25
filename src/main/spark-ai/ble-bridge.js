import {HardwareBleBridge} from '../hardware/ble-bridge';
import {SparkError} from './protocol';

export class SparkBleBridge extends HardwareBleBridge {
    constructor (options) {
        super({...options, channelPrefix: 'spark', errorPrefix: 'SPARK_', ErrorType: SparkError});
    }
}
