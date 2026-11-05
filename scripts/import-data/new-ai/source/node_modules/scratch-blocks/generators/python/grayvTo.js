"use strict";

/**
 * @fileoverview Python code generation for grayv2 (七路灰度) blocks.
 */

goog.provide("Blockly.Python.grayvTo");

goog.require("Blockly.Python");

/**
 * 灰度 v2 端口菜单：返回端口标识（如 A、B），供 port_to_number 转换。
 */
Blockly.Python["grayv2_menu"] = function (block) {
  const menu = block.getFieldValue("GRAYV2_MENU");
  return [`${menu}`, Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["grayvTo_port_to_number"] = function (port) {
  const portMap = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7 };

  if (port in portMap) {
    return portMap[port];
  } else {
    return port;
  }
};

Blockly.Python["grayv2_if_ch_black"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["grayvTo_port_to_number"](port);
  const channel = block.getFieldValue("CHANNEL");
  const code = Blockly.Python.handleResult(
    `if_ch_black(${portValue}, ${channel})`,
    Blockly.Python.GRAYV2_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["grayv2_read_ch"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["grayvTo_port_to_number"](port);
  const channel = block.getFieldValue("CHANNEL");
  const code = Blockly.Python.handleResult(
    `read_ch(${portValue}, ${channel})`,
    Blockly.Python.GRAYV2_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["grayv2_if_all_ch_way_state"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["grayvTo_port_to_number"](port);
  const intersectionType = block.getFieldValue("INTERSECTION_TYPE");
  const code = Blockly.Python.handleResult(
    `if_all_ch_way_state(${portValue}, ${intersectionType})`,
    Blockly.Python.GRAYV2_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["grayv2_power_find_if_ch_state"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["grayvTo_port_to_number"](port);
  const leftSpeed =
    Blockly.Python.valueToCode(
      block,
      "LEFT_SPEED",
      Blockly.Python.ORDER_NONE,
    ) || "0";
  const rightSpeed =
    Blockly.Python.valueToCode(
      block,
      "RIGHT_SPEED",
      Blockly.Python.ORDER_NONE,
    ) || "0";
  const channel = block.getFieldValue("CHANNEL");
  const code = Blockly.Python.handleResult(
    `power_find_if_ch_state(${portValue}, ${leftSpeed}, ${rightSpeed}, ${channel})\n`,
    Blockly.Python.GRAYV2_TYPE,
  );
  return code;
};

Blockly.Python["grayv2_power_find_way_type"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["grayvTo_port_to_number"](port);
  const speed =
    Blockly.Python.valueToCode(block, "SPEED", Blockly.Python.ORDER_NONE) ||
    "0";
  const intersection = block.getFieldValue("INTERSECTION_TYPE");
  const codeValue =
    Blockly.Python.valueToCode(
      block,
      "CODE_VALUE",
      Blockly.Python.ORDER_NONE,
    ) || "0";
  const code = Blockly.Python.handleResult(
    `power_find_way_type(${portValue}, ${speed}, ${intersection}, ${codeValue})\n`,
    Blockly.Python.GRAYV2_TYPE,
  );
  return code;
};

Blockly.Python["grayv2_power_find_line"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["grayvTo_port_to_number"](port);
  const speed =
    Blockly.Python.valueToCode(block, "SPEED", Blockly.Python.ORDER_NONE) ||
    "0";
  const code = Blockly.Python.handleResult(
    `power_find_line(${portValue}, ${speed})\n`,
    Blockly.Python.GRAYV2_TYPE,
  );
  return code;
};

Blockly.Python["grayv2_power_find_line_encord"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["grayvTo_port_to_number"](port);
  const speed =
    Blockly.Python.valueToCode(block, "SPEED", Blockly.Python.ORDER_NONE) ||
    "0";
  const encoderValue =
    Blockly.Python.valueToCode(
      block,
      "ENCODER_VALUE",
      Blockly.Python.ORDER_NONE,
    ) || "0";
  const code = Blockly.Python.handleResult(
    `power_find_line_encord(${portValue}, ${speed}, ${encoderValue})\n`,
    Blockly.Python.GRAYV2_TYPE,
  );
  return code;
};

Blockly.Python["grayv2_power_find_line_ms"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["grayvTo_port_to_number"](port);
  const speed =
    Blockly.Python.valueToCode(block, "SPEED", Blockly.Python.ORDER_NONE) ||
    "0";
  const ms =
    Blockly.Python.valueToCode(
      block,
      "MILLISECONDS",
      Blockly.Python.ORDER_NONE,
    ) || "0";
  const code = Blockly.Python.handleResult(
    `power_find_line_ms(${portValue}, ${speed}, ${ms})\n`,
    Blockly.Python.GRAYV2_TYPE,
  );
  return code;
};

Blockly.Python["grayv2_start_calibrate"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["grayvTo_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `start_calibrate(${portValue})\n`,
    Blockly.Python.GRAYV2_TYPE,
  );
  return code;
};

Blockly.Python["grayv2_set_threshold"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["grayvTo_port_to_number"](port);
  const channel = block.getFieldValue("CHANNEL");
  const range =
    Blockly.Python.valueToCode(block, "RANGE", Blockly.Python.ORDER_NONE) ||
    "0";
  const code = Blockly.Python.handleResult(
    `set_threshold(${portValue}, ${channel}, ${range})\n`,
    Blockly.Python.GRAYV2_TYPE,
  );
  return code;
};

Blockly.Python["grayv2_set_rgb"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["grayvTo_port_to_number"](port);
  const r = block.getFieldValue("R");
  const code = Blockly.Python.handleResult(
    `set_rgb(${portValue}, ${r})\n`,
    Blockly.Python.GRAYV2_TYPE,
  );
  return code;
};

Blockly.Python["grayv2_set_pid"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["grayvTo_port_to_number"](port);
  const kp =
    Blockly.Python.valueToCode(block, "KP", Blockly.Python.ORDER_NONE) || "0";
  const ki =
    Blockly.Python.valueToCode(block, "KI", Blockly.Python.ORDER_NONE) || "0";
  const code = Blockly.Python.handleResult(
    `set_pid(${portValue}, ${kp}, ${ki})\n`,
    Blockly.Python.GRAYV2_TYPE,
  );
  return code;
};

Blockly.Python["grayv2_set_find_line_ch"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["grayvTo_port_to_number"](port);
  const lindex = block.getFieldValue("LINDEX");
  const mindex = block.getFieldValue("MINDEX");
  const rindex = block.getFieldValue("RINDEX");
  const code = Blockly.Python.handleResult(
    `set_find_line_ch(${portValue}, ${lindex}, ${mindex}, ${rindex})\n`,
    Blockly.Python.GRAYV2_TYPE,
  );
  return code;
};
