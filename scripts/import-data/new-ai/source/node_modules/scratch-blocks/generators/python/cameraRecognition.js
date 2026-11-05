"use strict";

/**
 * @fileoverview Python code generation for Camera Recognition blocks.
 * @author Your Name
 */

goog.provide("Blockly.Python.cameraRecognition");

goog.require("Blockly.Python");

/**
 * 摄像头识别端口菜单积木块的代码生成器
 * 返回端口字符串值（如 "A", "B" 等）
 * @param {!Blockly.Block} block - 积木块对象
 * @return {Array} - [代码字符串, 操作符优先级]
 */
Blockly.Python["cameraRecognition_menu"] = function (block) {
  const menu = block.getFieldValue("CAMERARECOGNITION_MENU");
  return [`${menu}`, Blockly.Python.ORDER_ATOMIC];
};

/**
 * 将端口转换为数字的函数
 * 将端口字母（A-H）转换为对应的数字（0-7）
 * @param {string} port - 端口字符串，如 "A", "B" 等
 * @return {number|string} - 端口对应的数字，如果无法转换则返回原值
 */
Blockly.Python["cameraRecognition_port_to_number"] = function (port) {
  const portMap = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7 };

  if (port in portMap) {
    return portMap[port];
  } else {
    return port;
  }
};

/**
 * 生成 AprilTag 标签识别的 Python 代码
 * 这是一个值块（value block），返回识别到的标签字符串
 * @param {!Blockly.Block} block - 积木块对象
 * @return {Array} - [代码字符串, 操作符优先级]
 */
Blockly.Python["cameraRecognition_discerrn_aprltag_lab"] = function (block) {
  // 获取端口输入值，ORDER_NONE 表示不需要考虑操作符优先级
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A"; // 如果没有端口值，默认使用 "A"

  // 将端口转换为数字
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);

  // 生成 Python 代码：调用 discerrn_aprltag_lab 函数
  const code = Blockly.Python.handleResult(
    `discern_apriltag_lab(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );

  // 返回值块需要返回数组：[代码, 操作符优先级]
  // ORDER_ATOMIC 表示这是一个原子值，不需要括号
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_apriltaglab_id"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `apriltaglab_id(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_apriltaglab_x_point"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `apriltaglab_x_point(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_apriltaglab_y_point"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `apriltaglab_y_point(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_apriltaglab_angle"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `apriltaglab_angle(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_apriltaglab_cm"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `apriltaglab_cm(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_find_match_target"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `find_match_target(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_match_target"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `match_target(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_target_angle"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `target_angle(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_discern_face"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `discern_face(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_face_x_point"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `face_x_point(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_face_y_point"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `face_y_point(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_find_black_line"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `find_black_line(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_line_offset_angle"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `line_offset_angle(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_line_offset_cm"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `line_offset_cm(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_line_segment_promient"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `line_segment_promient(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_follow_block"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `follow_block(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_follow_block_size"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `follow_block_size(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_follow_x_point"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `follow_x_point(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_follow_y_point"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `follow_y_point(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_color_blue"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `color_blue(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_color_gread"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `color_gread(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_color_read"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `color_read(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};
//全局颜色检测模式设置
Blockly.Python["cameraRecognition_set_mode_color_detection"] = function (
  block,
) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `set_mode(${portValue},0x03)\n`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return code;
};
//巡线
Blockly.Python["cameraRecognition_set_mode_line_patrol"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `set_mode(${portValue},0x04)\n`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return code;
};

//人脸识别模式设置
Blockly.Python["cameraRecognition_set_mode_face_recognition"] = function (
  block,
) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `set_mode(${portValue},0x06)\n`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return code;
};

//特征点检测模式设置
Blockly.Python["cameraRecognition_set_mode_featurepoint_detection"] = function (
  block,
) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `set_mode(${portValue},0x10)\n`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return code;
};

//AprilTag模式设置
Blockly.Python["cameraRecognition_set_mode_apriltagtag_mode"] = function (
  block,
) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `set_mode(${portValue},0x0C)\n`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return code;
};

//查找颜色模式
Blockly.Python["cameraRecognition_set_find_color_mode"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `set_mode(${portValue},0x0D)\n`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return code;
};

Blockly.Python["cameraRecognition_find_color"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const code = Blockly.Python.handleResult(
    `find_color(${portValue})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_cmp_color"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const color = parseInt(block.getFieldValue("COLOR"), 10);
  const code = Blockly.Python.handleResult(
    `cmp_color(${portValue}, ${color})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_set_color_block_mode"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const R = Blockly.Python.valueToCode(
    block,
    "COLOR_R",
    Blockly.Python.ORDER_NONE,
  );
  const G = Blockly.Python.valueToCode(
    block,
    "COLOR_G",
    Blockly.Python.ORDER_NONE,
  );
  const B = Blockly.Python.valueToCode(
    block,
    "COLOR_B",
    Blockly.Python.ORDER_NONE,
  );
  const PRECENT = Blockly.Python.valueToCode(
    block,
    "COLOR_PRECENT",
    Blockly.Python.ORDER_NONE,
  );
  const code = Blockly.Python.handleResult(
    `set_color_block_mode(${portValue}, ${R}, ${G}, ${B}, ${PRECENT})\n`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return code;
};

/*
钟鸣新函数，不确定要不要
 */
Blockly.Python["cameraRecognition_changer_camer_mode"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const mode = parseInt(block.getFieldValue("MODE"), 10);
  const code = Blockly.Python.handleResult(
    `changer_camer_mode(${portValue}, ${mode})\n`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return code;
};

Blockly.Python["cameraRecognition_cam_dis_obj_id"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const objId =
    Blockly.Python.valueToCode(block, "OBJ_ID", Blockly.Python.ORDER_NONE) ||
    "0";
  const data = parseInt(block.getFieldValue("DATA"), 10);
  const code = Blockly.Python.handleResult(
    `cam_dis_obj_id(${portValue}, ${objId}, ${data})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_changer_waite_camer_mode"] = function (
  block,
) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const mode = parseInt(block.getFieldValue("MODE"), 10);
  const code = Blockly.Python.handleResult(
    `changer_waite_camer_mode(${portValue}, ${mode})\n`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return code;
};

Blockly.Python["cameraRecognition_cam_dis_obj_name"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const objId =
    Blockly.Python.valueToCode(block, "OBJ_ID", Blockly.Python.ORDER_NONE) ||
    "0";
  const code = Blockly.Python.handleResult(
    `cam_dis_obj_name(${portValue}, ${objId})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_cam_dis_id"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const id =
    Blockly.Python.valueToCode(block, "ID", Blockly.Python.ORDER_NONE) || "0";
  const data = parseInt(block.getFieldValue("DATA"), 10);
  const code = Blockly.Python.handleResult(
    `cam_dis_id(${portValue}, ${id}, ${data})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python["cameraRecognition_cam_dis_name"] = function (block) {
  const port =
    Blockly.Python.valueToCode(block, "PORT", Blockly.Python.ORDER_NONE) || "A";
  const portValue = Blockly.Python["cameraRecognition_port_to_number"](port);
  const id =
    Blockly.Python.valueToCode(block, "ID", Blockly.Python.ORDER_NONE) || "0";
  const code = Blockly.Python.handleResult(
    `cam_dis_name(${portValue}, ${id})`,
    Blockly.Python.CAMERA_RECOGNITION_TYPE,
  );
  return [code.trim(), Blockly.Python.ORDER_ATOMIC];
};
