import {getEstText, normalizeEstLocale} from './est-i18n';

/* eslint-disable max-len -- complete bilingual guide sentences are easier to review without string concatenation */

// Shared Scratch-style blocks use the same precise explanations as the EST guide.
const STANDARD_DESCRIPTION_KEYS = {
    event_whenflagclicked: 'home.blockGuide.event_program_start',
    event_whenbroadcastreceived: 'home.blockGuide.event_broadcast_received',
    event_broadcast: 'home.blockGuide.event_broadcast',
    event_broadcastandwait: 'home.blockGuide.event_broadcast_wait',
    control_wait: 'home.blockGuide.control_wait_seconds',
    control_wait_until: 'home.blockGuide.control_wait_until',
    control_repeat: 'home.blockGuide.control_repeat',
    control_forever: 'home.blockGuide.control_forever',
    control_if: 'home.blockGuide.control_if',
    control_if_else: 'home.blockGuide.control_if_else',
    control_repeat_until: 'home.blockGuide.control_repeat_until',
    operator_add: 'home.blockGuide.operator_add',
    operator_subtract: 'home.blockGuide.operator_subtract',
    operator_multiply: 'home.blockGuide.operator_multiply',
    operator_divide: 'home.blockGuide.operator_divide',
    operator_random: 'home.blockGuide.operator_random',
    operator_gt: 'home.blockGuide.operator_gt',
    operator_lt: 'home.blockGuide.operator_lt',
    operator_equals: 'home.blockGuide.operator_equals',
    operator_and: 'home.blockGuide.operator_and',
    operator_or: 'home.blockGuide.operator_or',
    operator_not: 'home.blockGuide.operator_not',
    operator_join: 'home.blockGuide.operator_join',
    operator_letter_of: 'home.blockGuide.operator_letter_of',
    operator_length: 'home.blockGuide.operator_length',
    operator_contains: 'home.blockGuide.operator_contains',
    operator_mod: 'home.blockGuide.operator_mod',
    operator_round: 'home.blockGuide.operator_round',
    operator_mathop: 'home.blockGuide.operator_mathop'
};

const text = (zh, en) => ({zh, en});

const COMMON_DESCRIPTIONS = {
    control_break: text(
        '立即跳出当前所在的循环，从循环后面的积木继续执行；只能放在循环内部。',
        'Immediately exits the current loop and continues with the blocks after it. Use it only inside a loop.'
    )
};

