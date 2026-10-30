/* eslint-disable max-len */
const locales = ['zh-cn', 'en', 'pt-br', 'zh-tw', 'ru'];
const messages = {
    connected: ['已连接', 'Connected', 'Conectado', '已連線', 'Подключено'],
    connecting: ['正在连接…', 'Connecting…', 'Conectando…', '正在連線…', 'Подключение…'],
    connectionMethod: ['连接方式', 'Connection type', 'Tipo de conexão', '連線方式', 'Тип подключения'],
    usbDevice: ['USB 设备', 'USB device', 'Dispositivo USB', 'USB 裝置', 'USB-устройство'],
    noUsbDevices: ['未发现 USB 设备', 'No USB devices found', 'Nenhum dispositivo USB encontrado', '未發現 USB 裝置', 'USB-устройства не найдены'],
    autoConnect: ['接入后自动连接', 'Connect automatically when attached', 'Conectar automaticamente ao conectar o USB', '接入後自動連線', 'Подключаться автоматически по USB'],
    autoReconnect: ['记住设备并自动重连', 'Remember device and reconnect', 'Lembrar dispositivo e reconectar', '記住裝置並自動重連', 'Запомнить устройство и подключаться автоматически'],
    usbHint: ['使用 USB 连接主机，选择对应设备后连接。', 'Connect the controller by USB, select it above, then connect.', 'Conecte o controlador por USB, selecione o dispositivo acima e conecte.', '使用 USB 連接主機，選擇對應裝置後連線。', 'Подключите контроллер по USB, выберите устройство и нажмите «Подключить».'],
    hidHint: ['EST 通过 USB 自动识别，无需选择串口。', 'EST is detected over USB without selecting a serial port.', 'O EST é detectado por USB, sem selecionar uma porta serial.', 'EST 透過 USB 自動識別，無需選擇序列埠。', 'EST определяется по USB без выбора последовательного порта.'],
    bluetoothHint: ['开启主机蓝牙，搜索并选择要连接的设备。', 'Enable Bluetooth on the controller, then search and select a device.', 'Ative o Bluetooth do controlador, busque e selecione um dispositivo.', '開啟主機藍牙，搜尋並選擇要連線的裝置。', 'Включите Bluetooth контроллера, найдите и выберите устройство.'],
    rememberedDevice: ['已记住的设备', 'Remembered device', 'Dispositivo salvo', '已記住的裝置', 'Сохранённое устройство'],
    forgetDevice: ['忘记设备', 'Forget device', 'Esquecer dispositivo', '忘記裝置', 'Забыть устройство'],
    searchBluetooth: ['搜索设备', 'Find devices', 'Buscar dispositivos', '搜尋裝置', 'Найти устройства'],
    cancelSearch: ['取消搜索', 'Cancel search', 'Cancelar busca', '取消搜尋', 'Отменить поиск'],
    pauseReconnect: ['暂停重连', 'Pause reconnect', 'Pausar reconexão', '暫停重連', 'Приостановить подключение'],
    noBluetoothDevices: ['尚未发现设备，请确认主机蓝牙已开启。', 'No devices found yet. Check that controller Bluetooth is on.', 'Nenhum dispositivo encontrado. Verifique se o Bluetooth do controlador está ligado.', '尚未發現裝置，請確認主機藍牙已開啟。', 'Устройства пока не найдены. Проверьте Bluetooth контроллера.'],
    searching: ['正在搜索附近的设备…', 'Searching for nearby devices…', 'Buscando dispositivos próximos…', '正在搜尋附近的裝置…', 'Поиск устройств поблизости…'],
    title: ['硬件状态', 'Hardware status', 'Status do hardware', '硬體狀態', 'Состояние устройства'],
    close: ['收起设备面板', 'Close device panel', 'Fechar painel do dispositivo', '收起裝置面板', 'Закрыть панель устройства'],
    more: ['设备设置', 'Device settings', 'Configurações do dispositivo', '裝置設定', 'Настройки устройства'],
    connection: ['连接设置', 'Connection settings', 'Configurações de conexão', '連線設定', 'Настройки подключения'],
    info: ['设备信息', 'Device information', 'Informações do dispositivo', '裝置資訊', 'Информация об устройстве'],
    back: ['返回端口', 'Back to ports', 'Voltar às portas', '返回連接埠', 'Назад к портам'],
    pause: ['暂停读数', 'Pause readings', 'Pausar leituras', '暫停讀數', 'Приостановить показания'],
    resume: ['继续更新', 'Resume readings', 'Retomar leituras', '繼續更新', 'Возобновить показания'],
    paused: ['读数已暂停', 'Readings paused', 'Leituras pausadas', '讀數已暫停', 'Показания приостановлены'],
    pauseHint: ['仅暂停此面板显示，设备通信继续。', 'Only this panel pauses; device communication continues.', 'Pausa apenas este painel; a comunicação continua.', '僅暫停此面板顯示，裝置通訊繼續。', 'Приостанавливается только панель; связь с устройством продолжается.'],
    disconnect: ['断开连接', 'Disconnect', 'Desconectar', '中斷連線', 'Отключить'],
    connect: ['连接', 'Connect', 'Conectar', '連線', 'Подключить'],
    disconnectRunning: ['主机正在运行程序，确定断开连接？', 'A program is running. Disconnect?', 'Há um programa em execução. Desconectar?', '主機正在執行程式，確定中斷連線？', 'Программа выполняется. Отключить устройство?'],
    disconnected: ['未连接', 'Disconnected', 'Desconectado', '未連線', 'Не подключено'],
    stale: ['未收到新数据', 'No fresh data', 'Sem dados recentes', '未收到新資料', 'Нет новых данных'],
    busy: ['设备正忙，暂不显示读数', 'Device busy; readings unavailable', 'Dispositivo ocupado; leituras indisponíveis', '裝置忙碌中，暫不顯示讀數', 'Устройство занято; показания недоступны'],
    empty: ['空闲', 'Empty', 'Livre', '閒置', 'Свободно'],
    noPeripheral: ['未接入外设', 'No peripheral attached', 'Nenhum periférico conectado', '未接入周邊裝置', 'Периферия не подключена'],
    unknown: ['未上报', 'Not reported', 'Não informado', '未回報', 'Нет данных'],
    noFeedback: ['此电机口无实时回传，无法确认是否接入。', 'This motor port has no live feedback; attachment is unknown.', 'Esta porta de motor não informa dados; a conexão é desconhecida.', '此電機埠無即時回傳，無法確認是否接入。', 'Нет обратной связи порта мотора; подключение неизвестно.'],
    outputOnly: ['输出数据不代表已接入电机。', 'Output data do not confirm a motor is attached.', 'Dados de saída não confirmam a presença de um motor.', '輸出資料不代表已接入電機。', 'Данные выхода не подтверждают подключение мотора.'],
    port: ['端口', 'Port', 'Porta', '連接埠', 'Порт'],
    motor: ['电机口', 'Motor port', 'Porta do motor', '電機埠', 'Порт мотора'],
    retry: ['刷新', 'Refresh', 'Atualizar', '重新整理', 'Обновить'],
    bluetooth: ['蓝牙', 'Bluetooth', 'Bluetooth', '藍牙', 'Bluetooth'],
    hidOnly: ['EST 使用 USB HID 连接。', 'EST connects through USB HID.', 'O EST conecta por USB HID.', 'EST 使用 USB HID 連線。', 'EST подключается через USB HID.'],
    mapping: ['连线仅表示端口对应关系。', 'Lines indicate port correspondence only.', 'As linhas indicam apenas as portas correspondentes.', '連線僅表示連接埠對應關係。', 'Линии обозначают только соответствие портов.']
};
export const hardwareStatusText = (key, locale = 'en') => {
    const index = locales.indexOf(locale);
    return messages[key] ? messages[key][index < 0 ? 1 : index] : key;
};
export const HARDWARE_STATUS_MESSAGE_IDS = Object.keys(messages);
