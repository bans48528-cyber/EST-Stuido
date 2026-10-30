/* eslint-disable max-len */
import firmwareMessages from './firmware-messages';
import telemetryMessages from './telemetry-messages';
import bleMessages from './ble-messages';
import peripheralMessages from './peripheral-messages';
// zh-cn, en, pt-br, zh-tw, ru. Connection UI is localized independently of the phase-1 block audit.
const locales = ['zh-cn', 'en', 'pt-br', 'zh-tw', 'ru'];
const messages = {

    ...firmwareMessages,
    ...telemetryMessages,
    ...bleMessages,
    ...peripheralMessages,
    'title': ['NEW AI 连接与状态', 'NEW AI connection and status', 'Conexão e status do NEW AI', 'NEW AI 連線與狀態', 'Подключение и состояние NEW AI'],
    'connected': ['NEW AI 已连接', 'NEW AI connected', 'NEW AI conectado', 'NEW AI 已連線', 'NEW AI подключён'],
    'disconnected': ['NEW AI 未连接', 'NEW AI disconnected', 'NEW AI desconectado', 'NEW AI 未連線', 'NEW AI не подключён'],
    'verifying': ['正在确认 NEW AI…', 'Identifying NEW AI…', 'Identificando NEW AI…', '正在確認 NEW AI…', 'Определение NEW AI…'],
    'waiting': ['等待 NEW AI USB', 'Waiting for NEW AI USB', 'Aguardando USB do NEW AI', '等待 NEW AI USB', 'Ожидание USB NEW AI'],
    'close': ['关闭', 'Close', 'Fechar', '關閉', 'Закрыть'],
    'refresh': ['刷新端口', 'Refresh ports', 'Atualizar portas', '重新整理連接埠', 'Обновить порты'],
    'select': ['选择 USB 端口', 'Select USB port', 'Selecionar porta USB', '選擇 USB 連接埠', 'Выбрать USB-порт'],
    'noPorts': ['未发现候选 USB 端口', 'No candidate USB ports found', 'Nenhuma porta USB candidata encontrada', '未發現候選 USB 連接埠', 'Подходящие USB-порты не найдены'],
    'connect': ['连接', 'Connect', 'Conectar', '連線', 'Подключить'],
    'disconnect': ['断开', 'Disconnect', 'Desconectar', '中斷連線', 'Отключить'],
    'automatic': ['自动发现与重连', 'Automatic discovery and reconnect', 'Descoberta e reconexão automáticas', '自動探索與重新連線', 'Автопоиск и переподключение'],
    'connectionMemoryHint': ['自动连接设置和已确认主机保存在本机，重启后继续使用。', 'Automatic connection settings and the verified device are remembered on this computer.', 'As configurações de conexão automática e o dispositivo verificado são salvos neste computador.', '自動連線設定及已確認主機會儲存在本機，重新啟動後繼續使用。', 'Настройки автоподключения и проверенное устройство сохраняются на этом компьютере.'],
    'NEW_CONNECTION_MEMORY_FAILED': ['未能保存连接设置；本次选择仍然生效，重启后可能需要重新选择。', 'Connection settings could not be saved. Your current choice still applies; select it again after restarting.', 'Não foi possível salvar as configurações de conexão. A escolha atual continua válida; pode ser necessário selecioná-la novamente após reiniciar.', '無法儲存連線設定；本次選擇仍然生效，重新啟動後可能需要重新選擇。', 'Не удалось сохранить настройки подключения. Текущий выбор действует; после перезапуска его может потребоваться повторить.'],
    'choose': ['有多个候选端口，请选择一个连接。', 'Multiple candidate ports; select one to connect.', 'Há várias portas candidatas; selecione uma para conectar.', '有多個候選連接埠，請選擇一個連線。', 'Найдено несколько портов; выберите один для подключения.'],
    'pending': ['运行按钮会重新下载并启动所选槽位的程序。', 'Run downloads the program again and starts the selected slot.', 'Executar transfere o programa novamente e inicia o espaço selecionado.', '執行按鈕會重新下載並啟動所選槽位的程式。', 'Кнопка запуска заново загружает программу и запускает выбранный слот.'],
    'stale': ['数据已过期，请检查设备连接。', 'Data is stale; check the device connection.', 'Os dados estão desatualizados; verifique a conexão.', '資料已過期，請檢查裝置連線。', 'Данные устарели; проверьте подключение.'],
    'version': ['主机固件版本', 'Device firmware version', 'Versão do firmware', '主機韌體版本', 'Версия прошивки'],
    'usb': ['USB 端口', 'USB port', 'Porta USB', 'USB 連接埠', 'USB-порт'],
    'battery': ['电量', 'Battery', 'Bateria', '電量', 'Заряд'],
    'program': ['设备程序状态', 'Device program state', 'Estado do programa', '裝置程式狀態', 'Состояние программы'],
    'running': ['运行中', 'Running', 'Em execução', '執行中', 'Выполняется'],
    'stopped': ['已停止', 'Stopped', 'Parado', '已停止', 'Остановлена'],
    'unknown': ['未知', 'Unknown', 'Desconhecido', '未知', 'Неизвестно'],
    'ports': ['硬件端口', 'Hardware ports', 'Portas do dispositivo', '硬體連接埠', 'Порты устройства'],
    'none': ['未连接设备', 'No device', 'Nenhum dispositivo', '未連接裝置', 'Нет устройства'],
    'big_motor': ['大电机', 'Large motor', 'Motor grande', '大型馬達', 'Большой мотор'],
    'small_motor': ['中电机', 'Medium motor', 'Motor médio', '中型馬達', 'Средний мотор'],
    'color': ['颜色传感器', 'Color sensor', 'Sensor de cor', '顏色感測器', 'Датчик цвета'],
    'ultrasion': ['超声波传感器', 'Ultrasonic sensor', 'Sensor ultrassônico', '超音波感測器', 'Ультразвуковой датчик'],
    'touch': ['触碰传感器', 'Touch sensor', 'Sensor de toque', '觸碰感測器', 'Датчик касания'],
    'gray': ['巡线卡', 'Line sensor', 'Sensor de linha', '循線卡', 'Датчик линии'],
    'gray_v2': ['巡线卡 V2', 'Line sensor V2', 'Sensor de linha V2', '循線卡 V2', 'Датчик линии V2'],
    'nfc': ['NFC 传感器', 'NFC sensor', 'Sensor NFC', 'NFC 感測器', 'Датчик NFC'],
    'camera': ['摄像头模块', 'Camera module', 'Módulo de câmera', '攝影機模組', 'Модуль камеры'],
    'ir_remote': ['红外传感器', 'Infrared sensor', 'Sensor infravermelho', '紅外線感測器', 'ИК-датчик'],
    'elect_sensor': ['电磁模块', 'Electromagnet module', 'Módulo eletromagnético', '電磁模組', 'Электромагнитный модуль'],
    'dev null': ['设备未就绪', 'Device not ready', 'Dispositivo não pronto', '裝置尚未就緒', 'Устройство не готово'],
    'NEW_WRONG_DEVICE': ['此端口连接的是 Spark AI，请切换硬件或选择其他端口。', 'This port contains Spark AI. Switch hardware or select another port.', 'Esta porta está conectada ao Spark AI. Troque o hardware ou selecione outra porta.', '此連接埠連接的是 Spark AI，請切換硬體或選擇其他連接埠。', 'К этому порту подключён Spark AI. Смените устройство или порт.'],
    'NEW_IDENTITY_TIMEOUT': ['未收到 NEW AI 的有效状态，请确认主机已开机并正常上报。', 'No valid NEW AI status received. Check that the device is powered on and reporting.', 'Nenhum status válido do NEW AI recebido. Verifique se o dispositivo está ligado e enviando dados.', '未收到 NEW AI 的有效狀態，請確認主機已開機並正常回報。', 'Не получено состояние NEW AI. Проверьте питание и передачу данных.'],
    'NEW_SERIAL_ERROR': ['无法打开或读取 USB 端口，请检查连接及是否被其他软件占用。', 'Cannot open or read the USB port. Check the connection and other applications using it.', 'Não foi possível abrir ou ler a porta USB. Verifique a conexão e outros aplicativos usando a porta.', '無法開啟或讀取 USB 連接埠，請檢查連線及是否被其他軟體佔用。', 'Не удалось открыть или прочитать USB-порт. Проверьте подключение и другие приложения.'],
    'NEW_PORT_MISSING': ['所选端口已断开，请刷新后重试。', 'The selected port disconnected. Refresh and try again.', 'A porta selecionada foi desconectada. Atualize e tente novamente.', '所選連接埠已中斷，請重新整理後再試。', 'Выбранный порт отключён. Обновите список и повторите попытку.'],
    'NEW_DISCONNECTED': ['设备连接已断开。', 'Device disconnected.', 'Dispositivo desconectado.', '裝置連線已中斷。', 'Устройство отключено.'],
    'NEW_SCAN_ERROR': ['无法枚举 USB 端口，请重试。', 'Cannot list USB ports. Try again.', 'Não foi possível listar as portas USB. Tente novamente.', '無法列出 USB 連接埠，請再試一次。', 'Не удалось получить список USB-портов. Повторите попытку.'],
    'NEW_BUSY': ['设备操作进行中，请稍候。', 'A device operation is in progress. Please wait.', 'Uma operação do dispositivo está em andamento. Aguarde.', '裝置操作進行中，請稍候。', 'Выполняется операция с устройством. Подождите.'],
    'NEW_CANCELLED': ['操作已取消。', 'Operation cancelled.', 'Operação cancelada.', '操作已取消。', 'Операция отменена.'],
    'checkCompile': ['编译检查', 'Check compilation', 'Verificar compilação', '編譯檢查', 'Проверить компиляцию'],
    'runProgram': ['下载并运行', 'Download and run', 'Transferir e executar', '下載並執行', 'Загрузить и запустить'],
    'stopProgram': ['停止程序', 'Stop program', 'Parar programa', '停止程式', 'Остановить программу'],
    'starting': ['已保存，等待运行上报…', 'Saved; waiting for running status…', 'Salvo; aguardando status de execução…', '已儲存，等待執行回報…', 'Сохранено; ожидание состояния запуска…'],
    'stopping': ['正在确认主机停止状态…', 'Confirming that the device has stopped…', 'Confirmando a parada do dispositivo…', '正在確認主機停止狀態…', 'Проверка остановки устройства…'],
    'runObserved': ['已观察到程序运行，槽位', 'Program execution observed in slot', 'Execução observada no espaço', '已觀察到程式執行，槽位', 'Запуск программы подтверждён в слоте'],
    'runUnconfirmed': ['已保存，但未观察到运行；请检查主机。槽位', 'Saved, but execution was not observed. Check the device. Slot', 'Salvo, mas a execução não foi observada. Verifique o dispositivo. Espaço', '已儲存，但未觀察到執行；請檢查主機。槽位', 'Сохранено, но запуск не подтверждён. Проверьте устройство. Слот'],
    'stopObserved': ['已确认主机程序停止', 'Device program confirmed stopped', 'Parada do programa confirmada', '已確認主機程式停止', 'Остановка программы подтверждена'],
    'cancelWait': ['取消等待（不会撤回已发送的命令）', 'Cancel waiting (sent commands cannot be recalled)', 'Cancelar espera (comandos enviados não são revogados)', '取消等待（不會撤回已傳送的命令）', 'Отменить ожидание (отправленная команда не отменяется)'],
    'cancelTransfer': ['取消', 'Cancel', 'Cancelar', '取消', 'Отмена'],
    'disconnectRunning': ['断开连接不会停止主机上正在运行的程序，是否继续？', 'Disconnecting will not stop the program running on the device. Continue?', 'Desconectar não interrompe o programa no dispositivo. Continuar?', '中斷連線不會停止主機上正在執行的程式，是否繼續？', 'Отключение не остановит программу на устройстве. Продолжить?'],
    'NEW_DISCONNECT_CONFIRM': ['请确认是否断开仍在运行的主机。', 'Confirm disconnection while the device is running.', 'Confirme a desconexão enquanto o dispositivo executa.', '請確認是否中斷仍在執行的主機連線。', 'Подтвердите отключение работающего устройства.'],
    'NEW_START_UNCONFIRMED': ['启动请求已发送，但尚未观察到运行，请检查主机。', 'Start requested, but execution has not been observed. Check the device.', 'Inicialização solicitada, mas a execução não foi observada. Verifique o dispositivo.', '啟動請求已傳送，但尚未觀察到執行，請檢查主機。', 'Запуск запрошен, но выполнение не подтверждено. Проверьте устройство.'],
    'NEW_STOP_UNCONFIRMED': ['尚未确认停止；不会重复发送切换命令，请在主机上确认。', 'Stop is unconfirmed. The toggle command will not be resent; check the device.', 'Parada não confirmada. O comando de alternância não será reenviado; verifique o dispositivo.', '尚未確認停止；不會重複傳送切換命令，請於主機確認。', 'Остановка не подтверждена. Повторная команда не отправляется; проверьте устройство.'],
    'NEW_START_WAIT_CANCELLED': ['已取消等待；启动命令仍可能执行，请检查主机状态。', 'Waiting cancelled; the start command may still execute. Check the device.', 'Espera cancelada; o comando de início ainda pode executar. Verifique o dispositivo.', '已取消等待；啟動命令仍可能執行，請檢查主機狀態。', 'Ожидание отменено; запуск всё ещё возможен. Проверьте устройство.'],
    'NEW_STOP_WAIT_CANCELLED': ['已取消等待；已发送的停止请求不会撤回，请检查主机。', 'Waiting cancelled; the sent stop request is not recalled. Check the device.', 'Espera cancelada; a solicitação de parada não foi revogada. Verifique o dispositivo.', '已取消等待；已傳送的停止請求不會撤回，請檢查主機。', 'Ожидание отменено; запрос остановки не отменён. Проверьте устройство.'],
    'NEW_RUN_SAVE_FAILED': ['保存失败，未确认运行结果；请在主机上检查程序状态。', 'Saving failed and execution is unconfirmed. Check program status on the device.', 'A gravação falhou e a execução não foi confirmada. Verifique o programa no dispositivo.', '儲存失敗，未確認執行結果；請於主機檢查程式狀態。', 'Сохранение не удалось; запуск не подтверждён. Проверьте состояние программы на устройстве.'],
    'compiling': ['正在编译…', 'Compiling…', 'Compilando…', '正在編譯…', 'Компиляция…'],
    'downloading': ['正在下载，等待设备确认…', 'Downloading; waiting for device confirmation…', 'Transferindo; aguardando confirmação do dispositivo…', '正在下載，等待裝置確認…', 'Загрузка; ожидание подтверждения устройства…'],
    'compiled': ['编译检查通过，字节数：', 'Compilation passed, bytes:', 'Compilação concluída, bytes:', '編譯檢查通過，位元組數：', 'Компиляция успешна, байт:'],
    'downloaded': ['设备已确认保存到槽位', 'Device confirmed save to slot', 'Dispositivo confirmou gravação no espaço', '裝置已確認儲存至槽位', 'Устройство подтвердило сохранение в слот'],
    'NEW_SOURCE_INVALID': ['代码为空或超出支持范围。', 'Code is empty or exceeds supported limits.', 'O código está vazio ou excede os limites.', '程式碼為空或超出支援範圍。', 'Код пуст или превышает допустимый размер.'],
    'NEW_COMPILER_UNSUPPORTED': ['此电脑暂不支持 NEW AI 本地编译。', 'NEW AI local compilation is not supported on this computer.', 'A compilação local do NEW AI não é compatível com este computador.', '此電腦暫不支援 NEW AI 本機編譯。', 'Локальная компиляция NEW AI не поддерживается на этом компьютере.'],
    'NEW_COMPILER_INVALID': ['NEW AI 编译器资源缺失或校验失败。', 'NEW AI compiler resources are missing or invalid.', 'Os recursos do compilador NEW AI estão ausentes ou inválidos.', 'NEW AI 編譯器資源缺失或驗證失敗。', 'Ресурсы компилятора NEW AI отсутствуют или повреждены.'],
    'NEW_COMPILE_SYNTAX': ['代码存在语法错误，编译未通过。', 'Code contains a syntax error. Compilation failed.', 'O código contém erro de sintaxe. A compilação falhou.', '程式碼存在語法錯誤，編譯未通過。', 'В коде синтаксическая ошибка. Компиляция не выполнена.'],
    'NEW_COMPILE_FAILED': ['编译失败，请检查代码。', 'Compilation failed. Check the code.', 'A compilação falhou. Verifique o código.', '編譯失敗，請檢查程式碼。', 'Ошибка компиляции. Проверьте код.'],
    'NEW_COMPILE_TIMEOUT': ['编译超时，已终止本次检查。', 'Compilation timed out and was terminated.', 'A compilação excedeu o tempo limite e foi encerrada.', '編譯逾時，已終止本次檢查。', 'Время компиляции истекло. Процесс остановлен.'],
    'NEW_BYTECODE_INVALID': ['编译输出格式无效，未发送到设备。', 'Invalid compiler output. Nothing was sent to the device.', 'Saída do compilador inválida. Nada foi enviado ao dispositivo.', '編譯輸出格式無效，未傳送至裝置。', 'Неверный результат компиляции. Данные не отправлены устройству.'],
    'NEW_PROGRAM_SIZE': ['程序为空或达到 32 KiB 上限，请缩小程序。', 'Program is empty or reaches the 32 KiB limit. Reduce its size.', 'O programa está vazio ou atinge o limite de 32 KiB. Reduza o tamanho.', '程式為空或達到 32 KiB 上限，請縮小程式。', 'Программа пуста или достигла лимита 32 КиБ. Уменьшите её размер.'],
    'NEW_SLOT_INVALID': ['请选择 0–19 号程序槽位。', 'Select a program slot from 0 to 19.', 'Selecione um espaço de programa de 0 a 19.', '請選擇 0–19 號程式槽位。', 'Выберите слот программы от 0 до 19.'],
    'NEW_NO_START': ['请先添加程序开始事件积木。', 'Add a program-start event block first.', 'Adicione primeiro um bloco de evento de início.', '請先加入程式開始事件積木。', 'Сначала добавьте блок события запуска программы.'],
    'NEW_MOTOR_PAIR_INCOMPLETE': ['请为组合电机选择两个不同端口。', 'Choose two different ports for paired motors.', 'Escolha duas portas diferentes para os motores combinados.', '請為組合馬達選擇兩個不同連接埠。', 'Выберите два разных порта для пары моторов.'],
    'NEW_RUNNING': ['设备程序正在运行，请先停止再下载。', 'A device program is running. Stop it before downloading.', 'Um programa está em execução. Pare-o antes de transferir.', '裝置程式正在執行，請先停止再下載。', 'Программа выполняется. Остановите её перед загрузкой.'],
    'NEW_STATUS_STALE': ['状态数据已过期，暂不能下载。', 'Status data is stale. Download is unavailable.', 'Os dados de status estão desatualizados. A transferência está indisponível.', '狀態資料已過期，暫時無法下載。', 'Данные состояния устарели. Загрузка недоступна.'],
    'NEW_VERSION_UNSUPPORTED': ['当前下载适配对应 321 版主机资源，请核对设备版本。', 'Download support targets device resource version 321. Check the device version.', 'A transferência foi adaptada para a versão 321 dos recursos. Verifique a versão do dispositivo.', '目前下載適配對應 321 版主機資源，請核對裝置版本。', 'Загрузка рассчитана на ресурсы устройства версии 321. Проверьте версию.'],
    'NEW_DEVICE_ERROR': ['设备拒绝接收或保存失败，下载未完成。', 'The device rejected the transfer or failed to save. Download incomplete.', 'O dispositivo rejeitou a transferência ou falhou ao salvar. Transferência incompleta.', '裝置拒絕接收或儲存失敗，下載未完成。', 'Устройство отклонило данные или не сохранило их. Загрузка не завершена.'],
    'NEW_ACK_INVALID': ['设备应答无效，下载已中止。', 'Invalid device acknowledgement. Download aborted.', 'Confirmação do dispositivo inválida. Transferência interrompida.', '裝置回應無效，下載已中止。', 'Неверное подтверждение устройства. Загрузка прервана.'],
    'NEW_ACK_TIMEOUT': ['未及时收到设备确认，下载已中止。', 'Device acknowledgement timed out. Download aborted.', 'A confirmação do dispositivo excedeu o tempo limite. Transferência interrompida.', '未及時收到裝置確認，下載已中止。', 'Не получено подтверждение устройства. Загрузка прервана.'],
    'NEW_FRAME_INVALID': ['通信数据校验失败，下载已中止。', 'Communication validation failed. Download aborted.', 'Falha na validação dos dados. Transferência interrompida.', '通訊資料驗證失敗，下載已中止。', 'Ошибка проверки данных. Загрузка прервана.'],
    'NEW_WRITE_TIMEOUT': ['USB 发送超时，下载已中止。', 'USB write timed out. Download aborted.', 'O envio USB excedeu o tempo limite. Transferência interrompida.', 'USB 傳送逾時，下載已中止。', 'Время передачи USB истекло. Загрузка прервана.'],
    'NEW_DOWNLOAD_INCOMPLETE': ['上次下载中断，请重新连接后完整下载。', 'The last download was interrupted. Reconnect and download the complete program.', 'A última transferência foi interrompida. Reconecte e transfira o programa completo.', '上次下載中斷，請重新連線後完整下載。', 'Предыдущая загрузка прервана. Переподключитесь и загрузите программу полностью.'],
    'failure': ['操作未完成，请检查连接后重试。', 'Operation failed. Check the connection and try again.', 'A operação falhou. Verifique a conexão e tente novamente.', '操作未完成，請檢查連線後再試。', 'Операция не выполнена. Проверьте подключение и повторите попытку.'],
    ...{
        firmwareClose: [
            '关闭',
            'Close',
            'Fechar',
            '關閉',
            'Закрыть'
        ],
        firmwareBackgroundHint: [
            '可以关闭此窗口，软件会在后台等待设备重启并重新连接。请保持设备供电。',
            'You can close this window. The app will wait for the device to restart and reconnect in the background. Keep the device powered on.',
            'Você pode fechar esta janela. O aplicativo aguardará a reinicialização e a reconexão em segundo plano. Mantenha o dispositivo ligado.',
            '可以關閉此視窗，軟體會在背景等待裝置重新啟動並重新連線。請保持裝置供電。',
            'Можно закрыть это окно. Приложение продолжит ожидать перезапуска и подключения устройства в фоне. Не отключайте питание устройства.'
        ],
        firmwareMismatch: [
            'NEW AI 固件版本为 {current}，与软件需要的版本 {version} 不一致。是否现在更新？',
            'NEW AI firmware is {current}; this app requires {version}. Update now?',
            'O firmware do NEW AI é {current}; este aplicativo requer {version}. Atualizar agora?',
            'NEW AI 韌體版本為 {current}，與軟體需要的版本 {version} 不一致。是否現在更新？',
            'Версия прошивки NEW AI — {current}, приложению нужна {version}. Обновить сейчас?'
        ],
        firmwareQuestion: [
            '是否将 NEW AI 固件更新为版本 {version}？',
            'Update NEW AI firmware to version {version}?',
            'Atualizar o firmware do NEW AI para a versão {version}?',
            '是否將 NEW AI 韌體更新為版本 {version}？',
            'Обновить прошивку NEW AI до версии {version}?'
        ],
        firmwareCancel: [
            '取消',
            'Cancel',
            'Cancelar',
            '取消',
            'Отмена'
        ],
        firmwareRetry: [
            '重试更新',
            'Retry update',
            'Tentar atualizar novamente',
            '重試更新',
            'Повторить обновление'
        ],
        firmwareUpdating: [
            '正在更新…',
            'Updating…',
            'Atualizando…',
            '正在更新…',
            'Обновление…'
        ],
        firmwareDone: [
            '更新完成',
            'Update complete',
            'Atualização concluída',
            '更新完成',
            'Обновление завершено'
        ],
        firmwareUpdate: [
            '固件更新',
            'Firmware update',
            'Atualização de firmware',
            '韌體更新',
            'Обновление прошивки'
        ],
        firmwareResources: [
            '更新准备',
            'Update preparation',
            'Preparação da atualização',
            '更新準備',
            'Подготовка обновления'
        ],
        firmwareBundleVersion: [
            '内置资源版本',
            'Bundled resource version',
            'Versão dos recursos incluídos',
            '內建資源版本',
            'Версия встроенных ресурсов'
        ],
        firmwareSource: [
            '资源来源',
            'Resource source',
            'Origem dos recursos',
            '資源來源',
            'Источник ресурсов'
        ],
        firmwareIntegrityPassed: [
            '更新资源校验通过。',
            'Update resources verified.',
            'Recursos de atualização verificados.',
            '更新資源驗證通過。',
            'Ресурсы обновления проверены.'
        ],
        firmwareFile: [
            '文件',
            'File',
            'Arquivo',
            '檔案',
            'Файл'
        ],
        firmwareSize: [
            '大小',
            'Size',
            'Tamanho',
            '大小',
            'Размер'
        ],
        firmwareCheck: [
            '校验',
            'Validation',
            'Verificação',
            '驗證',
            'Проверка'
        ],
        firmwareFilePassed: [
            '通过',
            'Passed',
            'Verificado',
            '通過',
            'Пройдена'
        ],
        firmwareChecking: [
            '正在检查…',
            'Checking…',
            'Verificando…',
            '正在檢查…',
            'Проверка…'
        ],
        firmwareRecheck: [
            '重新检查',
            'Check again',
            'Verificar novamente',
            '重新檢查',
            'Проверить снова'
        ],
        firmwareStart: [
            '开始更新',
            'Start update',
            'Iniciar atualização',
            '開始更新',
            'Начать обновление'
        ],
        firmwareEraseNotice: [
            '更新会清空 NEW AI 中已保存的用户程序。请保持 USB 连接和设备供电。',
            'Updating will erase user programs saved on NEW AI. Keep USB connected and the device powered on.',
            'A atualização apagará os programas do usuário salvos no NEW AI. Mantenha o USB conectado e o dispositivo ligado.',
            '更新會清除 NEW AI 中已儲存的使用者程式。請保持 USB 連線和裝置供電。',
            'Обновление удалит пользовательские программы на NEW AI. Не отключайте USB и питание устройства.'
        ],
        firmwareEraseConfirm: [
            '我确认清空设备中已保存的程序并进行更新',
            'Erase saved device programs and update',
            'Confirmo apagar os programas do dispositivo e atualizar',
            '我確認清除裝置中已儲存的程式並更新',
            'Подтверждаю удаление программ устройства и обновление'
        ],
        firmwareRecovery: [
            '设备已进入升级模式，恢复更新',
            'Device is in update mode: recover',
            'Dispositivo em modo de atualização: recuperar',
            '裝置已進入升級模式，復原更新',
            'Устройство в режиме обновления: восстановить'
        ],
        firmwareRecoveryHelp: [
            '按住主机中键和右键开机进入升级模式，再连接 USB 并选择对应串口。也可使用原版软件恢复。',
            'Hold the center and right buttons while powering on to enter update mode, then connect USB and select its port. The original app can also restore the device.',
            'Segure os botões central e direito ao ligar para entrar no modo de atualização. Conecte o USB e selecione a porta. O aplicativo original também pode restaurar o dispositivo.',
            '按住主機中鍵和右鍵開機進入升級模式，再連接 USB 並選擇對應序列埠。也可使用原版軟體復原。',
            'Для режима обновления удерживайте центральную и правую кнопки при включении, затем подключите USB и выберите порт. Можно также использовать исходное приложение.'
        ],
        firmware: [
            '固件版本',
            'Firmware version',
            'Versão do firmware',
            '韌體版本',
            'Версия прошивки'
        ]
    }
};
export const NEW_AI_MESSAGE_IDS = Object.keys(messages);
export const newAiText = (key, locale = 'en', values = {}) => {
    const index = locales.includes(locale) ? locales.indexOf(locale) : 1;
    return (messages[key] || messages.failure)[index].replace(/\{(\w+)\}/g, (match, name) =>
        (Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match));
};
export const newAiErrorText = (error, locale) => {
    const code = String((error && (error.code || error.message)) || error).match(/NEW_[A-Z_]+/);
    const aliases = {NEW_OPEN_TIMEOUT: 'NEW_SERIAL_ERROR',
        NEW_CLOSE_TIMEOUT: 'NEW_SERIAL_ERROR',
        NEW_REQUEST_INVALID: 'failure'};
    return newAiText(code ? (aliases[code[0]] || code[0]) : 'failure', locale);
};