const SPARK_DESCRIPTIONS = {
    motor_specifiedunit: text(
        '让 E–H 中所选电机按指定方向和功率运行若干秒；计时结束后停止，随后执行下一块积木。',
        'Runs the selected E–H motor in the chosen direction and at the chosen power for the given seconds, then stops and continues.'
    ),
    motor_startWithPower: text(
        '让 E–H 中所选电机按指定方向和功率持续转动；程序会立即往下执行，直到停止电机或发出新的电机指令。',
        'Starts the selected E–H motor continuously at the chosen direction and power. The program continues until a stop or another motor command.'
    ),
    motor_stop: text(
        '停止 E–H 中所选电机；实际采用制动还是滑行，由该电机先前设置的停止方式决定。',
        'Stops the selected E–H motor. Its previously selected stop mode determines whether it brakes or coasts.'
    ),
    motor_specified_manner: text(
        '设置 E–H 中所选电机以后收到停止指令时采用的方式；该设置不会立即启动或停止电机。',
        'Sets how the selected E–H motor behaves on a later stop command. This setting does not start or stop the motor immediately.'
    ),
    combined_motor_starting: text(
        '指定组合运动使用的左右电机端口，并按实际安装方向校正电机转向；后续组合电机积木都会使用这组设置。',
        'Chooses the left and right drive motors and corrects their directions for the physical build. Later paired-motor blocks use this setup.'
    ),
    combined_motor_stopping: text(
        '设置组合电机停止时的处理方式，例如制动保持或释放滑行；影响后续停止和定时运动结束。',
        'Sets the paired motors’ stop behavior, such as braking or coasting. It affects later stop commands and timed moves.'
    ),
    combined_mov_dir_power_seconds: text(
        '让已设置的左右电机按选择的移动方向和功率运行指定秒数；完成后停止并继续程序。',
        'Moves the configured motor pair in the selected direction and power for the given seconds, then stops and continues.'
    ),
    combined_mov_dir_power: text(
        '让已设置的左右电机按选择的方向和功率持续移动；程序立即继续，需用“停止运动”结束。',
        'Starts the configured motor pair continuously in the selected direction and power. Use Stop Movement to end it.'
    ),
    combined_motor_stop: text(
        '同时停止当前设置的左右驱动电机，并采用组合电机的停止方式。',
        'Stops both configured drive motors using the current paired-motor stop mode.'
    ),
    combined_motor_startWithPowerObj: text(
        '分别设置左、右电机功率并运行指定秒数；可用不同功率实现直行、转弯或原地旋转，结束后自动停止。',
        'Runs the left and right motors at separate powers for the given seconds. Different powers create straight, curved, or pivot movement.'
    ),
    combined_motor_startWithPower: text(
        '分别设置左、右电机功率并持续运行；正负功率决定各自方向，需另用停止积木结束。',
        'Runs the left and right motors continuously at separate powers. The sign controls each direction; use a stop block to finish.'
    ),
    combined_linepatrolInit: text(
        '清除双灰度巡线控制保存的历史误差；开始新的巡线循环前执行一次，避免上次误差影响首次修正。',
        'Clears the dual-sensor line controller’s saved error. Run it once before a new line-following loop.'
    ),
    combined_linepatrol_ltr: text(
        '读取 A–D 中指定的左右灰度传感器，使用左右基础功率、Kp 和 Kd 计算并更新一次双电机巡线输出；通常放在循环中反复执行。',
        'Reads the selected A–D left and right grayscale sensors and updates the drive motors once using base powers, Kp, and Kd. Usually repeated in a loop.'
    ),
    matrix_lamp: text(
        '把所选 5×7 图案和颜色显示到主机点阵；画面保持到下一次显示或清除。',
        'Shows the selected 5×7 pattern and color on the hub matrix. It remains until another display or clear command.'
    ),
    matrix_lamp_stop: text(
        '关闭 5×7 点阵上的全部像素，清除当前图案或文字。',
        'Turns off every pixel on the 5×7 matrix, clearing the current pattern or text.'
    ),
    matrix_lamp_set: text(
        '设置 5×7 点阵的整体亮度；影响之后显示的图案、文字和像素。',
        'Sets the overall 5×7 matrix brightness for later patterns, text, and pixels.'
    ),
    matrix_lamp_text: text(
        '把输入内容转换为文字并在 5×7 点阵上滚动显示，适合显示短词、数字和变量值。',
        'Converts the input to text and scrolls it across the 5×7 matrix, useful for short words, numbers, and variable values.'
    ),
    matrix_lamp_single: text(
        '按 X、Y 坐标单独点亮或熄灭一个 5×7 点阵像素；可重复使用来绘制自定义图案。',
        'Turns one 5×7 matrix pixel on or off at the given X and Y coordinates. Repeat it to draw a custom pattern.'
    ),
    sound_PlayMusic: text(
        '用主机蜂鸣器演奏所选音符并保持指定拍数；音符完成后再执行下一块积木。',
        'Plays the selected note on the hub buzzer for the given beats, then continues after the note finishes.'
    ),
    control_stop: text(
        '停止当前用户程序并退出运行；这块积木后面的指令不会再执行。',
        'Stops and exits the current user program. Blocks after it do not run.'
    ),
    sensing_key_judgment: text(
        '读取 A–D 中指定端口的触碰传感器，判断当前是否按下并返回真或假。',
        'Reads the touch sensor on the selected A–D port and reports true when it is currently pressed.'
    ),
    sensing_reflected_light_judgment: text(
        '读取 A–D 中指定灰度传感器的反射光数值，与设定值按大于、小于或等于比较，返回真或假。',
        'Reads reflected light from the selected A–D grayscale sensor, compares it with the threshold, and reports true or false.'
    ),
    sensing_reflected_light_detection: text(
        '返回 A–D 中指定灰度传感器当前测得的反射光数值；可用于显示、计算或巡线判断。',
        'Reports the current reflected-light value from the selected A–D grayscale sensor for display, calculation, or line decisions.'
    ),
    sensing_set_color_threshold_value: text(
        '设置 A–D 中指定灰度传感器区分明暗的阈值；“是否触发”积木会用这个阈值判断状态。',
        'Sets the light/dark threshold for the selected A–D grayscale sensor. The trigger-state block uses this threshold.'
    ),
    sensing_grayscale_state: text(
        '按已经设置或校准的阈值判断指定灰度传感器是否触发，返回真或假。',
        'Reports whether the selected grayscale sensor is triggered according to its configured or calibrated threshold.'
    ),
    sensing_one_calibrate: text(
        '在指定秒数内采集一个灰度传感器的明暗范围并完成校准；校准期间应让传感器经过实际底色和线条。',
        'Samples one grayscale sensor for the given seconds to calibrate its light and dark range. Move it over the real floor and line during sampling.'
    ),
    sensing_two_calibrate: text(
        '在指定秒数内同时校准两个灰度传感器；校准期间应让左右传感器都经过实际底色和线条。',
        'Calibrates two grayscale sensors together for the given seconds. Move both sensors over the real floor and line during sampling.'
    ),
    sensing_ultrasonic_judgment: text(
        '读取 A–D 中指定超声波传感器的距离，以厘米与设定值比较并返回真或假。',
        'Reads distance in centimeters from the selected A–D ultrasonic sensor, compares it with the threshold, and reports true or false.'
    ),
    sensing_ultrasonic_detection: text(
        '返回 A–D 中指定超声波传感器当前测得的距离值，单位为厘米。',
        'Reports the current distance in centimeters from the selected A–D ultrasonic sensor.'
    ),
    sensing_isHandling: text(
        '判断所选手柄编号上的指定按键或方向当前是否按下，返回真或假。',
        'Reports whether the selected button or direction on the chosen controller is currently pressed.'
    ),
    combined_forward_offset: text(
        '保存机器车前进时的左、右功率补偿值，用于修正两侧电机差异造成的跑偏。',
        'Stores left and right power offsets for forward movement to correct drift caused by motor differences.'
    ),
    combined_backward_offset: text(
        '保存机器车后退时的左、右功率补偿值，用于修正两侧电机差异造成的跑偏。',
        'Stores left and right power offsets for reverse movement to correct drift caused by motor differences.'
    ),
    read_adcance_left_offset: text(
        '返回当前保存的前进左电机补偿值，可用于显示、记录或计算。',
        'Reports the saved forward-left motor offset for display, logging, or calculation.'
    ),
    read_advance_right_offset: text(
        '返回当前保存的前进右电机补偿值，可用于显示、记录或计算。',
        'Reports the saved forward-right motor offset for display, logging, or calculation.'
    ),
    read_retreat_left_offset: text(
        '返回当前保存的后退左电机补偿值，可用于显示、记录或计算。',
        'Reports the saved reverse-left motor offset for display, logging, or calculation.'
    ),
    read_retreat_right_offset: text(
        '返回当前保存的后退右电机补偿值，可用于显示、记录或计算。',
        'Reports the saved reverse-right motor offset for display, logging, or calculation.'
    ),
    sensing_mainIsPress: text(
        '判断主机上所选按键当前是否处于指定状态，返回真或假。',
        'Reports whether the selected hub button is currently in the chosen state.'
    ),
    sensing_timer: text(
        '返回从程序启动或上次重置计时器后经过的秒数。',
        'Reports the seconds elapsed since program start or the last timer reset.'
    ),
    sensing_reset_timer: text(
        '把程序计时器立即归零，并从此刻重新计时。',
        'Immediately resets the program timer to zero and starts timing again.'
    )
};

