"use strict";

goog.provide("Blockly.Python.combined_motor");

goog.require("Blockly.Python");

// 字母转换数字
Blockly.Python["combined_letter_to_number"] = function (port) {
  // 接收一个字母或者数字，如果字母是单个字母直接转，如果不是拆开再转
  const portMap = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7 };
  const cleanPort = port.replace(/['"]/g, "");
  if (cleanPort.includes("+")) {
    const ports = cleanPort.split("+");
    const numbers = ports.map((item) => {
      return portMap[item.trim()] !== undefined
        ? portMap[item.trim()]
        : item.trim();
    });
    return numbers.join(",");
  } else {
    return portMap[cleanPort] !== undefined ? portMap[cleanPort] : cleanPort;
  }
};

Blockly.Python["combined_motor_box"] = function (block) {
  const menu = block.getFieldValue("MOTOR");
  // TODO: Assemble Python into code variable.
  return [menu, Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["combined_motorOne_menu"] = function (block) {
  const menu = block.getFieldValue("COMBINED_MOTORONE_MENU");
  // TODO: Assemble Python into code variable.
  return [menu, Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["combined_motorTwo_menu"] = function (block) {
  const menu = block.getFieldValue("COMBINED_MOTORTWO_MENU");
  // TODO: Assemble Python into code variable.
  return [menu, Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["combined_motor_starting"] = function (block) {
  const port = Blockly.Python.valueToCode(
    block,
    "PORT",
    Blockly.Python.ORDER_NONE
  );

  // 使用转换函数将字母端口转换为数字
  const convertedPort = Blockly.Python["combined_letter_to_number"](port);

  const code = `pair(${convertedPort})\n`;
  return Blockly.Python.handleResult(code, Blockly.Python.MOTOR_TYPE);
};

Blockly.Python["combined_motor_direction"] = function (block) {
  let direction = block.getFieldValue("direction");
  direction = direction[0].toLowerCase() + direction.slice(1);
  // const {one, two} = Blockly.Python.combinedMotor(block, "PORT1", "PORT2");
  // TODO: Assemble Python into code variable.
  const code = `mov("${direction}")\n`;
  return Blockly.Python.handleResult(code, Blockly.Python.MOTOR_TYPE);
};

Blockly.Python["combined_motor_speed"] = function (block) {
  // const {one, two} = Blockly.Python.combinedMotor(block, "PORT1", "PORT2");
  const speed = Blockly.Python.valueToCode(
    block,
    "SPEED",
    Blockly.Python.ORDER_NONE
  );
  // TODO: Assemble Python into code variable.
  // const code = `motor_combined_speed("${one}", "${two}", ${speed});\n`;
  const code = `mov_set_duty(${speed})\n`;
  return Blockly.Python.handleResult(code, Blockly.Python.MOTOR_TYPE);
};

Blockly.Python["combined_motor_turn"] = function (block) {
  const spin = block.getFieldValue("SPIN");
  const angle = Blockly.Python.valueToCode(
    block,
    "ANGLE",
    Blockly.Python.ORDER_NONE
  );
  const distance = block.getFieldValue("distance");
  const unit = block.getFieldValue("unit");
  const { one, two } = Blockly.Python.combinedMotor(block, "PORT1", "PORT2");
  // TODO: Assemble Python into code variable.
  const code =
    `motor_combined_turn(` +
    `${Blockly.Python.toStr(one) ? one : '"' + one + '"'},` +
    `${Blockly.Python.toStr(two) ? two : '"' + two + '"'},` +
    `${Blockly.Python.toStr(spin) ? spin : '"' + spin + '"'},` +
    `${Blockly.Python.toStr(angle) ? angle : '"' + angle + '"'},` +
    `${Blockly.Python.toStr(distance) ? distance : '"' + distance + '"'},` +
    `${Blockly.Python.toStr(unit) ? unit : '"' + unit + '"'})\n`;
  return "\n";
};

Blockly.Python["combined_motor_line"] = function (block) {
  let line = block.getFieldValue("line");
  line = line[0].toLowerCase() + line.slice(1);
  const distance = Blockly.Python.valueToCode(
    block,
    "distance",
    Blockly.Python.ORDER_NONE
  );
  const unit = block.getFieldValue("unit");
  // const {one, two} = Blockly.Python.combinedMotor(block, "PORT1", "PORT2");
  // TODO: Assemble Python into code variable.
  // const code = `motor_combined_line("${one}", "${two}", "${line}", ${distance}, "${unit}");\n`;
  const code = `mov_for_degrees("${line}", ${distance}, "${unit}")\n`;
  return Blockly.Python.handleResult(code, Blockly.Python.MOTOR_TYPE);
};

Blockly.Python["combined_motor_stop"] = function (block) {
  // const {one, two} = Blockly.Python.combinedMotor(block, "PORT1", "PORT2");
  // TODO: Assemble Python into code variable.
  // const code = `motor_combined_stop("${one}", "${two}");\n`;
  const code = `mov_stop()\n`;
  return Blockly.Python.handleResult(code, Blockly.Python.MOTOR_TYPE);
};

Blockly.Python["combined_motor_move"] = function (block) {
  const left = Blockly.Python.valueToCode(
    block,
    "left",
    Blockly.Python.ORDER_NONE
  );
  const right = Blockly.Python.valueToCode(
    block,
    "right",
    Blockly.Python.ORDER_NONE
  );
  const distance = block.getFieldValue("distance");
  const result = block.getFieldValue("result");
  // TODO: Assemble Python into code variable.
  const code = `\n`;
  return code;
};

Blockly.Python["combined_motor_angle"] = function (block) {
  const angle = Blockly.Python.valueToCode(
    block,
    "ANGLE",
    Blockly.Python.ORDER_NONE
  );
  // TODO: Assemble Python into code variable.
  const code = `\n`;
  return code;
};

Blockly.Python["combined_motor_stopping"] = function (block) {
  const style = block.getFieldValue("status");
  const stopValue = parseInt(style, 10);
  const code = `mov_set_stop_module(${stopValue})\n`;
  return Blockly.Python.handleResult(code, Blockly.Python.MOTOR_TYPE);
};

Blockly.Python["combined_motor_startWithPower"] = function (block) {
  const one = Blockly.Python.valueToCode(
    block,
    "POWER_ONE",
    Blockly.Python.ORDER_NONE
  );
  const two = Blockly.Python.valueToCode(
    block,
    "POWER_TWO",
    Blockly.Python.ORDER_NONE
  );
  const mode = block.getFieldValue("MODE");
  const code = `mov_power(${one}, ${two}, ${mode})\n`;
  return Blockly.Python.handleResult(code, Blockly.Python.MOTOR_TYPE);
};

Blockly.Python["combined_motor_startWithPowerObj"] = function (block) {
  const one = Blockly.Python.valueToCode(
    block,
    "POWER_ONE",
    Blockly.Python.ORDER_NONE
  );
  const two = Blockly.Python.valueToCode(
    block,
    "POWER_TWO",
    Blockly.Python.ORDER_NONE
  );
  const count = Blockly.Python.valueToCode(
    block,
    "COUNT",
    Blockly.Python.ORDER_NONE
  );
  const unit = block.getFieldValue("unit");
  const code = `mov_for_power_degrees(${one}, ${two}, ${count}, "${unit}")\n`;
  return Blockly.Python.handleResult(code, Blockly.Python.MOTOR_TYPE);
};

Blockly.Python["combined_motor_moveByYawAngle"] = function (block) {
  const count = Blockly.Python.valueToCode(
    block,
    "COUNT",
    Blockly.Python.ORDER_NONE
  );
  const unit = block.getFieldValue("unit");
  let direction = block.getFieldValue("direction");
  direction = direction[0].toLowerCase() + direction.slice(1);
  const code = `mov_yaw_line("${direction}", ${count}, "${unit}")\n`;
  return Blockly.Python.handleResult(code, Blockly.Python.MOTOR_TYPE);
};

Blockly.Python["combined_motor_spinByYawAngle"] = function (block) {
  const angle = Blockly.Python.valueToCode(
    block,
    "ANGLE",
    Blockly.Python.ORDER_NONE
  );
  const code = `mov_yaw_angle(${angle})\n`;
  return Blockly.Python.handleResult(code, Blockly.Python.MOTOR_TYPE);
};

Blockly.Python["combined_motor_pwm"] = function (block) {
  const left = Blockly.Python.valueToCode(
    block,
    "LEFT_PWM",
    Blockly.Python.ORDER_NONE
  );
  const right = Blockly.Python.valueToCode(
    block,
    "RIGHT_PWM",
    Blockly.Python.ORDER_NONE
  );
  // TODO: Assemble Python into code variable.
  const code = `\n`;
  return code;
};

Blockly.Python["combined_linepatrolInit"] = function (block) {
  return Blockly.Python.handleResult(
    `mov_find_line_init()\n`,
    Blockly.Python.MOTOR_TYPE
  );
};

Blockly.Python["combined_linepatrol"] = function (block) {
  const portOne = Blockly.Python.valueToCode(
    block,
    "PORT_ONE",
    Blockly.Python.ORDER_NONE
  );
  const portTwo = Blockly.Python.valueToCode(
    block,
    "PORT_TWO",
    Blockly.Python.ORDER_NONE
  );
  const speed = Blockly.Python.valueToCode(
    block,
    "SPEED",
    Blockly.Python.ORDER_NONE
  );
  const kp = Blockly.Python.valueToCode(block, "KP", Blockly.Python.ORDER_NONE);
  const kd = Blockly.Python.valueToCode(block, "KD", Blockly.Python.ORDER_NONE);
  // const sp = Blockly.Python.valueToCode(
  //   block,
  //   "SPIN_PARAMS",
  //   Blockly.Python.ORDER_NONE
  // );
  return Blockly.Python.handleResult(
    `mov_find_line_run(${portOne}, ${portTwo}, ${speed}, ${kp}, ${kd})\n`,
    Blockly.Python.MOTOR_TYPE
  );
};

Blockly.Python["combined_linepatrol_ltr"] = function (block) {
  const portOne = Blockly.Python.valueToCode(
    block,
    "PORT_ONE",
    Blockly.Python.ORDER_NONE
  );
  const portTwo = Blockly.Python.valueToCode(
    block,
    "PORT_TWO",
    Blockly.Python.ORDER_NONE
  );
  const left = Blockly.Python.valueToCode(
    block,
    "LEFT",
    Blockly.Python.ORDER_NONE
  );
  const right = Blockly.Python.valueToCode(
    block,
    "RIGHT",
    Blockly.Python.ORDER_NONE
  );
  const kp = Blockly.Python.valueToCode(block, "KP", Blockly.Python.ORDER_NONE);
  const kd = Blockly.Python.valueToCode(block, "KD", Blockly.Python.ORDER_NONE);
  // const sp = Blockly.Python.valueToCode(
  //   block,
  //   "SPIN_PARAMS",
  //   Blockly.Python.ORDER_NONE
  // );
  return Blockly.Python.handleResult(
    `mov_find_line_power_run(${portOne}, ${portTwo}, ${left}, ${right}, ${kp}, ${kd})\n`,
    Blockly.Python.MOTOR_TYPE
  );
};
