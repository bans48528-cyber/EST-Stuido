import {HardwareBleDriver} from '../hardware/ble-driver';
import {SPARK_BLE_SERVICE, SPARK_BLE_CHARACTERISTIC} from '../../common/spark-ble';

export class SparkBleDriver extends HardwareBleDriver {
    constructor (options) {
        super({...options,
            service: SPARK_BLE_SERVICE,
            characteristic: SPARK_BLE_CHARACTERISTIC,
            namePrefixes: ['Spark', 'EST_BLUE'],
            errorPrefix: 'SPARK_'});
    }
}
