"use strict";

goog.provide("Blockly.Python.sensing");

goog.require("Blockly.Python");

//转端口为数字函数
Blockly.Python["sensing_port_to_number"] = function (port) {
  const portMap = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7 };
  // 清理引号和其他非字母字符
  const UpperPort = port.toUpperCase().replace(/["']/g, "").trim();
  if (typeof UpperPort !== "string") return port;
  return portMap[UpperPort] !== undefined ? portMap[UpperPort] : UpperPort;
};

Blockly.Python["sensing_menu"] = function (block) {
  const menu = block.getFieldValue("SENSING_MENU");
  // TODO: Assemble Python into code variable.
  return [`"${menu}"`, Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_set_yaw_angle"] = function (block) {
  // TODO: Assemble Python into code variable.
  const code = `restyaw()\n`;
  return Blockly.Python.handleResult(code, Blockly.Python.MEM_TYPE);
};

Blockly.Python["sensing_gyroscope_acceleration"] = function (block) {
  const directiion = block.getFieldValue("directiion");
  const directionValue = parseInt(directiion, 10);
  const code = Blockly.Python.handleResult(
    `acc(${directiion})`,
    Blockly.Python.MEM_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_gyroscope_attitude"] = function (block) {
  const attitude = block.getFieldValue("attitude");
  // TODO: Assemble Python into code variable.
  const code = Blockly.Python.handleResult(
    `attitude("${attitude}")`,
    Blockly.Python.MEM_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_gyroscope_angle"] = function (block) {
  let port = block.getFieldValue("PORT");
  port = port[0].toLowerCase() + port.slice(1);
  const portValue = parseInt(port, 10);
  const code = Blockly.Python.handleResult(
    `gencory(${portValue})`,
    Blockly.Python.MEM_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_color_range"] = function (block) {
  const port = Blockly.Python.valueToCode(
    block,
    "PORT",
    Blockly.Python.ORDER_NONE
  );
  const rmin = Blockly.Python.valueToCode(
    block,
    "RMin",
    Blockly.Python.ORDER_NONE
  );
  const gmin = Blockly.Python.valueToCode(
    block,
    "GMin",
    Blockly.Python.ORDER_NONE
  );
  const bmin = Blockly.Python.valueToCode(
    block,
    "BMin",
    Blockly.Python.ORDER_NONE
  );
  const rmax = Blockly.Python.valueToCode(
    block,
    "RMax",
    Blockly.Python.ORDER_NONE
  );
  const gmax = Blockly.Python.valueToCode(
    block,
    "GMax",
    Blockly.Python.ORDER_NONE
  );
  const bmax = Blockly.Python.valueToCode(
    block,
    "BMax",
    Blockly.Python.ORDER_NONE
  );
  const portValue = Blockly.Python["sensing_port_to_number"](port);
  const str =
    "cmp_hsv(" +
    `${portValue}` +
    ", " +
    `${rmin}` +
    ", " +
    `${rmax}` +
    ", " +
    `${gmin}` +
    ", " +
    `${gmax}` +
    ", " +
    `${bmin}` +
    ", " +
    `${bmax}` +
    ")";
  const code = Blockly.Python.handleResult(str, Blockly.Python.COLOR_TYPE);
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_color_judgment"] = function (block) {
  const port = Blockly.Python.valueToCode(
    block,
    "PORT",
    Blockly.Python.ORDER_NONE
  );
  const color = Blockly.Python.valueToCode(
    block,
    "COLOR",
    Blockly.Python.ORDER_NONE
  );
  let index = "0";
  const list = [
    "#ff000c",
    "#ffe360",
    "#0090f5",
    "#00cb54",
    "#914800",
    "#ad0000",
    "#000000",
    "#ffffff",
  ];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (item == color.replace(/'/g, "")) {
      index = i + 1 + "";
    }
  }
  const portValue = Blockly.Python["sensing_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `cmp_color(${portValue}, ${index})`,
    Blockly.Python.COLOR_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_color_detection"] = function (block) {
  const port = Blockly.Python.valueToCode(
    block,
    "PORT",
    Blockly.Python.ORDER_NONE
  );
  const portValue = Blockly.Python["sensing_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `dectection(${portValue})`,
    Blockly.Python.COLOR_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_color_detectionRGB"] = function (block) {
  const port = Blockly.Python.valueToCode(
    block,
    "PORT",
    Blockly.Python.ORDER_NONE
  );
  const color = block.getFieldValue("color");
  let rgb;
  switch (color) {
    case "red":
      // rgb = '0xFF0000';
      rgb = "1";
      break;
    case "green":
      // rgb = '0x00FF00';
      rgb = "4";
      break;
    case "blue":
      // rgb = '0x0000FF';
      rgb = "3";
      break;
    default:
      break;
  }
  const portValue = Blockly.Python["sensing_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `rgb(${portValue}, ${rgb})`,
    Blockly.Python.COLOR_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_reflected_light_judgment"] = function (block) {
  const port = Blockly.Python.valueToCode(
    block,
    "PORT",
    Blockly.Python.ORDER_NONE
  );
  const judgment = block.getFieldValue("judgment");
  const inp = Blockly.Python.valueToCode(
    block,
    "value",
    Blockly.Python.ORDER_NONE
  );
  const portValue = Blockly.Python["sensing_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `cmp_lux(${portValue}, "${judgment}", ${inp})`,
    Blockly.Python.COLOR_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_reflected_light_detection"] = function (block) {
  const port = Blockly.Python.valueToCode(
    block,
    "PORT",
    Blockly.Python.ORDER_NONE
  );
  const portValue = Blockly.Python["sensing_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `lux(${portValue})`,
    Blockly.Python.COLOR_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_sound_intensity"] = function (block) {
  // TODO: Assemble Python into code variable.
  const code = Blockly.Python.handleResult(`voic()`, Blockly.Python.TIMER_TYPE);
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_ultrasonic_judgment"] = function (block) {
  const port = Blockly.Python.valueToCode(
    block,
    "PORT",
    Blockly.Python.ORDER_NONE
  );
  const judgment = block.getFieldValue("judgment");
  const inp = Blockly.Python.valueToCode(
    block,
    "value",
    Blockly.Python.ORDER_NONE
  );
  const portValue = Blockly.Python["sensing_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `cmp_value(${portValue}, "${judgment}", ${inp})`,
    Blockly.Python.ULTRASIONIC_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_ultrasonic_detection"] = function (block) {
  const port = Blockly.Python.valueToCode(
    block,
    "PORT",
    Blockly.Python.ORDER_NONE
  );
  const portValue = Blockly.Python["sensing_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `value(${portValue})`,
    Blockly.Python.ULTRASIONIC_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_key_judgment"] = function (block) {
  const port = Blockly.Python.valueToCode(
    block,
    "PORT",
    Blockly.Python.ORDER_NONE
  );
  const portValue = Blockly.Python["sensing_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `state(${portValue})`,
    Blockly.Python.TOUCH_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_mainIsPress"] = function (block) {
  const keys = block.getFieldValue("KEYS");
  const btn = block.getFieldValue("BUTTON");
  // TODO: Assemble Python into code variable.
  const code = Blockly.Python.handleResult(
    `key_mast("${keys}", ${btn})`,
    Blockly.Python.KEY_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_key_press"] = function (block) {
  const port = block.getFieldValue("PORT");
  const status = block.getFieldValue("status");
  // TODO: Assemble Python into code variable.
  const code = Blockly.Python.handleResult(
    `Sensing_key_press(${port}, "${status}")`,
    Blockly.Python.TOUCH_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};
//查看遥控器是否按下
Blockly.Python["sensing_isHandling"] = function (block) {
  const keys = block.getFieldValue("KEYS");
  const button = block.getFieldValue("BUTTON");
  const code = Blockly.Python.handleResult(
    `key_remote("${keys}","${button}")`,
    Blockly.Python.KEY_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

//遥控器获取坐标
Blockly.Python["sensing_Handling"] = function (block) {
  const keys = block.getFieldValue("KEYS");
  const button = block.getFieldValue("BUTTON");
  const code = Blockly.Python.handleResult(
    `key_remote("${keys}","${button}")`,
    Blockly.Python.KEY_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_get_gray_line"] = function (block) {
  const port = Blockly.Python.valueToCode(
    block,
    "PORT",
    Blockly.Python.ORDER_NONE
  );
  const value = block.getFieldValue("VALUES");
  const portValue = Blockly.Python["sensing_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `line(${portValue}, ${value})`,
    Blockly.Python.GRAY_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_get_gray_lineState"] = function (block) {
  const port = Blockly.Python.valueToCode(
    block,
    "PORT",
    Blockly.Python.ORDER_NONE
  );
  const value = block.getFieldValue("VALUES");
  const portValue = Blockly.Python["sensing_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `singe_line_state(${portValue}, ${value})`,
    Blockly.Python.GRAY_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_judgelineState"] = function (block) {
  const port = Blockly.Python.valueToCode(
    block,
    "PORT",
    Blockly.Python.ORDER_NONE
  );
  const status = block.getFieldValue("STATEUS");
  const portValue = Blockly.Python["sensing_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `cmp_state(${portValue}, ${status})`,
    Blockly.Python.GRAY_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_timer"] = function (block) {
  // TODO: Assemble Python into code variable.
  const code = Blockly.Python.handleResult(
    `timer()`,
    Blockly.Python.TIMER_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["sensing_reset_timer"] = function (block) {
  // TODO: Assemble Python into code variable.
  let code = `resetTimer()\n`;
  return Blockly.Python.handleResult(code, Blockly.Python.TIMER_TYPE);
};

//新增nfc读取
Blockly.Python["sensing_nfc_read"] = function (block) {
  const port = Blockly.Python.valueToCode(
    block,
    "PORT",
    Blockly.Python.ORDER_NONE
  );
  const portValue = Blockly.Python["sensing_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `read_car(${portValue})`,
    Blockly.Python.NFC_TYPE
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};