const NEW_DESCRIPTIONS = {
    motor_starting: text(
        '让 A–H 中所选电机按指定方向持续转动，使用该电机已设置的速率；程序立即继续，直到停止或收到新指令。',
        'Starts the selected A–H motor continuously in the chosen direction at its configured rate. It runs until stopped or replaced by another command.'
    ),
    motor_stop: text(
        '停止 A–H 中所选电机；制动保持或释放滑行由该电机的停止方式设置决定。',
        'Stops the selected A–H motor. Its stop-mode setting determines braking or coasting.'
    ),
    motor_speed: text(
        '设置 A–H 中所选电机后续方向运行积木使用的默认速率百分比；不会立即启动电机。',
        'Sets the selected A–H motor’s default rate percentage for later direction commands. It does not start the motor.'
    ),
    motor_specifiedunit: text(
        '让 A–H 中所选电机按指定方向运行给定的度数、圈数或时间；完成后停止并继续程序。',
        'Runs the selected A–H motor in the chosen direction for the given degrees, rotations, or time, then stops and continues.'
    ),
    motor_specified_manner: text(
        '设置 A–H 中所选电机以后停止时采用制动保持还是释放滑行；不会立即改变当前运动。',
        'Sets whether the selected A–H motor brakes or coasts on later stops. It does not immediately change the current movement.'
    ),
    motor_startWithPower: text(
        '直接给 A–H 中所选电机设置功率和运行模式并持续转动；适合需要直接控制输出的场景，需另用停止积木结束。',
        'Drives the selected A–H motor continuously with the given power and mode for direct output control. Use a stop block to end it.'
    ),
    motor_reset_operating_degree: text(
        '把 A–H 中所选电机的相对运转角度归零；之后“电机角度”从当前位置重新累计。',
        'Resets the selected A–H motor’s relative angle to zero. The motor-angle reporter then counts from the current position.'
    ),
    motor_rate: text(
        '返回 A–H 中所选电机当前的输出速率值，可用于显示、记录或闭环判断。',
        'Reports the selected A–H motor’s current output rate for display, logging, or feedback logic.'
    ),
    motor_position: text(
        '返回 A–H 中所选电机一圈内的绝对位置；手动转动电机轴时该数值也会变化。',
        'Reports the selected A–H motor’s absolute position within one rotation. Turning the shaft by hand also changes it.'
    ),
    motor_angle: text(
        '返回 A–H 中所选电机自上次重置以来累计的相对角度，可超过一圈。',
        'Reports the selected A–H motor’s accumulated relative angle since the last reset; it can exceed one rotation.'
    ),
    combined_motor_starting: text(
        '指定后续组合运动使用的左右电机端口；应按机器车实际左右轮连接选择 A–H 中的两个电机。',
        'Chooses the left and right A–H motors used by later paired-motor blocks. Match the ports to the physical wheels.'
    ),
    combined_motor_direction: text(
        '让已设置的左右电机按选择的方向持续移动，使用组合电机当前速率；需用停止运动结束。',
        'Starts the configured motor pair continuously in the selected direction at the current pair rate. Use Stop Movement to end it.'
    ),
    combined_motor_speed: text(
        '设置后续组合电机方向运动和定量运动使用的默认速率百分比；不会立即启动电机。',
        'Sets the default rate percentage for later paired direction and measured moves. It does not start the motors.'
    ),
    combined_motor_line: text(
        '让组合电机按选择的方向运行指定度数、圈数或时间；动作完成后停止并继续程序。',
        'Moves the paired motors in the selected direction for the given degrees, rotations, or time, then stops and continues.'
    ),
    combined_motor_stop: text(
        '同时停止当前设置的左右电机，并采用组合电机的停止方式。',
        'Stops both configured drive motors using the current paired-motor stop mode.'
    ),
    combined_motor_stopping: text(
        '设置组合电机停止时采用制动保持还是释放滑行；影响后续停止和定量运动结束。',
        'Sets whether the paired motors brake or coast on later stops and at the end of measured moves.'
    ),
    combined_motor_startWithPower: text(
        '分别设置左右电机功率和运行模式并持续移动；可实现差速转弯或原地旋转，需另用停止积木结束。',
        'Runs the left and right motors continuously at separate powers and the selected mode for curves or pivot turns. Use a stop block to end it.'
    ),
    combined_motor_startWithPowerObj: text(
        '分别设置左右电机功率，并按指定度数、圈数或时间运行；完成后停止并继续程序。',
        'Runs the left and right motors at separate powers for the given degrees, rotations, or time, then stops and continues.'
    ),
    combined_motor_moveByYawAngle: text(
        '利用主机偏航角修正方向，让机器车直线前进或后退指定度数、圈数或时间；使用前应确认车体方向和偏航零点。',
        'Uses hub yaw feedback to keep a straight forward or reverse path for the given amount. Verify the build direction and yaw zero first.'
    ),
    combined_motor_spinByYawAngle: text(
        '利用主机偏航角让机器车原地旋转到指定角度；正负角度决定转向。',
        'Uses hub yaw feedback to pivot the robot by the given angle. The sign determines the turn direction.'
    ),
    combined_linepatrolInit: text(
        '清除双传感器巡线控制保存的历史误差；开始新的巡线循环前执行一次。',
        'Clears saved error in the dual-sensor line controller. Run it once before starting a new line-following loop.'
    ),
    combined_linepatrol: text(
        '读取两个巡线传感器，用统一基础功率、Kp 和 Kd 计算并更新一次左右电机输出；通常放在循环中。',
        'Reads two line sensors and updates the drive motors once using one base power, Kp, and Kd. Usually repeated in a loop.'
    ),
    combined_linepatrol_ltr: text(
        '读取两个巡线传感器，用独立的左右基础功率、Kp 和 Kd 更新一次电机输出；适合两侧机械差异较大的车体。',
        'Reads two line sensors and updates the motors once using separate left/right base powers, Kp, and Kd.'
    ),
    matrix_lamp: text(
        '用选择的颜色在 7×9 RGB 点阵显示所选图案；画面保持到下一次显示或清除。',
        'Shows the selected pattern in the chosen color on the 7×9 RGB matrix until another display or clear command.'
    ),
    matrix_lamp_stop: text(
        '关闭 7×9 RGB 点阵上的全部像素，清除当前图案或文字。',
        'Turns off every pixel on the 7×9 RGB matrix, clearing the current pattern or text.'
    ),
    matrix_lamp_set: text(
        '设置 7×9 RGB 点阵的整体亮度百分比；影响之后显示的图案、文字和像素。',
        'Sets the overall brightness percentage of the 7×9 RGB matrix for later patterns, text, and pixels.'
    ),
    matrix_lamp_text: text(
        '把输入内容转换为文字并在 7×9 RGB 点阵上滚动显示，适合显示短词、数字和变量值。',
        'Converts the input to text and scrolls it across the 7×9 RGB matrix.'
    ),
    matrix_color: text(
        '设置点阵后续单像素绘制使用的当前颜色；不会单独点亮像素。',
        'Sets the current color used by later single-pixel drawing. It does not light a pixel by itself.'
    ),
    matrix_lamp_single: text(
        '按 X、Y 坐标和亮度点亮一个 7×9 RGB 像素，颜色使用当前点阵颜色；可重复绘制自定义图案。',
        'Lights one 7×9 RGB pixel at the given X, Y, and brightness using the current matrix color.'
    ),
    sound_playuntildone: text(
        '播放所选声音，并等待播放完成后再执行下一块积木。',
        'Plays the selected sound and waits for it to finish before continuing.'
    ),
    sound_play: text(
        '开始播放所选声音后立即继续程序；声音可与后续动作同时进行。',
        'Starts the selected sound and immediately continues, allowing later actions to run while it plays.'
    ),
    sound_stopallsounds: text(
        '立即停止主机当前正在播放的所有声音和音符。',
        'Immediately stops all sounds and notes currently playing on the hub.'
    ),
    sound_setvolumeto: text(
        '设置主机后续声音和音符使用的音量百分比。',
        'Sets the hub volume percentage used by later sounds and notes.'
    ),
    sound_PlayMusic: text(
        '演奏所选音符并保持指定拍数；音符完成后再执行下一块积木。',
        'Plays the selected note for the given beats, then continues after the note finishes.'
    ),
    control_stop: text(
        '按下拉选项停止当前程序堆、其他程序堆、全部程序堆，或停止并退出整个用户程序。',
        'Stops the current stack, other stacks, all stacks, or stops and exits the user program according to the selected option.'
    ),
    sensing_color_judgment: text(
        '读取 A–H 中指定颜色传感器，判断当前识别结果是否为所选颜色并返回真或假。',
        'Reads the selected A–H color sensor and reports whether its recognized color matches the chosen color.'
    ),
    sensing_color_range: text(
        '读取指定颜色传感器的三个颜色通道，只有各通道都落在设定的最小值和最大值之间时才返回真。',
        'Reads the selected color sensor’s three channels and reports true only when every channel lies within its configured minimum and maximum.'
    ),
    sensing_color_detection: text(
        '返回 A–H 中指定颜色传感器当前识别到的颜色结果，可用于判断、显示或记录。',
        'Reports the color currently recognized by the selected A–H color sensor.'
    ),
    sensing_color_detectionRGB: text(
        '返回指定颜色传感器所选红、绿或蓝通道的原始数值，适合自定义颜色判断。',
        'Reports the selected red, green, or blue raw channel from the color sensor for custom color rules.'
    ),
    sensing_reflected_light_judgment: text(
        '读取指定颜色传感器的反射光强度，与设定值按大于、小于或等于比较，返回真或假。',
        'Reads reflected-light intensity from the selected color sensor, compares it with the threshold, and reports true or false.'
    ),
    sensing_reflected_light_detection: text(
        '返回指定颜色传感器当前测得的反射光强度，可用于巡线或明暗检测。',
        'Reports the selected color sensor’s reflected-light intensity for line following or light/dark detection.'
    ),
    sensing_ultrasonic_judgment: text(
        '读取 A–H 中指定超声波传感器的距离，以厘米与设定值比较并返回真或假。',
        'Reads distance in centimeters from the selected A–H ultrasonic sensor, compares it with the threshold, and reports true or false.'
    ),
    sensing_ultrasonic_detection: text(
        '返回 A–H 中指定超声波传感器当前测得的距离值，单位为厘米。',
        'Reports the current distance in centimeters from the selected A–H ultrasonic sensor.'
    ),
    sensing_sound_intensity: text(
        '返回主机麦克风当前测得的声音强度，可用于响度触发或数据记录。',
        'Reports the current sound intensity measured by the hub microphone for loudness triggers or logging.'
    ),
    sensing_gyroscope_attitude: text(
        '判断主机当前是否处于所选姿态或朝向，返回真或假。',
        'Reports whether the hub is currently in the selected attitude or orientation.'
    ),
    sensing_gyroscope_acceleration: text(
        '返回主机加速度计在所选 X、Y 或 Z 轴上的当前加速度值。',
        'Reports the hub accelerometer’s current value on the selected X, Y, or Z axis.'
    ),
    sensing_key_judgment: text(
        '读取 A–H 中指定端口的触碰传感器，判断当前是否按下并返回真或假。',
        'Reads the touch sensor on the selected A–H port and reports true when it is currently pressed.'
    ),
    sensing_isHandling: text(
        '判断所选手柄上的指定按键或方向当前是否按下，返回真或假。',
        'Reports whether the selected button or direction on the chosen controller is currently pressed.'
    ),
    sensing_Handling: text(
        '返回所选手柄摇杆在指定方向或轴上的当前数值，可用于比例控制电机速度或转向。',
        'Reports the selected controller joystick’s current axis value for proportional speed or steering control.'
    ),
    sensing_mainIsPress: text(
        '判断主机上所选按键当前是否处于指定状态，返回真或假。',
        'Reports whether the selected hub button is currently in the chosen state.'
    ),
    sensing_gyroscope_angle: text(
        '返回主机陀螺仪所选轴向的当前角度，用于转向、姿态判断或闭环控制。',
        'Reports the hub gyroscope’s current angle on the selected axis for turning, attitude checks, or feedback control.'
    ),
    sensing_set_yaw_angle: text(
        '把主机当前朝向设为偏航角 0°；使用偏航直行或按角度旋转前应在车体静止时执行。',
        'Sets the hub’s current heading to yaw 0°. Run it while stationary before yaw-straight or yaw-turn movement.'
    ),
    sensing_timer: text(
        '返回从程序启动或上次重置计时器后经过的秒数。',
        'Reports the seconds elapsed since program start or the last timer reset.'
    ),
    sensing_reset_timer: text(
        '把程序计时器立即归零，并从此刻重新计时。',
        'Immediately resets the program timer to zero and starts timing again.'
    ),
    sensing_get_gray_line: text(
        '返回指定端口巡迹卡上所选通道的传感器数值，可用于自定义巡线判断。',
        'Reports the selected channel value from the line-tracking board on the chosen port.'
    ),
    sensing_get_gray_lineState: text(
        '判断指定端口巡迹卡所选通道的数字状态是否为 1，返回真或假。',
        'Reports whether the selected channel on the line-tracking board has digital state 1.'
    ),
    sensing_judgelineState: text(
        '把指定巡迹卡当前的多通道组合状态与所选线型状态比较，返回真或假。',
        'Compares the line-tracking board’s current multi-channel state with the selected line pattern.'
    ),
    sensing_nfc_read: text(
        '读取 A–H 中指定端口 NFC 模块检测到的卡片或标签数据并返回结果。',
        'Reads and reports card or tag data detected by the NFC module on the selected A–H port.'
    ),
    cameraRecognition_changer_camer_mode: text(
        '命令 A–H 中指定端口的实体摄像头切换识别算法，并立即继续程序；随后读取前应预留切换时间。',
        'Commands the physical camera on the selected A–H port to change recognition mode and continues immediately. Allow time before reading results.'
    ),
    cameraRecognition_changer_waite_camer_mode: text(
        '命令指定端口的实体摄像头切换识别算法，并等待切换完成后再继续。',
        'Changes the physical camera’s recognition mode and waits for the switch to finish before continuing.'
    ),
    cameraRecognition_cam_dis_obj_id: text(
        '返回摄像头当前检测结果中第 N 个目标的所选数据，例如位置或大小；目标序号按本帧检测列表计算。',
        'Reports the selected data, such as position or size, for target N in the camera’s current detection list.'
    ),
    cameraRecognition_cam_dis_obj_name: text(
        '返回摄像头当前检测结果中第 N 个目标的类别名称；没有对应目标时不应把结果当作有效识别。',
        'Reports the class name of target N in the camera’s current detection list. Treat a missing target as invalid.'
    ),
    cameraRecognition_cam_dis_id: text(
        '按指定识别 ID 查找目标并返回所选数据，例如位置或大小；用于持续跟踪某一类别或编号。',
        'Finds the specified recognition ID and reports selected data such as position or size.'
    ),
    cameraRecognition_cam_dis_name: text(
        '返回指定识别 ID 对应的类别名称；数据来自连接在 A–H 端口上的实体摄像头。',
        'Reports the class name for the specified recognition ID from the physical camera connected to A–H.'
    ),
    grayv2_start_calibrate: text(
        '校准指定端口的巡线卡 V2；校准时按设备要求让各通道采集实际底色和线条。',
        'Calibrates the Line Tracker V2 on the selected port. Expose its channels to the real floor and line as required.'
    ),
    grayv2_set_threshold: text(
        '设置巡线卡 V2 指定通道区分黑线和底色的阈值；后续黑线判断使用这个值。',
        'Sets the selected Line Tracker V2 channel’s black-line threshold used by later state checks.'
    ),
    grayv2_set_rgb: text(
        '把巡线卡 V2 上的全部指示灯设置为所选颜色，用于状态提示；不改变巡线阈值。',
        'Sets all Line Tracker V2 indicator LEDs to the selected color without changing line thresholds.'
    ),
    grayv2_set_pid: text(
        '设置巡线卡 V2 自动巡线使用的 Kp 和 Kd 参数；Kp 控制纠偏强度，Kd 抑制快速摆动。',
        'Sets Kp and Kd for Line Tracker V2 following. Kp controls correction strength; Kd reduces rapid oscillation.'
    ),
    grayv2_if_ch_black: text(
        '按当前阈值判断巡线卡 V2 的指定通道是否识别到黑线，返回真或假。',
        'Reports whether the selected Line Tracker V2 channel sees a black line using its current threshold.'
    ),
    grayv2_read_ch: text(
        '返回巡线卡 V2 指定通道当前的光电模拟值，便于观察、校准或自定义算法。',
        'Reports the selected Line Tracker V2 channel’s current analog optical value.'
    ),
    grayv2_if_all_ch_way_state: text(
        '把巡线卡 V2 全部通道形成的当前线型与所选状态比较，可判断直线、路口或偏离等情况。',
        'Compares the Line Tracker V2’s full channel pattern with the selected state, such as line, junction, or deviation.'
    ),
    grayv2_power_find_if_ch_state: text(
        '以给定左右速度转弯，直到巡线卡 V2 的指定通道遇到线后停止该查线动作。',
        'Turns at the given left and right speeds until the selected Line Tracker V2 channel finds the line.'
    ),
    grayv2_power_find_way_type: text(
        '按设定速度自动巡线，识别到所选路口或线型后，再继续运行指定编码值。',
        'Follows the line at the given speed until the selected junction or pattern is detected, then moves the specified encoder amount.'
    ),
    grayv2_power_find_line: text(
        '按当前通道和 PID 设置执行一次巡线修正；通常放在循环中连续调用。',
        'Performs one line-following correction using the current channels and PID settings. Usually repeated in a loop.'
    ),
    grayv2_power_find_line_encord: text(
        '按设定速度自动巡线，直到电机累计运行指定编码值后结束。',
        'Follows the line at the given speed until the motors travel the specified encoder amount.'
    ),
    grayv2_power_find_line_ms: text(
        '按设定速度自动巡线指定毫秒数，时间结束后再继续程序。',
        'Follows the line at the given speed for the specified milliseconds, then continues.'
    ),
    grayv2_set_find_line_ch: text(
        '指定巡线卡 V2 哪些物理通道作为左、中、右巡线输入；应与传感器安装位置一致。',
        'Assigns the physical Line Tracker V2 channels used as left, center, and right inputs. Match the real installation.'
    )
};

const PRODUCT_DESCRIPTIONS = {
    'spark-ai': SPARK_DESCRIPTIONS,
    'new-ai': NEW_DESCRIPTIONS
};

export const getProductBlockDescription = (productId, blockId, locale) => {
    const standardKey = STANDARD_DESCRIPTION_KEYS[blockId];
    if (standardKey) return getEstText(standardKey, locale);
    const description = (PRODUCT_DESCRIPTIONS[productId] || {})[blockId] || COMMON_DESCRIPTIONS[blockId];
    if (!description) return '';
    return normalizeEstLocale(locale) === 'zh-cn' ? description.zh : description.en;
};

export default getProductBlockDescription;
