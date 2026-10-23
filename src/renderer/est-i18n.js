import editorMessageOverrides from './est-editor-message-overrides.json';
import cameraMessages from '../common/est-camera-messages.json';
import visionGuideMessages from './est-vision/guide-messages.json';

export const EST_DEFAULT_LOCALE = 'pt-br';
export const EST_LOCALE_CHANGED_EVENT = 'est-locale-changed';

export const EST_LOCALE_NAMES = {
    'en': 'English',
    'ru': 'Русский',
    'zh-cn': '简体中文',
    'zh-tw': '繁體中文',
    'pt-br': 'Português (Brasil)'
};

const zhCN = {
    'home.blockGuide.vision_valid': '视觉目标有效｜按类型读取左手、右手、人体或面部的最新状态。',
    'home.blockGuide.vision_gesture': '判断手势｜按左右手分别读取，同一程序可以同时判断两只手。',
    'home.blockGuide.vision_class': '视觉类别编号｜按类型返回类别编号，失效时返回 -1。',
    'home.blockGuide.vision_position': '视觉位置和大小｜按类型返回镜像预览坐标或大小，范围 0–100。',
    'block.vision.valid': '视觉 %1 有效？',
    'block.vision.waitState': '等待视觉 %1 %2',
    'block.vision.waitGesture': '等待视觉 %1 是 %2',
    'vision.valid': '有效', 'vision.invalid': '无效',
    'category.vision': '视觉',
    'vision.removedEvents': '此项目含已移除的视觉事件帽，已取消载入以保护原程序。请先在旧版中替换这些事件帽，再打开项目。',
    'extension.vision.description': '使用电脑摄像头识别手势、人脸动作和人体姿态，将选中的目标发送到 EST。',
    'block.vision.face.detected': '检测到人脸？',
    'block.vision.face.action': '人脸动作是 %1 ？',
    'block.vision.face.wait': '等待人脸动作是 %1',
    'block.vision.pose.detected': '检测到人体？',
    'block.vision.pose.action': '人体姿态是 %1 ？',
    'block.vision.pose.wait': '等待人体姿态是 %1',
    'vision.face.natural': '自然', 'vision.face.smile': '微笑',
    'vision.face.blink': '眨眼', 'vision.face.mouth': '张嘴',
    'vision.pose.standing': '站立', 'vision.pose.leftUp': '举起左手',
    'vision.pose.rightUp': '举起右手', 'vision.pose.bothUp': '举起双手',
    'vision.pose.squat': '下蹲', 'vision.pose.leanLeft': '身体左倾', 'vision.pose.leanRight': '身体右倾',
    'home.blockGuide.vision_face_detected': '检测到人脸｜直接读取面部缓存；需在摄像头页开启面部动作。',
    'home.blockGuide.vision_face_action': '人脸动作判断｜判断微笑、眨眼、张嘴或自然；可同时符合多个动作，不推断身份或情绪。',
    'home.blockGuide.vision_wait_face': '等待人脸动作｜等待当前发送的人脸符合指定动作；无目标时继续等待。',
    'home.blockGuide.vision_pose_detected': '检测到人体｜直接读取人体缓存；需在摄像头页开启人体姿态。',
    'home.blockGuide.vision_pose_action': '人体姿态判断｜判断站立、举手、下蹲或倾斜；基于可见关键点的简单规则。',
    'home.blockGuide.vision_wait_pose': '等待人体姿态｜等待当前发送的人体符合指定姿态；不切换摄像头发送对象。',
    'home.blockGuide.mode.vision.target': '识别对象｜电脑可同时发送左手、右手、人体和面部结果。',
    'home.blockGuide.vision_wait_state': '等待视觉状态｜等待目标有效或无效；条件已满足则立即继续，不阻塞其他协作任务。',
    'home.blockGuide.vision_wait_gesture': '等待视觉手势｜按指定左手或右手缓存等待，不影响其他视觉类型。',
    'block.vision.gesture': '视觉 %1 是 %2？',
    'block.vision.class': '视觉 %1 类别编号',
    'block.vision.position': '视觉 %1 %2（0–100）',
    'vision.cameraRunning': '视觉 · 摄像头运行中',
    'vision.settings': '查看摄像头',
    'vision.stopCamera': '停止摄像头',
    'vision.left': '左手', 'vision.right': '右手', 'vision.pose': '人体', 'vision.face': '面部',
    'vision.palm': '张开手掌', 'vision.fist': '握拳', 'vision.thumb': '点赞',
    'vision.point': '食指指向', 'vision.victory': '胜利手势', 'vision.other': '其他手势',
    'vision.x': 'X', 'vision.y': 'Y', 'vision.width': '宽度', 'vision.height': '高度',
    'menu.home': '主页',
    'home.navigation': '主页导航',
    'home.nav.files': '文件',
    'home.nav.build': '搭建',
    'home.nav.more': '其他',
    'home.startLine1': '从这里开始',
    'home.startLine2': '构建新的程序',
    'home.start': '开始',
    'home.returnToEditor': '返回编辑',
    'home.productImages': 'EST 产品图片',
    'home.animation.label': '机械手、机器人和机器车积木联动动画',
    'home.animation.eventBlock': '程序启动',
    'home.animation.motorBlock': '启动电机',
    'home.animation.displayBlock': '显示笑脸',
    'home.animation.arm.title': '机械手',
    'home.animation.arm.event': '程序启动',
    'home.animation.arm.action': '抬起机械臂',
    'home.animation.arm.result': '夹取完成',
    'home.animation.robot.title': '机器人',
    'home.animation.robot.event': '程序启动',
    'home.animation.robot.action': '挥动手臂',
    'home.animation.robot.result': '显示笑脸',
    'home.animation.car.title': '机器车',
    'home.animation.car.event': '程序启动',
    'home.animation.car.action': '小车前进',
    'home.animation.car.result': '打开车灯',
    'home.recentFiles': '最近文件',
    'home.noRecentFiles': '还没有最近文件',
    'home.noRecentFilesHint': '新建或保存作品后，它会显示在这里。',
    'home.open': '打开',
    'home.openFailed': '无法打开这个项目文件。',
    'home.replaceWarning': '当前作品有未保存的修改。确定要换成另一个作品吗？',
    'home.fileActions': '更多操作',
    'home.delete': '删除',
    'home.rename': '重命名',
    'home.copy': '复制',
    'home.copyDone': '项目副本已创建。',
    'home.copyFailed': '无法复制这个项目文件。',
    'home.renameFailed': '无法重命名这个项目文件。',
    'home.fileName': '文件名',
    'home.cancel': '取消',
    'home.confirm': '确定',
    'home.close': '关闭',
    'home.language': '语言设置',
    'home.build.title': '搭建课程',
    'home.build.subtitle': '选择模型，查看对应的 PDF 搭建说明',
    'home.build.categories': '搭建课程分类',
    'home.build.category.basic': '基础课程',
    'home.build.category.pbl': 'PBL 项目',
    'home.build.guide': '打开搭建说明 PDF',
    'home.build.openFailed': '无法打开这份搭建说明。',
    'home.build.libraryDownload': '下载完整搭建资源',
    'home.build.libraryDownloadHint': '新增 {count} 个搭建项目，约 43.6 MB；当前 8 个项目可离线使用。',
    'home.build.libraryReady': '完整搭建资源已安装',
    'home.build.libraryReadyHint': '共 {count} 个搭建项目，可直接打开说明。',
    'home.build.downloadButton': '下载资源',
    'home.build.downloadPhase.checking': '正在检查',
    'home.build.downloadPhase.downloading': '下载中 {percent}%',
    'home.build.downloadPhase.extracting': '正在解包',
    'home.build.downloadPhase.verifying': '正在校验',
    'home.build.downloadPhase.complete': '已完成',
    'home.build.downloadPaused': '已暂停 {percent}%',
    'home.build.downloadCancelling': '正在取消',
    'home.build.pauseButton': '暂停',
    'home.build.resumeButton': '继续',
    'home.build.cancelButton': '取消',
    'home.build.downloadComplete': '完整搭建资源安装完成。',
    'home.build.downloadCancelled': '已取消资源下载，临时文件已清理。',
    'home.build.downloadFailed': '资源下载失败，仍可使用内置的 8 个搭建项目。',
    'home.build.item.basic01': '爬行蜘蛛',
    'home.build.item.basic02': '前进小车',
    'home.build.item.basic04': '电子宠物狗',
    'home.build.item.basic13': '雷达守卫',
    'home.build.item.pbl01': '精准运输与分拣机器人',
    'home.build.item.pbl04': '双足机器人',
    'home.build.item.pbl07': '颜色分拣机',
    'home.build.item.pbl14': '机械臂',
    'home.build.robotArm': '机械手',
    'home.build.lineCar': '巡线小车',
    'home.build.obstacleCar': '避障车',
    'home.build.mechanicalArm': '机械臂',
    'home.build.transportCar': '搬运车',
    'home.build.sensorCar': '传感器车',
    'home.build.creative': '创意作品',
    'home.more.title': '使用与支持',
    'home.more.intro': '查看视觉识别、设备连接、硬件端口、积木编程、AI 助手和软件使用说明。遇到问题时，也可以从对应指南快速排查。',
    'home.more.est': '认识 EST',
    'home.more.estSummary': '了解 EST 主控、硬件扩展、编程功能和智能能力',
    'home.more.vision': '视觉识别与摄像头',
    'home.more.visionSummary': '识别双手、人体姿态和面部动作，并把结果发送到 EST',
    'home.more.interaction': '软硬件交互指南',
    'home.more.interactionSummary': '从连接 EST 到下载、运行和排查问题',
    'home.more.hardware': '硬件说明',
    'home.more.hardwareSummary': '主控、电机、传感器、视觉输入和固件升级',
    'home.more.blocks': '积木块功能说明',
    'home.more.blocksSummary': '逐一说明当前工具箱中每个积木块的功能',
    'home.more.ai': 'AI 编程助手',
    'home.more.aiSummary': '用自然语言生成、预览并应用 EST 积木程序',
    'home.more.software': '软件信息',
    'home.more.softwareSummary': '版本、项目文件、工作区与更新说明',
    'home.more.about': '关于我们',
    'home.more.aboutSummary': '产品定位、技术基础与获取支持',
    'home.dialog.est.title': 'EST 介绍',
    'home.dialog.est.lead': 'EST 是一套以可编程主控为核心的教育机器人系统。它把积木机械结构、电机、传感器、屏幕与声音连接起来，并通过 EST Studio 完成搭建参考、程序设计、下载运行和调试。',
    'home.dialog.est.overviewTitle': 'EST 是什么',
    'home.dialog.est.overviewImageAlt': '由 EST 主控、电机和积木结构搭建的爬行蜘蛛模型',
    'home.dialog.est.overviewImageCaption': '软件内置搭建库中的“爬行蜘蛛”示例，展示 EST 主控、电机与积木机械结构的组合。',
    'home.dialog.est.overview1': 'EST 主控是模型的控制中心：程序读取按键和传感器，根据逻辑控制电机、显示、状态灯与声音，让静态结构变成能够感知和行动的机器人。',
    'home.dialog.est.overview2': 'EST Studio 是配套桌面软件，负责项目管理、积木编程、Python 代码生成、USB 通信、硬件状态查看、程序下载运行与固件维护。',
    'home.dialog.est.overview3': '系统既适合第一次接触机器人编程的学习者，也支持巡线、避障、分拣、机械臂、仿生结构和视觉交互等综合项目。',
    'home.dialog.est.controllerTitle': '主控上的输入与输出',
    'home.dialog.est.controller1': '主控按键可作为程序输入，用于启动任务、切换状态或进行菜单交互；事件积木可以在按键按下或松开时启动程序堆。',
    'home.dialog.est.controller2': '180 × 128 显示屏可以显示内置图像、文字和自定义黑白图形；文字支持按行或按坐标放置。',
    'home.dialog.est.controller3': '状态灯支持关闭、红色和蓝色；声音输出支持音效、钢琴音符、音量设置和停止播放。',
    'home.dialog.est.controller4': 'USB 用于连接电脑、查询硬件、传输程序和更新固件。主控提供 0–7 八个程序槽位，程序下载后可以保存、加载、运行和停止。',
    'home.dialog.est.hardwareTitle': '电机、端口与传感器',
    'home.dialog.est.hardware1': 'A、B、C、D 是四个电机端口。程序可以单独控制一个电机，也可以把两个电机设为左右驱动组，实现直行、转向、差速运动和巡线。',
    'home.dialog.est.hardware2': '电机支持方向、速度、功率、圈数、角度和时间控制，并可读取累计角度、当前速度和堵转状态；停止时可选择保持位置或惯性滑行。',
    'home.dialog.est.hardware3': '1、2、3、4 是四个传感器端口。软件支持颜色传感器的反射光、环境光和颜色模式，以及触碰、超声波距离、红外近程与信标、陀螺仪角度与角速度、温度等输入。',
    'home.dialog.est.hardware4': '电脑摄像头还能作为不占用 1–4 端口的虚拟视觉输入。软件列出的传感器是当前支持范围，具体套装包含的主控、电机、传感器和结构件以实际配置为准。',
    'home.dialog.est.programmingTitle': '编程与设备控制',
    'home.dialog.est.programming1': '积木工具箱包含事件、电机、移动、显示、声音、控制、传感器、视觉、运算、变量与列表和“我的模块”，可以从顺序动作逐步搭建复杂逻辑。',
    'home.dialog.est.programming2': '积木会生成可查看的 Python 代码。一个项目可以包含多个事件程序堆，通过条件、循环、广播、计时器和自定义模块组织并行或协作任务。',
    'home.dialog.est.programming3': '连接 EST 后可选择程序槽位。“下载”保存当前程序，“运行”会先下载再启动，“停止”终止用户程序并让设备处理电机安全停止。',
    'home.dialog.est.programming4': '项目使用 .ests 文件保存；主页提供最近文件和搭建库，硬件状态面板显示连接、电量、固件和已识别外设，并提供固件升级或兼容性降级流程。',
    'home.dialog.est.smartTitle': 'AI 与视觉能力',
    'home.dialog.est.smart1': 'AI 编程助手可以把自然语言需求转换为经过本地规则校验的积木方案，支持预览、插入或替换工作区；是否应用、下载和运行始终由用户决定。',
    'home.dialog.est.smart2': '视觉识别在电脑上处理左手、右手、人体姿态和面部动作，可向 EST 发送目标有效状态、类别、镜像位置与大小，程序通过视觉积木读取。',
    'home.dialog.est.smart3': '摄像头画面和视觉模型处理保留在本机，不发送到 AI 编程服务；光线、遮挡和角度会影响识别，视觉结果不能替代人工检查与安全保护。',
    'home.dialog.est.useTitle': '可以用 EST 做什么',
    'home.dialog.est.use1': '基础学习：让电机运动，在屏幕显示信息，播放声音，并通过按键、等待、判断和循环理解程序流程。',
    'home.dialog.est.use2': '感知控制：制作巡线车、避障车、雷达守卫、颜色分拣机等，让传感器读数实时改变机器人的行为。',
    'home.dialog.est.use3': '综合项目：搭建机械臂、搬运与分拣机器人、双足机器人或视觉交互作品，把机械设计、数据、算法和任务分工结合起来。',
    'home.dialog.est.useNote': '使用前请核对实物端口、机械安装方向、软件版本与固件能力。第一次真机测试应使用低速度、短时间，并为运动结构留出安全空间。',
    'home.dialog.vision.title': '视觉识别与摄像头',
    'home.dialog.vision.lead': '使用电脑摄像头在本机识别左手、右手、人体姿态和面部动作，并把结构化结果实时发送给正在运行的 EST 程序。摄像头窗口与项目窗口相互独立。',
    'home.dialog.vision.openAction': '打开摄像头',
    'home.dialog.vision.startTitle': '打开并开始识别',
    'home.dialog.vision.startImageAlt': 'EST Studio 摄像头窗口正在识别左手',
    'home.dialog.vision.startImageCaption': '这是当前软件实际摄像头窗口的隔离测试画面；蓝色方块和识别结果为测试数据，不包含用户摄像头内容。',
    'home.dialog.vision.start1': '点击本指南上方的“打开摄像头”，或返回编辑器点击摄像头按钮；视觉识别会在独立窗口中打开。',
    'home.dialog.vision.start2': '在停止状态选择摄像头，并开启需要的左手、右手、身体或面部项目；至少要开启一项。只开启需要的项目可减少电脑负载。',
    'home.dialog.vision.start3': '点击“开始识别”。首次使用会先加载、初始化并预热本机模型，然后请求摄像头权限；看到预览与数据后即可使用。',
    'home.dialog.vision.start4': '点击“停止识别”会停止识别与发送；关闭独立窗口会释放摄像头。再次打开时需要重新开始识别。',
    'home.dialog.vision.modeTitle': '可以识别什么',
    'home.dialog.vision.mode1': '左手与右手分开识别：张开手掌、握拳、点赞、食指指向、胜利手势和其他手势。',
    'home.dialog.vision.mode2': '身体姿态：站立、举起左手、举起右手、举起双手、下蹲、身体左倾和身体右倾。',
    'home.dialog.vision.mode3': '面部动作：自然、微笑、眨眼和张嘴；微笑、眨眼、张嘴可能同时成立。该功能不识别人物身份。',
    'home.dialog.vision.mode4': '视觉积木还能读取目标是否有效、类别编号，以及镜像预览中的横向位置、纵向位置、宽度和高度；位置与大小统一为 0–100。',
    'home.dialog.vision.programTitle': '在积木程序中使用',
    'home.dialog.vision.program1': '新项目默认不显示视觉积木。点击编辑器左下角的“添加扩展”，选择“视觉”，视觉类别才会加入积木区。',
    'home.dialog.vision.program2': '视觉扩展提供 12 个判断、读数和等待积木，可按左手、右手、人体或面部读取结果；当前不提供“识别到时”事件帽。',
    'home.dialog.vision.program3': '打开摄像头，开启程序所需的识别项目并开始识别；只添加视觉扩展不会自动启动摄像头。',
    'home.dialog.vision.program4': '连接 EST 后下载并运行程序。摄像头窗口会自动把最新有效数据送到 EST，程序再通过视觉积木读取；AI 编程助手也可以生成这些视觉积木。',
    'home.dialog.vision.programNote': '先在积木块功能说明中查看每个视觉积木的图片、目标类型、动作选项和返回值，再按真机显示的数据核对条件。',
    'home.dialog.vision.firmwareTitle': '连接与固件要求',
    'home.dialog.vision.firmware1': '只启用一个识别目标时，EST 需要协议 1.30 和 vision-input 能力；软件已知版本 M1.27B 对应此协议。',
    'home.dialog.vision.firmware2': '同时启用多个识别目标时，EST 需要协议 1.31 和 vision-input-multi 能力；软件已知版本 M1.28A 对应此协议。',
    'home.dialog.vision.firmware3': '未连接或固件不支持时，本机预览与识别仍可继续，窗口底部会说明未发送的原因；请在“硬件状态”中查看版本并按硬件说明完成升级。',
    'home.dialog.vision.firmware4': '下载程序或升级固件时会暂停发送；程序没有运行时会等待，目标离开画面或数据过期时会把该目标设为无效，避免程序继续读取旧结果。',
    'home.dialog.vision.privacyTitle': '隐私、性能与识别边界',
    'home.dialog.vision.privacy1': '视觉模型和识别运算在本机完成，摄像头画面不会发送到 AI 编程服务；软件只通过 USB 向 EST 发送类别、位置、大小等结构化数值。',
    'home.dialog.vision.privacy2': '光线、遮挡、人与摄像头的距离和角度都会影响结果。请让目标完整进入画面，并根据电脑性能减少同时开启的识别项目。',
    'home.dialog.vision.privacy3': '面部功能只判断列出的简单动作，不用于身份、年龄、健康或情绪推断；视觉结果适合交互与教学验证，不应作为安全判断的唯一依据。',
    'home.dialog.vision.troubleshootTitle': '常见问题',
    'home.dialog.vision.troubleshoot1': '找不到摄像头或没有画面：检查 Windows 摄像头权限，关闭正在占用摄像头的其他软件，然后重新打开窗口或切换设备。',
    'home.dialog.vision.troubleshoot2': '首次启动较慢：等待窗口完成模型加载、初始化和预热；如果提示加载失败，重新打开窗口并确认软件文件完整。',
    'home.dialog.vision.troubleshoot3': '本机能识别但 EST 没有数据：检查 USB 连接、固件能力、程序是否正在运行，以及摄像头中是否开启了程序使用的目标。',
    'home.dialog.vision.troubleshoot4': '单项目正常、多项目不能发送：把摄像头切换为只开启一个目标测试；若单项目可用，请按硬件说明升级到支持协议 1.31 的固件。',
    'home.dialog.interaction.title': '软硬件交互指南',
    'home.dialog.interaction.lead': '按照下面的顺序完成连接、编程和运行。EST Studio 会自动发现一台通过 USB 连接的 EST。',
    'home.dialog.interaction.connectTitle': '第一次连接',
    'home.dialog.interaction.connect1': '使用能够传输数据的 USB 线连接电脑与 EST，并开启 EST。',
    'home.dialog.interaction.connect2': '打开 EST Studio；软件会自动查找设备，不需要手动选择主控型号。',
    'home.dialog.interaction.connect3': '确认菜单栏显示“EST 已连接”。如果显示“未连接”，重新插拔 USB 线或更换电脑 USB 端口。',
    'home.dialog.interaction.connect4': '新建或打开 .ests 项目，从“当程序启动时”积木开始搭建程序。',
    'home.dialog.interaction.programTitle': '下载、运行与停止',
    'home.dialog.interaction.program1': '程序槽位共有 0–7 八个。先选择槽位；槽位选择只决定程序保存位置，不会修改项目内容。',
    'home.dialog.interaction.program2': '“下载”会把当前积木生成的 Python 程序写入所选槽位，并覆盖该槽位原有程序。',
    'home.dialog.interaction.program3': '“运行”会先下载当前程序，再启动所选槽位，适合边编程边测试。',
    'home.dialog.interaction.program4': '“停止”只终止当前用户程序；EST 会负责让运行中的电机安全停止。',
    'home.dialog.interaction.hostTitle': '在主机屏幕上操作',
    'home.dialog.interaction.host1':
        '不连接电脑时，也可用 EST 主机的六个实体按键打开“最近程序”“程序”“端口查看”“红外遥控”“马达输出”和“设置”，' +
        '直接运行已保存的程序或查看端口。完整按键说明见“其他 → 硬件说明 → 主机屏幕与按键”。',
    'home.dialog.interaction.host2': '主机屏幕上的“端口查看”和“设置”属于设备自身菜单；电脑软件菜单栏中的“硬件状态”用于连接详情与固件更新，两者不是同一个界面。',
    'home.dialog.interaction.feedbackTitle': '查看运行反馈',
    'home.dialog.interaction.feedback1': '操作进行时，界面会显示正在生成、下载或启动；完成后会提示对应槽位。',
    'home.dialog.interaction.feedback2': '如果积木无法生成有效 Python，下载不会开始。检查悬空输入、无效变量名或不完整的积木连接。',
    'home.dialog.interaction.feedback3': '如果固件不支持程序使用的功能，先在硬件状态中完成固件更新，再重新下载。',
    'home.dialog.interaction.feedbackNote': '下载、运行启动或固件更新期间，请保持 USB 和电源稳定，不要拔线或关闭软件。',
    'home.dialog.interaction.visionTitle': '电脑摄像头作为视觉输入',
    'home.dialog.interaction.vision1': '视觉识别在电脑上运行，通过 USB 把左手、右手、人体和面部的结构化结果作为虚拟传感器数据发送到 EST，不占用 1–4 传感器端口。',
    'home.dialog.interaction.vision2': '项目使用视觉积木时，要先添加“视觉”扩展，再打开摄像头并开启相同的识别目标；只有 EST 程序正在运行时才会持续使用发送的数据。',
    'home.dialog.interaction.vision3': '程序下载、切换、停止或固件升级期间，视觉发送会暂停或清除；恢复运行后会重新发送最新结果，不沿用已经过期的目标。',
    'home.dialog.interaction.troubleshootTitle': '常见问题',
    'home.dialog.interaction.troubleshoot1': '一直未连接：确认线材支持数据传输，换一个 USB 端口，并关闭可能占用设备的其他软件。',
    'home.dialog.interaction.troubleshoot2': '下载中断：重新连接 EST，等待状态恢复后再次下载；中断不会主动删除槽位中的旧程序。',
    'home.dialog.interaction.troubleshoot3': '程序行为与预期不同：核对电机和传感器端口、数值单位、转向方向以及事件触发条件。',
    'home.dialog.hardware.title': '硬件说明',
    'home.dialog.hardware.lead': 'EST Studio 面向一台电脑连接一台 EST 的使用场景。积木中的端口必须与实物接线一致。',
    'home.dialog.hardware.controllerTitle': 'EST 主控',
    'home.dialog.hardware.controller1': 'USB 用于设备通信和程序传输。连接成功后，可在菜单栏查看连接状态。',
    'home.dialog.hardware.controller2': '硬件状态面板会显示连接、电量、固件版本和已识别的外设信息。',
    'home.dialog.hardware.controller3': '主控自带按键、显示、状态灯和声音输出，可直接使用对应积木控制。',
    'home.dialog.hardware.hostHomeTitle': '主机屏幕与按键',
    'home.dialog.hardware.hostHomeImageAlt': 'EST 主机屏幕的最近程序首页示意',
    'home.dialog.hardware.hostImageCaption': '固件渲染的主机屏幕示意；程序名和读数为示例，实际界面可能随固件版本及设备状态变化。',
    'home.dialog.hardware.hostHome1':
        '主机有返回、左、上、下、右、确认六个按键。在首页按左或上选前一项，按右或下选后一项，按确认打开所选功能。' +
        '首页共有“最近程序”“程序”“端口查看”“红外遥控”“马达输出”“设置”六项。',
    'home.dialog.hardware.hostHome2': '屏幕上方显示电量，下方可看到 USB 连接状态及当前菜单位置。左右切换首页项目时，图标会滚动显示。',
    'home.dialog.hardware.hostHome3': '在首页短按返回，会出现关机确认；再次按返回取消，按确认关机。进入子页面后，短按返回通常回到上一层或首页。',
    'home.dialog.hardware.hostHome4': '在主机菜单中长按返回约 1 秒会执行紧急停止并回到首页。USB 程序传输时屏幕会显示进度，传输结束前按键操作暂不可用。',
    'home.dialog.hardware.hostProgramsTitle': '最近程序与程序列表',
    'home.dialog.hardware.hostProgramsImageAlt': 'EST 主机程序列表界面示意',
    'home.dialog.hardware.hostPrograms1': '首页选“最近程序”并按确认，可快速运行上次使用的程序；没有最近程序时不会启动。',
    'home.dialog.hardware.hostPrograms2': '首页选“程序”并按确认进入列表。这里显示已保存的程序槽位（0–7）；按上、下选择，按确认运行。运行中按返回可停止程序。',
    'home.dialog.hardware.hostPrograms3': '选中程序后按右键会打开删除确认。默认是取消；按左或右切换到删除，再按确认才会删除。删除后该槽位的程序无法从主机恢复，请先核对名称与槽位。',
    'home.dialog.hardware.hostPrograms4': '电量过低时主机可能阻止启动程序并提示充电；程序执行出错时按屏幕提示查看错误信息，按返回退出错误页。',
    'home.dialog.hardware.hostPortsTitle': '端口查看与传感器模式',
    'home.dialog.hardware.hostPortsImageAlt': 'EST 主机端口查看界面示意',
    'home.dialog.hardware.hostPorts1': '首页选“端口查看”。按左、右在 A、B、C、D 马达端口和 1、2、3、4 传感器端口间循环选择；按返回回首页。',
    'home.dialog.hardware.hostPorts2': '马达页显示已识别的类型、停止或运行状态、速度与角度。传感器页显示类型、当前模式和实时读数；这里用于查看，不会驱动马达。',
    'home.dialog.hardware.hostPorts3':
        '选中支持切换模式的传感器端口后，按确认依次切换：颜色（反射光／环境光／颜色）、超声波（厘米／英寸／存在检测）、' +
        '红外（接近／信标／遥控）、陀螺仪（角度／角速度）、温度（摄氏／华氏）。触碰等无多模式的传感器按确认不会切换。',
    'home.dialog.hardware.hostRemoteTitle': '红外遥控',
    'home.dialog.hardware.hostRemote1': '先把红外传感器接到 4 号端口，并连接要控制的两个马达。首页进入“红外遥控”后，主机使用遥控器第 1 通道接收指令。',
    'home.dialog.hardware.hostRemote2': '默认控制 B、C 两个马达；按确认可切换到 A、D。切换时会先制动所有马达。遥控输出可达到 100% 功率，测试前请让轮子离地并清空运动范围。',
    'home.dialog.hardware.hostRemote3': '按返回退出遥控并制动马达；传感器或马达断开、遥控信号丢失时，主机也会停止输出并显示故障提示。',
    'home.dialog.hardware.hostMotorTitle': '马达输出（主机手动控制）',
    'home.dialog.hardware.hostMotor1': '首页进入“马达输出”时，A–D 马达初始均为停止，输出功率从 25% 开始。',
    'home.dialog.hardware.hostMotor2': '上键对应 A、左键对应 B、右键对应 C、下键对应 D。每按一次对应按键，该端口依次在“停止 → 正转 → 反转 → 停止”之间切换。',
    'home.dialog.hardware.hostMotor3': '按确认在 25%、50%、75%、100% 四档功率之间循环切换，已运行的马达会立即采用新档位。',
    'home.dialog.hardware.hostMotor4': '短按返回离开此页时，所有马达都会制动；再次进入此页时会重置为停止和 25%。',
    'home.dialog.hardware.hostMotorNote': '这里是切换式控制，不是“按住运行、松手停止”：按键松开后马达仍会保持当前方向。调试前请固定机器人或让轮子离地；需要立即停止时长按返回约 1 秒。',
    'home.dialog.hardware.hostSettingsTitle': '设置、设备信息与关机',
    'home.dialog.hardware.hostSettingsImageAlt': 'EST 主机设置界面示意',
    'home.dialog.hardware.hostSettings1':
        '首页进入“设置”。按上、下选择“背光”“音量”“语言”“设备信息”；背光用左、右在 10%–100% 间以 10% 调节，' +
        '音量在 0%–100% 间以 10% 调节。',
    'home.dialog.hardware.hostSettings2':
        '选“语言”后按左、右切换中文、英语、葡萄牙语（巴西）；选“设备信息”后按确认，可查看型号、固件、引导程序、' +
        'USB 和电池信息。按返回先退回设置，再按返回回首页。',
    'home.dialog.hardware.hostSettings3': '背光、音量与语言设置会在设备上保存。主机菜单没有固件升级入口；升级或降级请在电脑端 EST Studio 的“硬件状态”中完成，步骤见下文。',
    'home.dialog.hardware.outputTitle': '电机与输出',
    'home.dialog.hardware.output1': '电机使用 A、B、C、D 端口。控制单个电机时，在积木中选择它实际连接的端口。',
    'home.dialog.hardware.output2': '移动类积木同时控制左右两个电机。使用前先设置左右电机端口，并核对安装方向。',
    'home.dialog.hardware.output3': '速度和功率通常使用百分比；圈数、角度和秒数决定有期限运行的停止时机。',
    'home.dialog.hardware.sensorTitle': '传感器与输入',
    'home.dialog.hardware.sensor1': '外接传感器使用 1、2、3、4 端口；积木中的端口号要与接线位置相同。',
    'home.dialog.hardware.sensor2': '颜色传感器可读取反射光、环境光和颜色，适合巡线、颜色识别和亮度判断。',
    'home.dialog.hardware.sensor3': '触碰、超声波和红外传感器分别用于碰撞触发、距离测量和近程或信标检测。',
    'home.dialog.hardware.sensor4': '陀螺仪用于角度与角速度，温度传感器用于温度读取；主控按键和计时器无需外接端口。',
    'home.dialog.hardware.sensor5': '电脑摄像头可作为虚拟视觉输入，不连接 1–4 端口；它需要单独打开摄像头窗口，并使用支持视觉输入的 EST 固件。',
    'home.dialog.hardware.firmwareTitle': '固件升级与降级流程',
    'home.dialog.hardware.firmware1': '保存当前项目，使用 USB 将 EST 连接电脑并保持稳定供电；开始前先停止正在运行的程序。',
    'home.dialog.hardware.firmware2': '进入编辑器，打开菜单栏的“硬件状态”，确认设备已经连接，并查看当前“固件版本”。',
    'home.dialog.hardware.firmware3': '点击“固件更新”：日常更新选择“升级 EST OS”；只有需要兼容旧版项目时才选择“降级旧 EST 系统”。',
    'home.dialog.hardware.firmware4': '阅读确认提示，核对目标后点击“继续”。软件会先释放普通设备连接，再开始写入固件。',
    'home.dialog.hardware.firmware5': '等待“正在更新固件”结束。升级 EST OS 后若出现“正在同步音效资源”，请继续等待，这是同一次更新的第二阶段。',
    'home.dialog.hardware.firmware6': '成功弹窗会显示目标版本、升级包路径和 SHA-256；关闭弹窗后，硬件状态会自动刷新。',
    'home.dialog.hardware.firmware7': '若更新失败，请按错误详情检查 USB、供电和本机 Python 环境，重新连接 EST 后再试；重复失败时记录错误详情、软件版本和原固件版本。',
    'home.dialog.hardware.firmwareNote': '写入固件和同步音效资源期间，请勿拔出 USB、关闭软件、断电或操作设备；此时连接、运行、停止和下载功能会暂时不可用。',
    'home.dialog.hardware.careTitle': '连接与使用注意',
    'home.dialog.hardware.care1': '插拔线材时握住插头，确认接口方向，不要拉扯线缆或强行插入。',
    'home.dialog.hardware.care2': '调整机械结构、轮组或电机接线前先停止程序，避免机构突然运动。',
    'home.dialog.hardware.care3': '读数异常时先检查端口、插头和线材，再在硬件状态面板确认设备是否被识别。',
    'home.dialog.hardware.careNote': '固件更新时请保持 EST 供电并持续连接 USB；更新完成前不要关闭软件。',
    'home.dialog.blocks.title': '积木块功能说明',
    'home.dialog.blocks.lead': '以下内容按照当前工具箱顺序，逐一说明 EST 积木、运算、变量、列表和“我的模块”的实际功能。',
    'home.dialog.blocks.startTitle': '搭建第一段程序',
    'home.dialog.blocks.start1': '从“事件”拖出“当程序启动时”，用它作为一段程序的起点。',
    'home.dialog.blocks.start2': '在下方连接电机、移动、显示或播放等动作积木。',
    'home.dialog.blocks.start3': '把传感器或运算积木放入数值、条件等输入位置，按需要加入等待、重复或判断。',
    'home.dialog.blocks.start4': '查看右侧 Python 代码，选择程序槽位后下载或运行。',
    'home.dialog.blocks.categoryTitle': '11 类积木速查',
    'home.dialog.blocks.category1': '电机：控制 A–D 中的单个电机，设置方向、速度、功率、运行量和停止方式，也可读取角度与速度。',
    'home.dialog.blocks.category2': '移动：把两个电机作为左右轮组控制，完成直行、转向、双电机差速和巡线。',
    'home.dialog.blocks.category3': '显示：在主控屏幕显示图像或文字，清除画面，并设置状态灯。',
    'home.dialog.blocks.category4': '播放：播放音效或钢琴音符，设置音量，也可以停止全部声音。',
    'home.dialog.blocks.category5': '事件：在程序启动、主控按键、条件、广播或计时器满足时启动程序堆。',
    'home.dialog.blocks.category6': '控制：等待、重复、永久循环、条件判断，以及停止当前或其他程序堆。',
    'home.dialog.blocks.category7': '传感器：读取主控按键、颜色、温度、触碰、超声波、红外、陀螺仪和计时器。',
    'home.dialog.blocks.category8': '运算：进行算术、比较、逻辑、随机数和文本组合，为控制和传感器判断提供条件。',
    'home.dialog.blocks.category9': '视觉：读取左手、右手、人体和面部的有效状态、类别、动作、位置与大小，并等待指定视觉条件。',
    'home.dialog.blocks.category10': '变量与列表：保存和修改数值或文字，批量管理列表项目，并把数据用于条件、运算和输出。',
    'home.dialog.blocks.category11': '我的模块：把一组逻辑封装成可重复调用的模块，并按需添加数值、文字或真假参数。',
    'home.dialog.blocks.inputTitle': '读懂输入与形状',
    'home.dialog.blocks.input1': '白色数值框可直接输入，也可以放入变量、传感器读数或运算结果。',
    'home.dialog.blocks.input2': '电机端口、移动端口和事件传感器端口既可使用下拉选项，也可放入原生变量。',
    'home.dialog.blocks.input3': '圆角积木返回数值或文字，尖角积木返回真/假；只有形状相配的积木才能放入对应位置。',
    'home.dialog.blocks.patternTitle': '推荐的程序结构',
    'home.dialog.blocks.pattern1': '一次动作：程序启动 → 设置参数 → 执行动作 → 停止或结束。',
    'home.dialog.blocks.pattern2': '持续控制：程序启动 → 重复执行 → 读取传感器 → 判断 → 控制电机或输出。',
    'home.dialog.blocks.pattern3': '多个任务：使用多个事件程序堆或广播拆分任务，并明确每个任务何时停止。',
    'home.dialog.blocks.patternNote': '先用低速度和短运行时间测试方向与端口，确认无误后再提高速度或加入循环。',
    'home.blockGuide.category.operators': '运算',
    'home.blockGuide.category.variables': '变量与列表',
    'home.blockGuide.category.myBlocks': '我的模块',
    'home.blockGuide.modesTitle': '模式与参数',
    'home.blockGuide.previewLoading': '正在生成积木图片',
    'home.blockGuide.previewUnavailable': '积木图片暂不可用',
    'home.blockGuide.mode.motor.ports': '输出端口｜A、B、C、D；应选择电机实际连接的端口。',
    'home.blockGuide.mode.motor.direction': '方向｜顺时针或逆时针；方向以面对电机输出轴时的旋转方向为准。',
    'home.blockGuide.mode.motor.amount': '运行量｜可按圈、度或秒运行；圈和度控制转角，秒控制持续时间。',
    'home.blockGuide.mode.motor.speedPower':
        '速度与功率｜速度模式控制目标转速，功率模式直接控制输出强度；正负值也会影响转向。',
    'home.blockGuide.mode.motor.stop': '停止方式｜“保持位置”会主动锁住当前位置；“惯性滑行”会释放电机自然停下。',
    'home.blockGuide.mode.motor.feedback':
        '反馈｜可读取累计角度、当前速度和堵转状态；累计角度可在任意机械基准位置重置为零。',
    'home.blockGuide.mode.movement.pair': '电机组｜先指定左、右驱动电机端口；移动类积木会同时控制这两个电机。',
    'home.blockGuide.mode.movement.direction': '直行方向｜前进或后退；实际方向还取决于左右电机的安装朝向。',
    'home.blockGuide.mode.movement.steering':
        '转向｜0 表示直行，负值向一侧转、正值向另一侧转，绝对值越大转弯越急。',
    'home.blockGuide.mode.movement.amount': '运行量｜支持圈、度和秒三种模式，与单电机运行量的含义相同。',
    'home.blockGuide.mode.movement.speed':
        '速度｜可统一设置移动速度，也可分别设置左右速度；不同速度或相反符号可形成差速与原地转向。',
    'home.blockGuide.mode.movement.stop': '停止方式｜移动结束时可选择保持左右轮位置，或让左右轮惯性滑行。',
    'home.blockGuide.mode.movement.lineFollow':
        '双输入 PWM 巡线｜先初始化，再在循环中输入左右传感值、左右基础功率、Kp 与 Kd；Kp 修正当前偏差，Kd 抑制变化过快。',
    'home.blockGuide.mode.display.image': '图像｜可从表情和眼睛图像库选择；可持续显示，也可按秒显示后继续。',
    'home.blockGuide.mode.display.text': '文字位置｜可按屏幕行快速排版，或使用 X、Y 坐标精确放置。',
    'home.blockGuide.mode.display.font': '字体｜常规、粗体或大号，并分别提供黑色字和白色字。',
    'home.blockGuide.mode.display.light': '状态灯｜支持关闭、红色和蓝色。',
    'home.blockGuide.mode.sound.playback':
        '播放方式｜“播放直到完成”会等待音效结束；“开始播放”会立即继续执行后续积木。',
    'home.blockGuide.mode.sound.note':
        '音符｜从钢琴音高范围选择，可按秒播放后停止，也可持续播放到被新声音替换或手动停止。',
    'home.blockGuide.mode.sound.volume': '音量｜用百分比设置后续音效和音符的播放音量。',
    'home.blockGuide.mode.event.start': '启动方式｜程序启动、条件变为真、主控按键变化或计时器超过阈值时均可启动程序堆。',
    'home.blockGuide.mode.event.button': '按键事件｜可选择左、确认、右、上、下键的按下或松开。',
    'home.blockGuide.mode.event.broadcast':
        '广播｜提供消息1至消息8；可只发送后继续，也可等待由该消息启动的程序堆完成。',
    'home.blockGuide.mode.event.timer': '计时事件｜当程序计时器经过的秒数超过设定值时触发。',
    'home.blockGuide.mode.control.wait': '等待｜可等待指定秒数，也可等待一个真假条件成立。',
    'home.blockGuide.mode.control.loop': '循环｜可重复指定次数、永久重复，或重复到条件成立。',
    'home.blockGuide.mode.control.branch': '分支｜支持单独的“如果”以及带“否则”的双分支。',
    'home.blockGuide.mode.control.stop': '停止范围｜可停止其他程序堆、当前程序堆，或退出整个用户程序。',
    'home.blockGuide.mode.sensing.ports': '传感器端口｜1、2、3、4；每个读取或等待积木都要对应传感器实际连接的端口。',
    'home.blockGuide.mode.sensing.button':
        '主控按键｜状态读取覆盖无按键、返回、左、确认、右、上、下；等待模式支持左、确认、右、上、下的按下或松开。',
    'home.blockGuide.mode.sensing.colorLight':
        '颜色传感器—光线模式｜反射光测量传感器自身光源的反射强度，环境光测量周围光线；两者都可读取数值或与阈值比较。',
    'home.blockGuide.mode.sensing.color':
        '颜色传感器—颜色模式｜可识别无色、黑、蓝、绿、黄、红、白、棕；等待模式还可选择“颜色已改变”。',
    'home.blockGuide.mode.sensing.compare': '比较条件｜所有比较型传感器积木均支持小于、大于和等于。',
    'home.blockGuide.mode.sensing.temperature': '温度传感器｜可读取摄氏温度或华氏温度。',
    'home.blockGuide.mode.sensing.touch': '触碰传感器｜可立即判断是否按下，或等待按下／松开事件。',
    'home.blockGuide.mode.sensing.ultrasonic':
        '超声波传感器｜以厘米或英寸读取距离；也可比较距离，或等待距离满足小于、大于、等于条件。',
    'home.blockGuide.mode.sensing.infrared':
        '红外传感器—近程模式｜读取目标的相对接近程度；可直接读取、比较阈值或等待阈值条件成立。',
    'home.blockGuide.mode.sensing.beacon':
        '红外传感器—信标模式｜使用固定频道1，可等待左上、左下、右上、右下按键，左右侧按键松开，或信标处于活动状态。',
    'home.blockGuide.mode.sensing.gyro':
        '陀螺仪｜角度模式读取相对转角，角速度模式读取当前旋转速度；可重置零点、比较角度或等待角度达到条件。',
    'home.blockGuide.mode.sensing.timer': '计时器｜读取从上次重置后经过的秒数；重置会立即归零并重新计时。',
    'home.blockGuide.mode.operators.arithmetic': '数值运算｜加、减、乘、除、随机数、取模、四舍五入和数学函数。',
    'home.blockGuide.mode.operators.logic': '比较与逻辑｜大于、小于、等于，以及“且”“或”“不”。',
    'home.blockGuide.mode.operators.text': '文字运算｜连接文字、取第几个字符、求长度和判断是否包含。',
    'home.blockGuide.mode.variables.scalar': '变量｜读取数值或文字，并可设置新值或按数值增量改变。',
    'home.blockGuide.mode.variables.list': '列表｜支持添加、删除、插入、替换、按序号读取、查找序号、求长度和包含判断。',
    'home.blockGuide.mode.myBlocks.definition': '定义｜创建一段可复用的自定义流程，并可配置名称和参数。',
    'home.blockGuide.mode.myBlocks.call': '调用｜在程序中的任意需要位置运行已经定义的自定义积木。',
    'home.blockGuide.motor_run_for': '按指定量运行电机｜让所选端口的电机按指定方向运行若干圈、角度或秒数，动作完成后再继续执行。',
    'home.blockGuide.motor_start': '启动电机｜让所选端口的电机按指定方向持续转动，直到遇到停止电机或程序结束。',
    'home.blockGuide.motor_stop': '停止电机｜停止所选端口的电机，并使用当前设置的保持位置或惯性滑行方式。',
    'home.blockGuide.motor_set_speed': '设置电机速度｜设置所选电机后续动作使用的默认速度百分比。',
    'home.blockGuide.motor_set_stop_action': '设置电机停止方式｜选择电机停止时保持当前位置，或释放电机让它惯性滑行。',
    'home.blockGuide.motor_run_for_speed': '按速度运行指定量｜让电机以给定速度运行若干圈、角度或秒数，完成后继续执行。',
    'home.blockGuide.motor_start_speed': '按速度启动电机｜让电机以给定速度持续转动，不等待电机停止。',
    'home.blockGuide.motor_start_power': '按功率启动电机｜直接设置电机输出功率并持续转动，适合需要直接控制输出的场景。',
    'home.blockGuide.motor_reset_degrees': '重置电机角度｜把所选电机当前累计角度设为零，便于从当前位置重新测量。',
    'home.blockGuide.motor_degrees': '电机运转度数｜返回所选电机相对上次重置位置累计转过的角度。',
    'home.blockGuide.motor_speed': '电机速度｜返回所选电机当前测得的转动速度。',
    'home.blockGuide.motor_stalled': '电机是否堵转｜判断所选电机是否因受阻而无法按要求转动，返回真或假。',
    'home.blockGuide.drive_move_for': '按指定量直行｜让当前左右电机组向前或向后运行若干圈、角度或秒数。',
    'home.blockGuide.drive_steer_for': '按指定量转向｜按照转向值控制左右电机差速，并运行指定圈数、角度或时间。',
    'home.blockGuide.drive_start_steer': '开始转向移动｜按照转向值让左右电机持续运动，直到使用停止运动积木。',
    'home.blockGuide.drive_stop': '停止运动｜同时停止当前设置的左右两个移动电机。',
    'home.blockGuide.drive_set_speed': '设置移动速度｜设置后续移动积木默认使用的速度百分比。',
    'home.blockGuide.drive_set_pair': '设置左右电机｜指定移动类积木使用的左电机端口和右电机端口。',
    'home.blockGuide.drive_set_stop_action': '设置移动停止方式｜选择移动结束时保持电机位置，或让两个电机惯性滑行。',
    'home.blockGuide.drive_steer_for_speed': '按速度转向指定量｜以给定速度和转向值移动指定圈数、角度或时间。',
    'home.blockGuide.drive_dual_speed_for': '双电机按速度运行｜分别设置左、右电机速度，并运行指定圈数、角度或时间。',
    'home.blockGuide.drive_start_steer_speed': '按速度开始转向｜以给定速度和转向值持续驱动左右电机。',
    'home.blockGuide.drive_start_dual_speed': '按双速度开始移动｜分别设置左右电机速度并持续运行，可用于原地转向或差速运动。',
    'home.blockGuide.drive_line_follow_init': '初始化 PWM 巡线｜清除巡线控制器保存的上一次误差，应在开始巡线循环前执行一次。',
    'home.blockGuide.drive_line_follow_dual_step': '执行一次双输入 PWM 巡线｜根据左右输入、基础功率、Kp 和 Kd 计算并更新一次左右电机输出，通常放在循环中。',
    'home.blockGuide.display_image_for': '显示图像指定时间｜在主控屏幕显示所选图像并保持指定秒数，然后继续程序。',
    'home.blockGuide.display_image': '显示图像｜立即在主控屏幕显示所选图像，画面保持到下一次显示或清除。',
    'home.blockGuide.display_draw': '绘制自定义图形｜在 180 × 128 黑白画板中绘图，并把图形显示到主控屏幕。',
    'home.blockGuide.display_text_line': '按行显示文字｜把文字写到主控屏幕指定行，适合快速排列多行信息。',
    'home.blockGuide.display_text_xy': '按坐标显示文字｜使用所选字体，在主控屏幕给定 X、Y 坐标处写入文字。',
    'home.blockGuide.display_clear': '清除显示｜清空主控屏幕上的图像和文字。',
    'home.blockGuide.display_status_light': '设置状态灯｜把主控状态灯设为关闭、红色或蓝色。',
    'home.blockGuide.sound_play_wait': '播放声音直到完成｜播放所选音效，并等待音效结束后再执行下一块积木。',
    'home.blockGuide.sound_play': '开始播放声音｜开始播放所选音效后立即继续程序，不等待播放结束。',
    'home.blockGuide.sound_beep_for': '播放音符指定时间｜播放所选钢琴音符并保持指定秒数，随后停止声音。',
    'home.blockGuide.sound_beep': '开始播放音符｜开始播放所选钢琴音符后立即继续，直到另一声音替换或停止全部声音。',
    'home.blockGuide.sound_stop_all': '停止全部声音｜立即停止主控当前播放的音效或音符。',
    'home.blockGuide.sound_set_volume': '设置音量｜设置后续声音使用的音量百分比。',
    'home.blockGuide.event_program_start': '当程序启动时｜下载并运行程序后，从这个积木下面开始执行一条程序堆。',
    'home.blockGuide.event_brick_button': '当主控按键变化时｜当指定主控按键被按下或松开时，启动下面的程序堆。',
    'home.blockGuide.event_condition': '当条件成立时｜监测一个真假条件，并在条件变为真时启动下面的程序堆。',
    'home.blockGuide.event_broadcast_received': '当接收到广播时｜收到指定消息后启动下面的程序堆，用于协调多个任务。',
    'home.blockGuide.event_broadcast': '发送广播｜发送指定消息并立即继续，不等待接收消息的程序堆完成。',
    'home.blockGuide.event_broadcast_wait': '发送广播并等待｜发送指定消息，等待由该消息启动的程序堆完成后再继续。',
    'home.blockGuide.event_timer': '当计时器超过指定值时｜当程序计时器大于给定秒数时，启动下面的程序堆。',
    'home.blockGuide.control_wait_seconds': '等待指定秒数｜暂停当前程序堆一段时间，其他程序堆仍可继续运行。',
    'home.blockGuide.control_wait_until': '等待直到条件成立｜暂停当前程序堆并持续检查条件，条件为真后继续。',
    'home.blockGuide.control_repeat': '重复指定次数｜把内部积木按给定次数依次执行。',
    'home.blockGuide.control_forever': '重复执行｜持续重复内部积木，直到程序堆或整个程序被停止。',
    'home.blockGuide.control_repeat_until': '重复直到条件成立｜条件为假时反复执行内部积木，条件变为真后离开循环。',
    'home.blockGuide.control_if': '如果条件成立｜只有条件为真时才执行内部积木。',
    'home.blockGuide.control_if_else': '如果／否则｜条件为真时执行第一组积木，否则执行第二组积木。',
    'home.blockGuide.control_stop_other_stacks': '停止其他程序堆｜停止当前项目中除本程序堆之外正在运行的其他程序堆。',
    'home.blockGuide.control_stop': '停止程序堆或全部程序｜根据选项停止当前程序堆或整个用户程序。',
    'home.blockGuide.sensor_brick_button_value': '主控按钮值｜返回当前主控按键状态对应的数值。',
    'home.blockGuide.sensor_brick_button_pressed': '主控按键是否按下｜判断指定主控按键当前是否处于按下状态，返回真或假。',
    'home.blockGuide.sensor_wait_brick_button': '等待主控按键｜暂停当前程序堆，直到指定主控按键被按下或松开。',
    'home.blockGuide.sensor_color_reflection': '反射光强度｜返回指定端口颜色传感器测得的反射光强度百分比。',
    'home.blockGuide.sensor_color_reflection_compare': '比较反射光强度｜把反射光强度与给定百分比比较，返回真或假。',
    'home.blockGuide.sensor_color_ambient': '环境光强度｜返回指定端口颜色传感器测得的环境光强度。',
    'home.blockGuide.sensor_color_ambient_compare': '比较环境光强度｜把环境光强度与给定百分比比较，返回真或假。',
    'home.blockGuide.sensor_color_value': '读取颜色｜返回指定端口颜色传感器识别到的颜色值。',
    'home.blockGuide.sensor_color_is': '是否为指定颜色｜判断颜色传感器当前识别结果是否等于所选颜色。',
    'home.blockGuide.sensor_wait_color': '等待颜色事件｜暂停当前程序堆，直到颜色传感器识别到所选颜色或发生指定变化。',
    'home.blockGuide.sensor_temperature': '读取温度｜返回指定端口温度传感器的摄氏或华氏温度。',
    'home.blockGuide.sensor_touch_pressed': '触碰传感器是否按下｜判断指定端口触碰传感器当前是否被按下。',
    'home.blockGuide.sensor_wait_touch': '等待触碰事件｜暂停当前程序堆，直到触碰传感器被按下或松开。',
    'home.blockGuide.sensor_ultrasonic_distance': '读取超声波距离｜返回指定端口超声波传感器测得的距离，并使用所选单位。',
    'home.blockGuide.sensor_ultrasonic_compare': '比较超声波距离｜把测得距离与给定数值比较，返回真或假。',
    'home.blockGuide.sensor_wait_ultrasonic': '等待超声波距离｜暂停当前程序堆，直到距离满足给定比较条件。',
    'home.blockGuide.sensor_ir_proximity': '读取红外近程值｜返回指定端口红外传感器测得的相对接近程度。',
    'home.blockGuide.sensor_ir_proximity_compare': '比较红外近程值｜把红外近程值与给定百分比比较，返回真或假。',
    'home.blockGuide.sensor_wait_ir_proximity': '等待红外近程条件｜暂停当前程序堆，直到红外近程值满足比较条件。',
    'home.blockGuide.sensor_wait_ir_beacon_button': '等待红外信标按键｜等待 1 频道红外信标发生所选按键事件。',
    'home.blockGuide.sensor_gyro_angle': '读取陀螺仪角度｜返回指定端口陀螺仪相对重置位置测得的角度。',
    'home.blockGuide.sensor_gyro_rate': '读取陀螺仪角速度｜返回指定端口陀螺仪当前测得的转动速度。',
    'home.blockGuide.sensor_gyro_reset': '重置陀螺仪角度｜把指定端口陀螺仪的当前方向设为零度。',
    'home.blockGuide.sensor_gyro_compare': '比较陀螺仪角度｜把当前角度与给定角度比较，返回真或假。',
    'home.blockGuide.sensor_wait_gyro': '等待陀螺仪角度｜暂停当前程序堆，直到角度满足给定比较条件。',
    'home.blockGuide.sensor_timer': '计时器｜返回程序计时器从上次重置后经过的秒数。',
    'home.blockGuide.sensor_timer_reset': '重置计时器｜把程序计时器归零并从当前位置重新计时。',
    'home.blockGuide.operator_add': '加法｜返回两个输入数值相加的结果。',
    'home.blockGuide.operator_subtract': '减法｜返回第一个数减去第二个数的结果。',
    'home.blockGuide.operator_multiply': '乘法｜返回两个输入数值相乘的结果。',
    'home.blockGuide.operator_divide': '除法｜返回第一个数除以第二个数的结果。',
    'home.blockGuide.operator_random': '随机数｜返回给定起点和终点之间的一个随机数。',
    'home.blockGuide.operator_gt': '大于｜判断左侧数值是否大于右侧数值。',
    'home.blockGuide.operator_lt': '小于｜判断左侧数值是否小于右侧数值。',
    'home.blockGuide.operator_equals': '等于｜判断两个输入的数值或文字是否相等。',
    'home.blockGuide.operator_and': '并且｜只有两个条件都为真时才返回真。',
    'home.blockGuide.operator_or': '或者｜只要两个条件中至少一个为真就返回真。',
    'home.blockGuide.operator_not': '不成立｜把输入条件的真假结果反转。',
    'home.blockGuide.operator_join': '连接文字｜按顺序把两段文字合并成一段。',
    'home.blockGuide.operator_letter_of': '取第几个字符｜返回一段文字中指定位置的字符。',
    'home.blockGuide.operator_length': '文字长度｜返回输入文字包含的字符数量。',
    'home.blockGuide.operator_contains': '是否包含文字｜判断第一段文字中是否包含第二段文字。',
    'home.blockGuide.operator_mod': '除法余数｜返回第一个数除以第二个数后的余数。',
    'home.blockGuide.operator_round': '四舍五入｜把输入数值取整为最接近的整数。',
    'home.blockGuide.operator_mathop': '数学函数｜对输入数值执行所选数学函数，例如绝对值、平方根或三角函数。',
    'home.blockGuide.data_variable': '变量值｜返回所选变量当前保存的值，可放入数值、文字或端口输入。',
    'home.blockGuide.data_setvariableto': '将变量设为｜把所选变量直接改为给定的值。',
    'home.blockGuide.data_changevariableby': '变量增加｜在所选变量当前数值基础上增加给定数值。',
    'home.blockGuide.data_listcontents': '列表内容｜返回所选列表当前保存的全部项目。',
    'home.blockGuide.data_addtolist': '添加到列表｜把一个新项目追加到所选列表末尾。',
    'home.blockGuide.data_deleteoflist': '删除列表项目｜删除所选列表中指定位置的一个项目。',
    'home.blockGuide.data_deletealloflist': '删除列表全部项目｜清空所选列表。',
    'home.blockGuide.data_insertatlist': '插入列表项目｜在所选列表指定位置插入一个新项目。',
    'home.blockGuide.data_replaceitemoflist': '替换列表项目｜把所选列表指定位置的项目改为新内容。',
    'home.blockGuide.data_itemoflist': '读取列表项目｜返回所选列表指定位置的项目。',
    'home.blockGuide.data_itemnumoflist': '查找项目位置｜返回指定内容第一次出现在列表中的位置。',
    'home.blockGuide.data_lengthoflist': '列表长度｜返回所选列表当前包含的项目数量。',
    'home.blockGuide.data_listcontainsitem': '列表是否包含项目｜判断所选列表中是否存在给定内容。',
    'home.blockGuide.procedures_definition': '定义我的模块｜为一组可重复使用的积木命名，并可以添加数值、文字或真假参数。',
    'home.blockGuide.procedures_call': '调用我的模块｜执行已经定义的“我的模块”，并把当前输入值传给它的参数。',
    'home.dialog.ai.title': 'AI 编程助手',
    'home.dialog.ai.lead': 'AI 编程助手可以把自然语言需求转换为经过本地规则校验的 EST 积木程序，并先生成真实积木预览；是否插入、替换、下载或运行始终由您决定。',
    'home.dialog.ai.openTitle': '打开并认识面板',
    'home.dialog.ai.openImageAlt': 'EST Studio 的 AI 编程助手空白界面',
    'home.dialog.ai.openImageCaption': 'AI 编程助手以浮动面板显示，不会覆盖或自动修改当前工作区。',
    'home.dialog.ai.open1': '返回编辑器，在菜单栏点击“AI 编程助手”打开右侧浮动面板；拖动标题栏可以移动面板。',
    'home.dialog.ai.open2': '关闭面板后当前对话仍会保留；右上角的“新建对话”会清空本次会话，适合开始另一个任务或在对话过长时重新开始。',
    'home.dialog.ai.open3': '在输入框按 Enter 发送，按 Shift+Enter 换行；生成期间发送按钮会变成停止按钮，可取消当前请求。',
    'home.dialog.ai.setupTitle': '连接 AI 服务',
    'home.dialog.ai.setupImageAlt': 'AI 编程助手的 API 设置界面',
    'home.dialog.ai.setupImageCaption': '图中的 example.com、test-model 和隐藏密钥仅为界面测试数据，请勿照抄。',
    'home.dialog.ai.setup1': '首次使用时，点击面板底部的“连接 AI 服务”，或点击右上角菜单按钮进入“API 设置”。',
    'home.dialog.ai.setup2': '可以选择 OpenAI、DeepSeek 或本机 Ollama 快捷预设，也可以选择“不使用预设”后手动填写；预设只负责填入建议字段，不会限制服务商。',
    'home.dialog.ai.setup3': '填写服务商提供的 API 地址和模型 ID。远程服务必须填写对应 API 密钥；本机回环地址上的 Ollama 等服务可以不填密钥。',
    'home.dialog.ai.setup4': '只有服务商和所选模型明确支持 JSON 模式时才开启“启用 JSON 模式”；遇到请求格式错误时可关闭后重试。',
    'home.dialog.ai.setup5': '点击“确定”保存。面板底部显示“已配置 · 服务商 / 模型”后，即可输入任务。更换 API 地址时必须输入新地址对应的密钥。',
    'home.dialog.ai.setupNote': 'API 地址必须使用 HTTPS；仅 localhost、127.0.0.1 或本机 IPv6 回环地址允许使用 HTTP。请确认地址可信。',
    'home.dialog.ai.promptTitle': '怎样描述任务',
    'home.dialog.ai.prompt1': '写清机器人要完成的目标，并尽量说明电机和传感器端口、左右轮角色、方向、速度、距离或时间单位、触发条件、阈值与停止方式。',
    'home.dialog.ai.prompt2':
        '复杂任务可以先让 AI 生成最小可运行部分，再通过后续对话逐步增加传感器或视觉判断、循环、变量、列表、' +
        '“我的模块”、自定义绘图、显示或声音；AI 会参考本次对话中上一版程序继续修改。',
    'home.dialog.ai.prompt3': '连接 EST 时，助手会读取一次 USB 端口快照并优先使用已检测到的设备；USB 无法知道哪个电机是左轮或右轮，这类机械角色仍需在描述中写明。',
    'home.dialog.ai.prompt4': '未连接 EST 也可以对话和生成程序，但您需要自行核对所有端口、硬件型号和安装方向。',
    'home.dialog.ai.applyTitle': '生成、预览与应用',
    'home.dialog.ai.applyImageAlt': 'AI 生成 EST 积木并显示预览和应用按钮',
    'home.dialog.ai.applyImageCaption': '生成结果先显示为真实积木预览；“替换工作区”和“插入”都必须由您手动选择。',
    'home.dialog.ai.apply1': 'AI 可能先回答问题或追问缺少的信息；只有形成明确程序方案时，回复中才会出现“生成的积木堆”。',
    'home.dialog.ai.apply2': '软件会在本机校验积木类型、输入、端口和程序结构，再绘制预览；校验不通过的结果不会直接放入工作区。',
    'home.dialog.ai.apply3': '检查预览中的端口、方向、速度、单位、阈值、循环和停止逻辑，并阅读“程序有以下提醒”；不合适时继续对话修改。',
    'home.dialog.ai.apply4': '“插入”会把程序堆追加到现有工作区；“替换工作区”会先要求确认，再用生成程序替换当前积木。两种操作都可以通过撤销恢复。',
    'home.dialog.ai.apply5': '应用成功只代表积木已经进入工作区。AI 不会自动下载或运行程序；请再次检查程序，然后使用编辑器的下载或运行按钮。',
    'home.dialog.ai.applyNote': '真机测试前请抬起轮组或留出安全空间，先使用低速度、短时间验证方向和停止逻辑。AI 生成内容始终需要人工检查。',
    'home.dialog.ai.scopeTitle': '当前支持范围',
    'home.dialog.ai.scope1': '可以生成当前 EST 工具箱中的事件、电机、移动、显示、声音、控制、传感器、视觉和运算类积木，并支持一个方案中的多个程序堆。',
    'home.dialog.ai.scope2': '可以创建和使用变量、列表与“我的模块”；“我的模块”支持数值、文字和真假参数，也可以生成主控 180 × 128 屏幕的自定义位图绘制数据。',
    'home.dialog.ai.scope3': '不会生成或执行任意 Python、XML 或 JavaScript，也不接受外部图片网址和未经允许的 Blockly 原始修改；超出积木能力的部分需要在工作区另行完成。',
    'home.dialog.ai.scope4': '单次候选程序最多包含 8 个程序堆、256 个积木，积木嵌套深度最多 24 层；超出时应把需求拆成较小步骤。',
    'home.dialog.ai.scope5': 'AI 会遵守软件提供的积木目录和数值规则，但仍可能误解自然语言、机械结构、视觉条件或教学意图，不能代替预览检查和真机验证。',
    'home.dialog.ai.privacyTitle': '数据、密钥与费用',
    'home.dialog.ai.privacy1': 'API 配置与密钥会加密保存在本机。密钥只用于您保存的 API 地址；更换地址时不会自动沿用旧密钥。',
    'home.dialog.ai.privacy2': '请求会把本次对话、所需积木规则，以及连接设备时的一份 USB 端口快照发送到您配置的 AI 地址；软件不会自动上传整个当前项目。',
    'home.dialog.ai.privacy3': '远程模型的联网条件、可用性、额度、计费和内容处理规则由所选服务商决定；本软件不会替您创建账户或购买额度。',
    'home.dialog.ai.privacyNote': '不要在任务描述中填写密码、API 密钥、个人信息或其他敏感内容。仅使用您信任并有权访问的 AI 服务。',
    'home.dialog.ai.troubleshootTitle': '常见问题',
    'home.dialog.ai.troubleshoot1': '无法发送：先确认面板底部显示“已配置”，并核对 API 地址、模型 ID 和密钥是否属于同一个服务。',
    'home.dialog.ai.troubleshoot2':
        '出现 400、404 或 503：检查模型 ID、API 地址和 JSON 模式；出现 401 或 403：检查密钥及权限；' +
        '出现 402 或 429：检查余额、额度或稍后重试。',
    'home.dialog.ai.troubleshoot3': '请求在 8 分钟内没有完成或提示网络中断：缩小任务范围后重试，并检查网络、本机 Ollama 服务或远程服务商状态。',
    'home.dialog.ai.troubleshoot4': '提示程序校验或积木预览失败：把任务拆小，明确端口和参数后重新生成；也可以点击错误旁的“检查连接设置”或“重试”。',
    'home.dialog.software.title': '软件信息',
    'home.dialog.software.lead': '当前版本：EST Studio {version}。这是一款面向 EST 的桌面图形化编程软件。',
    'home.dialog.software.fileTitle': '项目文件',
    'home.dialog.software.file1': 'EST Studio 项目使用 .ests 扩展名。保存项目后，可从“最近文件”再次打开。',
    'home.dialog.software.file2': '最近文件卡片支持打开、重命名和复制；“删除”只从最近列表移除记录，不会删除电脑中的项目文件。',
    'home.dialog.software.file3': '移动或删除电脑中的原始文件后，对应的最近文件记录可能无法再打开。',
    'home.dialog.software.workspaceTitle': '编程工作区',
    'home.dialog.software.workspace1': '编辑器固定使用 EST 上传模式，无需选择通用硬件或切换模拟、实时模式。',
    'home.dialog.software.workspace2': '积木区用于搭建逻辑；Python 代码区会同步显示当前工作区生成的代码。',
    'home.dialog.software.workspace3': '一个项目可以包含多个事件程序堆；生成代码会按程序堆组织执行。',
    'home.dialog.software.workspace4': '“视觉”是按项目添加的可选扩展，识别在独立摄像头窗口运行；AI 编程助手是可移动的浮动面板，两者都不会自动下载或运行程序。',
    'home.dialog.software.updateTitle': '版本与更新',
    'home.dialog.software.update1': '软件版本与 EST 固件版本是两项独立信息；遇到兼容提示时，需要确认两者是否匹配。',
    'home.dialog.software.update2': '在硬件状态中可以查看固件版本，并在提供更新包时执行固件更新。',
    'home.dialog.software.update3': '更换电脑或重新安装前，请单独备份重要的 .ests 项目文件。',
    'home.dialog.software.updateNote': '反馈问题时，请同时记录 EST Studio 版本、固件版本、连接状态和复现步骤。',
    'home.dialog.about.title': '关于我们',
    'home.dialog.about.lead': 'EST Studio 是为 EST 主控与配套外设设计的图形化编程环境，让搭建、编程和真机运行形成连续体验。',
    'home.dialog.about.purposeTitle': '我们希望解决什么',
    'home.dialog.about.purpose1': '让学习者不必先配置通用硬件，就能直接进入 EST 积木编程。',
    'home.dialog.about.purpose2': '让教师和学生能够在同一软件中完成项目管理、搭建参考、积木与 AI 辅助编程、视觉交互和设备运行。',
    'home.dialog.about.purpose3': '保留可查看的 Python 代码，帮助学习者从图形化逻辑逐步理解文本编程。',
    'home.dialog.about.foundationTitle': '技术与许可',
    'home.dialog.about.foundation2': '软件通过 USB 自动发现 EST，将积木转换为可在设备上运行的 Python 程序，并能在本机识别摄像头画面后发送结构化视觉数据。',
    'home.dialog.about.foundation3': '项目保留 MIT、Scratch Foundation 与相关商标许可文件；第三方名称与商标归各自权利人所有。',
    'home.dialog.about.supportTitle': '获取支持前的准备',
    'home.dialog.about.support1': '记录问题发生前的操作、界面提示，以及是否可以稳定复现。',
    'home.dialog.about.support2': '提供软件版本、EST 固件版本、Windows 版本和使用的外设类型。',
    'home.dialog.about.support3': '涉及项目内容时，保留一份可复现问题的 .ests 文件，并移除不需要分享的个人信息。',
    'home.dialog.about.supportNote': '先查阅本页对应指南，通常可以快速排除线材、端口、固件和积木输入问题。',
    'home.dialog.build.title': '搭建说明',
    'home.dialog.build.body': '当前为搭建图占位内容，后续会替换为对应产品的真实搭建说明。',
    'menu.hardwareStatus': '硬件状态',
    'status.disconnected': 'EST 未连接',
    'status.connected': 'EST 已连接',
    'status.upgradeRequired': 'EST 需升级',
    'codeDrawer.expand': '展开 Python 代码区',
    'codeDrawer.collapse': '收起 Python 代码区',
    'codeDrawer.resize': '拖动调整 Python 代码区宽度；双击恢复默认宽度',

    'programControls.group': 'EST 程序控制',
    'programControls.slotLabel': '槽位',
    'programControls.programSize': '程序大小：{used} / {limit} 字节',
    'programControls.programSizeWarning': '容量接近上限',
    'programControls.programSizeExceeded': '程序超过设备容量',
    'programControls.previousSlot': '上一个槽位',
    'programControls.nextSlot': '下一个槽位',
    'programControls.selectSlot': '选择程序槽位',
    'programControls.selectSlotNumber': '选择槽位 {slot}',
    'programControls.currentSlot': '当前程序槽位 {slot}',
    'programControls.downloadStart': '正在下载到槽位 {slot}...',
    'programControls.downloadDone': '已下载到槽位 {slot}',
    'programControls.runStart': '正在下载并启动槽位 {slot}...',
    'programControls.runDone': '槽位 {slot} 的程序已启动',
    'programControls.stopStart': '正在停止程序...',
    'programControls.stopDone': '程序已停止',
    'programControls.failed': '操作失败',
    'programControls.errorTitle': 'EST 程序操作失败',
    'programControls.errorMessage': '无法完成程序操作。',
    'programControls.firmwareUpgradeRequired': '当前 EST 固件不支持这个程序使用的功能。请升级到支持相应 EST Studio 功能的固件后再运行。',
    'programControls.unknownError': '未知错误',
    'programControls.usbDisconnected': 'EST USB 连接已断开，请重新连接 EST 后重试。',
    'programControls.stopProgram': '停止程序',
    'programControls.runProgram': '运行程序',
    'programControls.runNeedsFirmware': '连接兼容固件后运行程序',
    'programControls.downloadProgram': '下载程序',
    'programControls.downloadNeedsFirmware': '连接兼容固件后下载程序',
    'migration.irChannelFixed': 'EST 红外遥控当前只支持频道 1。已将旧工程中的频道 2-4 自动迁移为频道 1。',

    'hardware.title': '硬件状态',
    'hardware.subtitle': 'EST 主机与外设信息',
    'hardware.refreshing': '正在刷新...',
    'hardware.manualRefresh': '手动刷新',
    'hardware.close': '关闭硬件状态',
    'hardware.runningNotice': '程序运行中，外设详情暂停刷新',
    'hardware.readError': '无法读取硬件状态',
    'hardware.notConnected': 'EST 未连接',
    'hardware.connectionBattery': '连接与电池',
    'hardware.connectionStatus': '连接状态',
    'hardware.connected': '已连接',
    'hardware.disconnected': '未连接',
    'hardware.firmwareVersion': '固件版本',
    'hardware.protocolVersion': '协议版本',
    'hardware.compatibility': '兼容状态',
    'hardware.programCompatible': '可运行当前程序',
    'hardware.battery': '电量',
    'hardware.adc': 'ADC',
    'hardware.sampleVoltage': '采样电压',
    'hardware.motors': '电机',
    'hardware.sensors': '传感器',
    'hardware.connectedReadable': '状态可读',
    'hardware.noData': '无数据',
    'hardware.type': '类型',
    'hardware.typeUnavailable': '未提供',
    'hardware.output': '输出',
    'hardware.power': '功率',
    'hardware.angle': '角度',
    'hardware.state': '状态',
    'hardware.mode': '模式',
    'hardware.valid': '有效',
    'hardware.value': '当前值',
    'hardware.yes': '是',
    'hardware.no': '否',
    'hardware.none': 'none',
    'hardware.unknown': 'unknown ({value})',
    'firmware.updateButton': '固件更新',
    'firmware.menuAria': '固件更新选项',
    'firmware.upgradeEstOs': '升级EST OS',
    'firmware.downgradeLegacyEst': '降级旧EST系统',
    'firmware.confirmTitle': '确认固件更新',
    'firmware.confirmAction': '继续',
    'firmware.cancelAction': '取消',
    'firmware.upgradeConfirmMessage': '升级到最新 EST OS？',
    'firmware.upgradeConfirmDetail': '请保持 EST 通过 USB 连接，升级期间不要拔线或关闭软件。',
    'firmware.downgradeConfirmMessage': '降级到旧版 EST 系统？',
    'firmware.downgradeConfirmDetail': '此操作用于兼容旧版项目。请保持 EST 通过 USB 连接，降级期间不要拔线或关闭软件。',
    'firmware.updateRunning': '正在更新固件，请保持连接...',
    'firmware.audioSyncRunning': '正在同步音效资源，请保持连接，不要操作设备...',
    'firmware.updateDone': '固件更新完成：{version}',
    'firmware.updateWithAudioDone': '固件和音效资源更新完成：{version}',
    'firmware.successTitle': '固件更新完成',
    'firmware.successMessage': 'EST 已更新到 {version}',
    'firmware.successWithAudioTitle': '固件和音效资源更新完成',
    'firmware.successWithAudioMessage': 'EST 已更新到 {version}，音效资源已同步',
    'firmware.successDetail': '升级包：{path}\nSHA-256：{sha256}',
    'firmware.errorTitle': '固件更新失败',
    'firmware.errorMessage': '无法完成 EST 固件更新。',
    'firmware.busy': '更新中...',

    'category.motor': '电机',
    'category.movement': '移动',
    'category.display': '显示',
    'category.sound': '播放',
    'category.event': '事件',
    'category.control': '控制',
    'category.sensing': '传感器',

    'icon.divider': '分隔线',
    'icon.motor': '电机',
    'icon.drive': '组合电机',
    'icon.display': '显示',
    'icon.music': '音乐',
    'icon.event': '事件',
    'icon.host': '主机',
    'icon.button': '按键',
    'icon.color': '颜色',
    'icon.temperature': '温度',
    'icon.ultrasonic': '超声波',
    'icon.ir': '红外',
    'icon.gyro': '陀螺仪',
    'history.undo': '撤回',
    'history.redo': '前进',
    'steering.left': '左',
    'steering.right': '右',
    'steering.forward': '前',

    'block.motor.runFor': '%1 %2 运行 %3 %4',
    'block.motor.start': '%1 %2 启动电机',
    'block.motor.stop': '%1 停止电机',
    'block.motor.setSpeed': '%1 将速度设置为 %2 %%',
    'block.motor.setStopAction': '%1 将电机设置为在停止处 %2',
    'block.motor.runForSpeed': '%1 以 %2 %% 的速度运行 %3 %4',
    'block.motor.startSpeed': '%1 以 %2 %% 的速度启动电机',
    'block.motor.startPower': '%1 以 %2 %% 的功率启动电机',
    'block.motor.resetDegrees': '%1 重置运转度数',
    'block.motor.degrees': '%1 运转度数',
    'block.motor.speed': '%1 速度',
    'block.motor.stalled': '马达 %1 是否堵转？',

    'block.movement.moveFor': '向 %1 移动 %2 %3',
    'block.movement.steerFor': '向 %1 移动 %2 %3',
    'block.movement.startSteer': '开始向 %1 移动',
    'block.movement.stop': '停止运动',
    'block.movement.setSpeed': '将移动速度设置为 %1 %%',
    'block.movement.setPair': '将运转电机设置为 %1 和 %2',
    'block.movement.setStopAction': '将运转电机设置为停止时 %1',
    'block.movement.steerForSpeed': '以 %1 %% 的速度向 %2 移动 %3 %4',
    'block.movement.dualSpeedFor': '以 %1 %2 %% 的速度移动 %3 %4',
    'block.movement.startSteerSpeed': '以 %1 %% 的速度开始向 %2 移动',
    'block.movement.startDualSpeed': '以 %1 %2 %% 的速度开始移动',
    'block.movement.lineFollowInit': 'PWM巡线参数初始化',
    'block.movement.lineFollowDualStep': '双输入PWM巡线 左输入 %1 右输入 %2 左基础功率 %3 右基础功率 %4 Kp %5 Kd %6',

    'block.display.imageFor': '显示 %1 %2 秒',
    'block.display.image': '显示 %1',
    'block.display.draw': '绘制图形 %1',
    'block.display.textLine': '在第 %1 行写入 %2',
    'block.display.textXY': '使用字体 %1 在 %2 , %3 处写入 %4',
    'block.display.clear': '清除显示',
    'block.display.statusLight': '将状态灯设置为 %1',
    'drawing.title': '绘制 EST 屏幕图形',
    'drawing.canvas': 'EST 黑白像素画板',
    'drawing.empty': '点击绘制',
    'drawing.edit': '编辑图形',
    'drawing.brush': '画笔',
    'drawing.eraser': '橡皮擦',
    'drawing.rectangleOutline': '空心矩形（两点确定对角）',
    'drawing.rectangleFill': '实心矩形（两点确定对角）',
    'drawing.circleOutline': '空心圆形（第一点为圆心，第二点确定半径）',
    'drawing.circleFill': '实心圆形（第一点为圆心，第二点确定半径）',
    'drawing.text': '文本',
    'drawing.textPlaceholder': '输入要转换的文本',
    'drawing.textSize': '文本字号',
    'drawing.shapeBlack': '黑色形状',
    'drawing.shapeWhite': '白色形状（擦除）',
    'drawing.shapeDraw': '绘制',
    'drawing.shapeErase': '擦除',
    'drawing.undo': '撤回',
    'drawing.redo': '前进',
    'drawing.clear': '清空',
    'drawing.done': '完成',
    'drawing.brushSize': '画笔粗细 {size}',

    'block.sound.playWait': '播放声音 %1 直到完成',
    'block.sound.play': '开始播放声音 %1',
    'block.sound.beepFor': '播放钢琴音符 %1 %2 秒',
    'block.sound.beep': '开始播放钢琴音符 %1',
    'block.sound.stopAll': '停止所有声音',
    'block.sound.setVolume': '将音量设置为 %1 %%',

    'block.event.programStart': '当程序启动时',
    'block.event.brickButton': '当 %1 按钮 %2',
    'block.event.condition': '当 %1',
    'block.event.broadcastReceived': '当接收到 %1',
    'block.event.broadcast': '广播 %1',
    'block.event.broadcastWait': '广播 %1 并等待',
    'block.event.timer': '当计时器 > %1',

    'block.control.waitSeconds': '等待 %1 秒',
    'block.control.waitUntil': '等待 %1',
    'block.control.repeat': '重复执行 %1 次',
    'block.control.forever': '重复执行',
    'block.control.repeatUntil': '重复执行直到 %1',
    'block.control.if': '如果 %1 那么',
    'block.control.else': '否则',
    'block.control.stopOtherStacks': '停止其它程序堆',
    'block.control.stop': '停止 %1',

    'block.sensing.buttonValue': '按钮',
    'block.sensing.buttonPressed': '%1 按钮是否被按压？',
    'block.sensing.waitButton': '等待直到 %1 按钮 %2',
    'block.sensing.reflection': '%1 反射光线强度',
    'block.sensing.reflectionCompare': '%1 反射光线强度是否 %2 %3 %%？',
    'block.sensing.ambient': '%1 环境光强度',
    'block.sensing.ambientCompare': '%1 环境光强度是否 %2 %3 %%？',
    'block.sensing.colorValue': '%1 颜色',
    'block.sensing.colorIs': '%1 颜色是否为 %2？',
    'block.sensing.waitColor': '%1 等待直到颜色为 %2',
    'block.sensing.temperature': '%1 温度，单位为 %2',
    'block.sensing.touchPressed': '%1 是否被按压？',
    'block.sensing.waitTouch': '%1 等待直到 %2',
    'block.sensing.ultrasonicDistance': '%1 距离，单位为 %2',
    'block.sensing.ultrasonicCompare': '%1 距离是否 %2 %3 %4？',
    'block.sensing.waitUltrasonic': '%1 等待直到距离 %2 %3 %4',
    'block.sensing.irProximity': '%1 近程',
    'block.sensing.irProximityCompare': '%1 近程是否 %2 %3 %%？',
    'block.sensing.waitIrProximity': '%1 等待直到近程 %2 %3 %%',
    'block.sensing.waitIrBeaconButton': '%1 等待直到信标 %2 %3',
    'block.sensing.gyroAngle': '%1 角度',
    'block.sensing.gyroRate': '%1 角速度',
    'block.sensing.gyroReset': '%1 重置角度',
    'block.sensing.gyroCompare': '%1 角度是否 %2 %3°？',
    'block.sensing.waitGyro': '%1 等待直到角度 %2 %3°',
    'block.sensing.timer': '计时器',
    'block.sensing.timerReset': '重置计数器',

    'option.motorDirection.clockwise': '顺时针',
    'option.motorDirection.counterclockwise': '逆时针',
    'option.driveDirection.forward': '前',
    'option.driveDirection.backward': '后',
    'option.motorUnit.rotations': '圈',
    'option.motorUnit.degrees': '度',
    'option.motorUnit.seconds': '秒',
    'option.stopAction.hold': '保持位置',
    'option.stopAction.float': '惯性滑行',
    'option.font.regular_black': '常规黑色',
    'option.font.bold_black': '粗体黑色',
    'option.font.large_black': '大号黑色',
    'option.font.regular_white': '常规白色',
    'option.font.bold_white': '粗体白色',
    'option.font.large_white': '大号白色',
    'option.statusLight.off': '关闭',
    'option.statusLight.red': '红色',
    'option.statusLight.blue': '蓝色',
    'option.sound.pianoPrefix': '钢琴',
    'option.sound.communication_hello': 'Communication / Hello',
    'option.touchEvent.pressed': '被按压',
    'option.touchEvent.released': '被松开',
    'option.comparator.less': '小于 (<)',
    'option.comparator.greater': '大于 (>)',
    'option.comparator.equal': '等于 (=)',
    'option.comparator.changed': '变化超过',
    'option.color.none': '无色',
    'option.color.black': '黑色',
    'option.color.blue': '蓝色',
    'option.color.green': '绿色',
    'option.color.yellow': '黄色',
    'option.color.red': '红色',
    'option.color.white': '白色',
    'option.color.brown': '棕色',
    'option.colorEvent.changed': '已改变',
    'option.temperatureUnit.celsius': '摄氏',
    'option.temperatureUnit.fahrenheit': '华氏',
    'option.beaconEvent.top_left_pressed': '左上按钮被按压',
    'option.beaconEvent.bottom_left_pressed': '左下按钮被按压',
    'option.beaconEvent.left_released': '未按压左按钮',
    'option.beaconEvent.top_right_pressed': '右上按钮被按压',
    'option.beaconEvent.bottom_right_pressed': '右下按钮被按压',
    'option.beaconEvent.right_released': '未按压右按钮',
    'option.beaconEvent.active': '信标处于活动状态',
    'option.brickButton.none': '无',
    'option.brickButton.back': '返回',
    'option.brickButton.left': '左',
    'option.brickButton.confirm': '确认',
    'option.brickButton.right': '右',
    'option.brickButton.up': '上',
    'option.brickButton.down': '下',
    'option.distanceUnit.centimeters': '厘米',
    'option.distanceUnit.inches': '英寸',
    'option.message.message_1': '消息1',
    'option.message.message_2': '消息2',
    'option.message.message_3': '消息3',
    'option.message.message_4': '消息4',
    'option.message.message_5': '消息5',
    'option.message.message_6': '消息6',
    'option.message.message_7': '消息7',
    'option.message.message_8': '消息8',
    'option.stopScope.this_stack': '此程序堆',
    'option.stopScope.all': '退出整个程序'
};

const en = {
    'home.blockGuide.vision_valid': 'Vision target valid｜Reads fresh state for left hand, right hand, body, or face.',
    'home.blockGuide.vision_gesture': 'Match gesture｜Reads left and right hands independently in the same program.',
    'home.blockGuide.vision_class': 'Vision class ID｜Returns the selected target class, or -1 when invalid.',
    'home.blockGuide.vision_position': 'Vision position and size｜Returns mirrored coordinates or size for one target, 0–100.',
    'block.vision.valid': 'vision %1 valid?',
    'block.vision.waitState': 'wait until vision %1 is %2',
    'block.vision.waitGesture': 'wait until vision %1 is %2',
    'vision.valid': 'valid', 'vision.invalid': 'invalid',
    'category.vision': 'Vision',
    'vision.removedEvents': 'This project contains removed vision event hats. Loading was cancelled to preserve the program. Replace those hats in the previous version before opening it here.',
    'extension.vision.description': 'Recognize hand gestures, face actions and body poses with the computer camera. Send the selected target to EST.',
    'block.vision.face.detected': 'face detected?',
    'block.vision.face.action': 'face action is %1 ?',
    'block.vision.face.wait': 'wait until face action is %1',
    'block.vision.pose.detected': 'body detected?',
    'block.vision.pose.action': 'body pose is %1 ?',
    'block.vision.pose.wait': 'wait until body pose is %1',
    'vision.face.natural': 'neutral', 'vision.face.smile': 'smile',
    'vision.face.blink': 'blink', 'vision.face.mouth': 'mouth open',
    'vision.pose.standing': 'standing', 'vision.pose.leftUp': 'left hand raised',
    'vision.pose.rightUp': 'right hand raised', 'vision.pose.bothUp': 'both hands raised',
    'vision.pose.squat': 'squatting', 'vision.pose.leanLeft': 'leaning left', 'vision.pose.leanRight': 'leaning right',
    'home.blockGuide.vision_face_detected': 'Face detected｜Reads the face cache directly. Enable face actions in the camera panel.',
    'home.blockGuide.vision_face_action': 'Face action｜Matches smile, blink, mouth open or neutral. Multiple actions can match; no identity or emotion inference.',
    'home.blockGuide.vision_wait_face': 'Wait for face action｜Waits for the transmitted face action. No target keeps waiting.',
    'home.blockGuide.vision_pose_detected': 'Body detected｜Reads the body cache directly. Enable body pose in the camera panel.',
    'home.blockGuide.vision_pose_action': 'Body pose｜Matches standing, raised hands, squatting or leaning using simple visible-landmark rules.',
    'home.blockGuide.vision_wait_pose': 'Wait for pose｜Waits for the transmitted body pose without changing the camera target.',
    'home.blockGuide.mode.vision.target': 'Recognition targets｜The computer can send both hands, body and face results together.',
    'home.blockGuide.vision_wait_state': 'Wait for vision state｜Continues immediately if already satisfied; yields to other cooperative tasks while waiting.',
    'home.blockGuide.vision_wait_gesture': 'Wait for gesture｜Waits on the selected hand cache without affecting other vision types.',
    'block.vision.gesture': 'vision %1 is %2?',
    'block.vision.class': 'vision %1 class ID',
    'block.vision.position': 'vision %1 %2 (0–100)',
    'vision.cameraRunning': 'Vision · Camera active',
    'vision.settings': 'View camera',
    'vision.stopCamera': 'Stop camera',
    'vision.left': 'left hand', 'vision.right': 'right hand', 'vision.pose': 'body', 'vision.face': 'face',
    'vision.palm': 'open palm', 'vision.fist': 'fist', 'vision.thumb': 'thumbs up',
    'vision.point': 'pointing', 'vision.victory': 'victory', 'vision.other': 'other gesture',
    'vision.x': 'X', 'vision.y': 'Y', 'vision.width': 'width', 'vision.height': 'height',
    'menu.home': 'Home',
    'home.navigation': 'Home navigation',
    'home.nav.files': 'Files',
    'home.nav.build': 'Build',
    'home.nav.more': 'More',
    'home.startLine1': 'Start here',
    'home.startLine2': 'Build a new program',
    'home.start': 'Start',
    'home.returnToEditor': 'Return to editor',
    'home.productImages': 'EST product images',
    'home.animation.label': 'Blocks driving a robot arm, robot, and robot car',
    'home.animation.eventBlock': 'Program start',
    'home.animation.motorBlock': 'Start motor',
    'home.animation.displayBlock': 'Show smile',
    'home.animation.arm.title': 'Robot arm',
    'home.animation.arm.event': 'Program start',
    'home.animation.arm.action': 'Raise arm',
    'home.animation.arm.result': 'Grip complete',
    'home.animation.robot.title': 'Robot',
    'home.animation.robot.event': 'Program start',
    'home.animation.robot.action': 'Wave arm',
    'home.animation.robot.result': 'Show smile',
    'home.animation.car.title': 'Robot car',
    'home.animation.car.event': 'Program start',
    'home.animation.car.action': 'Drive forward',
    'home.animation.car.result': 'Turn on light',
    'home.recentFiles': 'Recent files',
    'home.noRecentFiles': 'No recent files yet',
    'home.noRecentFilesHint': 'New and saved projects will appear here.',
    'home.open': 'Open',
    'home.openFailed': 'This project file could not be opened.',
    'home.replaceWarning': 'The current project has unsaved changes. Replace it with another project?',
    'home.fileActions': 'More actions',
    'home.delete': 'Delete',
    'home.rename': 'Rename',
    'home.copy': 'Copy',
    'home.copyDone': 'Project copy created.',
    'home.copyFailed': 'This project file could not be copied.',
    'home.renameFailed': 'This project file could not be renamed.',
    'home.fileName': 'File name',
    'home.cancel': 'Cancel',
    'home.confirm': 'OK',
    'home.close': 'Close',
    'home.language': 'Language',
    'home.build.title': 'Building courses',
    'home.build.subtitle': 'Choose a model to open its PDF building guide',
    'home.build.categories': 'Building course categories',
    'home.build.category.basic': 'Basic Curriculum',
    'home.build.category.pbl': 'PBL Project',
    'home.build.guide': 'Open building guide PDF',
    'home.build.openFailed': 'This building guide could not be opened.',
    'home.build.libraryDownload': 'Download the complete building library',
    'home.build.libraryDownloadHint': 'Adds {count} projects (about 43.6 MB). The 8 included projects work offline.',
    'home.build.libraryReady': 'Complete building library installed',
    'home.build.libraryReadyHint': '{count} building projects are ready to open.',
    'home.build.downloadButton': 'Download',
    'home.build.downloadPhase.checking': 'Checking',
    'home.build.downloadPhase.downloading': 'Downloading {percent}%',
    'home.build.downloadPhase.extracting': 'Extracting',
    'home.build.downloadPhase.verifying': 'Verifying',
    'home.build.downloadPhase.complete': 'Complete',
    'home.build.downloadPaused': 'Paused at {percent}%',
    'home.build.downloadCancelling': 'Cancelling',
    'home.build.pauseButton': 'Pause',
    'home.build.resumeButton': 'Resume',
    'home.build.cancelButton': 'Cancel',
    'home.build.downloadComplete': 'The complete building library is ready.',
    'home.build.downloadCancelled': 'The download was cancelled and temporary files were removed.',
    'home.build.downloadFailed': 'The download failed. The 8 included building projects are still available.',
    'home.build.item.basic01': 'Crawling spider',
    'home.build.item.basic02': 'Forward car',
    'home.build.item.basic04': 'Robot dog',
    'home.build.item.basic13': 'Radar guard',
    'home.build.item.pbl01': 'Precision transport and sorting robot',
    'home.build.item.pbl04': 'Biped robot',
    'home.build.item.pbl07': 'Color sorter',
    'home.build.item.pbl14': 'Robot arm',
    'home.build.robotArm': 'Robot hand',
    'home.build.lineCar': 'Line follower',
    'home.build.obstacleCar': 'Obstacle car',
    'home.build.mechanicalArm': 'Robot arm',
    'home.build.transportCar': 'Transport car',
    'home.build.sensorCar': 'Sensor car',
    'home.build.creative': 'Creative build',
    'home.more.title': 'Guides and support',
    'home.more.intro':
        'Find help for vision recognition, device connections, hardware ports, block programming, ' +
        'the AI assistant and the app. Use the matching guide to troubleshoot a problem.',
    'home.more.est': 'Meet EST',
    'home.more.estSummary': 'Learn about the EST hub, hardware expansion, programming and smart features',
    'home.more.vision': 'Vision recognition and camera',
    'home.more.visionSummary': 'Recognize hands, body poses and face actions, then send results to EST',
    'home.more.interaction': 'Software and hardware guide',
    'home.more.interactionSummary': 'Connect EST, download programs, run them and solve problems',
    'home.more.hardware': 'Hardware guide',
    'home.more.hardwareSummary': 'Hub, motors, sensors, vision input and firmware updates',
    'home.more.blocks': 'Block reference',
    'home.more.blocksSummary': 'A function-by-function reference for every block in the toolbox',
    'home.more.ai': 'AI Coding Assistant',
    'home.more.aiSummary': 'Generate, preview and apply EST block programs from natural language',
    'home.more.software': 'Software information',
    'home.more.softwareSummary': 'Version, project files, workspace and updates',
    'home.more.about': 'About us',
    'home.more.aboutSummary': 'Product purpose, technical foundation and support',
    'home.dialog.est.title': 'Introducing EST',
    'home.dialog.est.lead':
        'EST is an educational robotics system centered on a programmable hub. It connects block-built ' +
        'mechanisms, motors, sensors, a display and sound, while EST Studio provides building references, ' +
        'program design, download, execution and debugging.',
    'home.dialog.est.overviewTitle': 'What EST is',
    'home.dialog.est.overviewImageAlt':
        'A crawling spider model built with an EST hub, motors and block mechanisms',
    'home.dialog.est.overviewImageCaption':
        'The Crawling spider example from the built-in building library shows how an EST hub, motors ' +
        'and block mechanisms work together.',
    'home.dialog.est.overview1':
        'The EST hub is the model’s control center. A program reads buttons and sensors, then controls ' +
        'motors, the display, status light and sound so a static structure can sense and act.',
    'home.dialog.est.overview2':
        'EST Studio is the companion desktop app for projects, block programming, Python generation, ' +
        'USB communication, Hardware Status, program download and execution, and firmware maintenance.',
    'home.dialog.est.overview3':
        'The system suits first-time robotics learners and supports integrated projects such as line ' +
        'followers, obstacle avoidance, sorting, robot arms, biomimetic mechanisms and vision interaction.',
    'home.dialog.est.controllerTitle': 'Inputs and outputs on the hub',
    'home.dialog.est.controller1':
        'Hub buttons provide program input for starting tasks, changing state or navigating an interface. ' +
        'Event blocks can start a stack when a button is pressed or released.',
    'home.dialog.est.controller2':
        'The 180 × 128 display can show built-in images, text and custom monochrome drawings. Text can ' +
        'be placed by line or at precise coordinates.',
    'home.dialog.est.controller3':
        'The status light supports off, red and blue. Sound output supports effects, piano notes, volume ' +
        'control and stopping playback.',
    'home.dialog.est.controller4':
        'USB connects the computer, queries hardware, transfers programs and updates firmware. The hub ' +
        'has eight program slots numbered 0–7 for saving, loading, running and stopping programs.',
    'home.dialog.est.hardwareTitle': 'Motors, ports and sensors',
    'home.dialog.est.hardware1':
        'A, B, C and D are four motor ports. A program can control one motor or configure two as a ' +
        'left/right drive pair for straight motion, steering, tank movement and line following.',
    'home.dialog.est.hardware2':
        'Motor blocks control direction, speed, power, rotations, degrees and time, and report accumulated ' +
        'angle, current speed and stall state. A stop can hold position or coast.',
    'home.dialog.est.hardware3':
        'Ports 1, 2, 3 and 4 accept sensors. The app supports reflected light, ambient light and color; ' +
        'touch; ultrasonic distance; infrared proximity and beacon; gyro angle and rate; and temperature.',
    'home.dialog.est.hardware4':
        'The computer camera can also act as virtual vision input without using ports 1–4. The sensors ' +
        'listed here are the supported range; the hub, motors, sensors and parts included depend on the kit.',
    'home.dialog.est.programmingTitle': 'Programming and device control',
    'home.dialog.est.programming1':
        'The toolbox includes Events, Motor, Movement, Display, Sound, Control, Sensing, Vision, Operators, ' +
        'Variables and Lists, and My Blocks, from simple sequences through complex logic.',
    'home.dialog.est.programming2':
        'Blocks generate visible Python code. A project can contain several event stacks organized with ' +
        'conditions, loops, broadcasts, timers and custom blocks for concurrent or cooperative tasks.',
    'home.dialog.est.programming3':
        'After connecting EST, choose a program slot. Download saves the current program, Run downloads ' +
        'then starts it, and Stop ends the user program while the device handles safe motor stopping.',
    'home.dialog.est.programming4':
        'Projects are saved as .ests files. The home page provides recent files and building guides. ' +
        'Hardware Status shows connection, battery, firmware and peripherals and provides firmware updates.',
    'home.dialog.est.smartTitle': 'AI and vision features',
    'home.dialog.est.smart1':
        'The AI Coding Assistant converts natural-language requests into locally validated block proposals ' +
        'that can be previewed, inserted or used to replace the workspace. The user controls every apply, ' +
        'download and run action.',
    'home.dialog.est.smart2':
        'Computer-side vision recognizes the left hand, right hand, body poses and face actions. It sends ' +
        'validity, class, mirrored position and size to EST for programs to read with Vision blocks.',
    'home.dialog.est.smart3':
        'Camera frames and vision model processing stay local and are not sent to the AI Coding service. ' +
        'Lighting, occlusion and angle affect results, which never replace review or safety protection.',
    'home.dialog.est.useTitle': 'What you can make with EST',
    'home.dialog.est.use1':
        'Learn the basics by moving motors, showing information, playing sound and using buttons, waits, ' +
        'conditions and loops to understand program flow.',
    'home.dialog.est.use2':
        'Build sensing projects such as line followers, obstacle-avoidance cars, radar guards and color ' +
        'sorters, where sensor readings change behavior in real time.',
    'home.dialog.est.use3':
        'Create integrated robot arms, transport and sorting robots, bipeds or vision interactions that ' +
        'combine mechanical design, data, algorithms and task coordination.',
    'home.dialog.est.useNote':
        'Before use, verify physical ports, installation direction, app version and firmware capability. ' +
        'Begin hardware tests at low speed and for short durations with clear space around moving parts.',
    'home.dialog.vision.title': 'Vision recognition and camera',
    'home.dialog.vision.lead':
        'Use the computer camera to recognize the left hand, right hand, body poses and face ' +
        'actions locally, then send structured results to a running EST program. The camera ' +
        'window is independent of the project window.',
    'home.dialog.vision.openAction': 'Open camera',
    'home.dialog.vision.startTitle': 'Open and start recognition',
    'home.dialog.vision.startImageAlt': 'EST Studio camera window recognizing a left hand',
    'home.dialog.vision.startImageCaption':
        'This is the actual camera window from the current app using an isolated test source. The ' +
        'blue square and recognition result are test data and contain no user camera content.',
    'home.dialog.vision.start1':
        'Choose Open camera above, or return to the editor and choose its camera button. Vision ' +
        'recognition opens in a separate window.',
    'home.dialog.vision.start2':
        'While stopped, select a camera and enable at least one of Left hand, Right hand, Body or ' +
        'Face. Enabling only what you need reduces computer load.',
    'home.dialog.vision.start3':
        'Choose Start recognition. On first use, the app loads, initializes and warms up the ' +
        'local models before requesting camera permission. It is ready when preview and data appear.',
    'home.dialog.vision.start4':
        'Stop recognition ends recognition and sending. Closing the independent window releases ' +
        'the camera; start recognition again the next time you open it.',
    'home.dialog.vision.modeTitle': 'What it recognizes',
    'home.dialog.vision.mode1':
        'Left and right hands are recognized separately: open palm, fist, thumbs up, pointing, ' +
        'victory and other gesture.',
    'home.dialog.vision.mode2':
        'Body poses: standing, left hand raised, right hand raised, both hands raised, squat, lean ' +
        'left and lean right.',
    'home.dialog.vision.mode3':
        'Face actions: natural, smile, blink and mouth open. Smile, blink and mouth open can be ' +
        'true together. This feature does not identify a person.',
    'home.dialog.vision.mode4':
        'Vision blocks can also report whether a target is valid, its class number, and horizontal ' +
        'position, vertical position, width and height in the mirrored preview, all normalized to 0–100.',
    'home.dialog.vision.programTitle': 'Use vision in a block program',
    'home.dialog.vision.program1':
        'New projects do not show vision blocks by default. Choose Add Extension at the lower left ' +
        'of the editor and select Vision to add its category.',
    'home.dialog.vision.program2':
        'The Vision extension provides 12 condition, reporter and wait blocks for the left hand, ' +
        'right hand, body or face. It currently has no “when recognized” event hat.',
    'home.dialog.vision.program3':
        'Open the camera, enable every target used by the program and start recognition. Adding the ' +
        'Vision extension does not start the camera automatically.',
    'home.dialog.vision.program4':
        'Connect EST, then download and run the program. The camera window automatically sends the ' +
        'latest valid data for the vision blocks to read. The AI Coding Assistant can generate ' +
        'these vision blocks too.',
    'home.dialog.vision.programNote':
        'Use the Block reference to see an image of every vision block plus its target types, ' +
        'action choices and return value, then verify conditions against live hardware data.',
    'home.dialog.vision.firmwareTitle': 'Connection and firmware requirements',
    'home.dialog.vision.firmware1':
        'With one recognition target enabled, EST requires protocol 1.30 and the vision-input ' +
        'capability. The app maps known version M1.27B to this protocol.',
    'home.dialog.vision.firmware2':
        'With several recognition targets enabled together, EST requires protocol 1.31 and the ' +
        'vision-input-multi capability. The app maps known version M1.28A to this protocol.',
    'home.dialog.vision.firmware3':
        'Local preview and recognition can continue when EST is disconnected or its firmware is ' +
        'unsupported. The window footer explains why data is not being sent; check Hardware Status ' +
        'and follow the Hardware guide to update.',
    'home.dialog.vision.firmware4':
        'Sending pauses during a program download or firmware update. It waits while no program is ' +
        'running and marks a missing or expired target invalid so the program cannot keep stale data.',
    'home.dialog.vision.privacyTitle': 'Privacy, performance and limits',
    'home.dialog.vision.privacy1':
        'Vision models and recognition run locally. Camera frames are not sent to the AI Coding ' +
        'service; only structured values such as class, position and size go to EST over USB.',
    'home.dialog.vision.privacy2':
        'Lighting, occlusion, distance and camera angle affect results. Keep the target fully in ' +
        'view and enable fewer recognition targets if the computer is under heavy load.',
    'home.dialog.vision.privacy3':
        'Face recognition checks only the listed simple actions. It does not infer identity, age, ' +
        'health or emotion. Do not use vision results as the only input for a safety decision.',
    'home.dialog.vision.troubleshootTitle': 'Common problems',
    'home.dialog.vision.troubleshoot1':
        'No camera or image: check Windows camera permission, close other software using the camera, ' +
        'then reopen the window or select another device.',
    'home.dialog.vision.troubleshoot2':
        'Slow first start: wait for model loading, initialization and warm-up. If loading fails, ' +
        'reopen the window and make sure the app installation is complete.',
    'home.dialog.vision.troubleshoot3':
        'Local recognition works but EST has no data: check USB, firmware capability, whether the ' +
        'program is running and whether the camera has enabled every target used by the program.',
    'home.dialog.vision.troubleshoot4':
        'One target works but several do not: enable only one target and test again. If it works, ' +
        'follow the Hardware guide to install firmware with protocol 1.31 support.',
    'home.dialog.interaction.title': 'Software and hardware guide',
    'home.dialog.interaction.lead':
        'Follow this sequence to connect, program and run. EST Studio automatically finds one EST ' +
        'connected over USB.',
    'home.dialog.interaction.connectTitle': 'Connect for the first time',
    'home.dialog.interaction.connect1': 'Connect the computer and EST with a data-capable USB cable, then turn on EST.',
    'home.dialog.interaction.connect2':
        'Open EST Studio. The app finds the device automatically, so you do not need to choose a ' +
        'hub model.',
    'home.dialog.interaction.connect3':
        'Check that the menu bar says “EST connected.” If it does not, reconnect the cable or try ' +
        'another USB port.',
    'home.dialog.interaction.connect4': 'Create or open an .ests project and begin with a “when program starts” block.',
    'home.dialog.interaction.programTitle': 'Download, run and stop',
    'home.dialog.interaction.program1':
        'There are eight program slots, numbered 0–7. The slot changes where a program is stored, ' +
        'not the project itself.',
    'home.dialog.interaction.program2':
        'Download converts the current blocks to Python and writes the result to the selected ' +
        'slot, replacing its previous program.',
    'home.dialog.interaction.program3':
        'Run downloads the current program first and then starts the selected slot, which is ' +
        'useful for quick testing.',
    'home.dialog.interaction.program4':
        'Stop ends the current user program. EST then handles a safe stop for any running motors.',
    'home.dialog.interaction.hostTitle': 'Use the hub screen',
    'home.dialog.interaction.host1':
        'You can use the six physical buttons even without a computer. The hub offers Recent Program, ' +
        'Programs, Port Viewer, IR Remote, Motor Output and Settings. See More → Hardware guide → ' +
        'Hub screen and buttons for the full button guide.',
    'home.dialog.interaction.host2':
        'Port Viewer and Settings are menus on the hub itself. Hardware Status in the desktop app ' +
        'shows connection details and handles firmware updates; it is a different interface.',
    'home.dialog.interaction.feedbackTitle': 'Read the feedback',
    'home.dialog.interaction.feedback1':
        'The interface reports generation, download and startup progress, then confirms the ' +
        'target slot when finished.',
    'home.dialog.interaction.feedback2':
        'A download will not start if the blocks cannot produce valid Python. Check empty inputs, ' +
        'invalid variable names and incomplete connections.',
    'home.dialog.interaction.feedback3':
        'If the firmware does not support a feature in the program, update it from Hardware ' +
        'Status and download again.',
    'home.dialog.interaction.feedbackNote':
        'Keep USB and power stable while downloading, starting a run or updating firmware. Do not ' +
        'unplug EST or close the app.',
    'home.dialog.interaction.visionTitle': 'Use the computer camera as vision input',
    'home.dialog.interaction.vision1':
        'Recognition runs on the computer and sends structured left-hand, right-hand, body and face ' +
        'results to EST over USB as virtual sensor data. It uses no port from 1–4.',
    'home.dialog.interaction.vision2':
        'For a project with vision blocks, add the Vision extension, open the camera and enable the ' +
        'same targets. Data is used continuously only while the EST program is running.',
    'home.dialog.interaction.vision3':
        'Vision sending pauses or clears during program download, transition, stop or firmware ' +
        'update. It resumes with the latest result and does not reuse an expired target.',
    'home.dialog.interaction.troubleshootTitle': 'Common problems',
    'home.dialog.interaction.troubleshoot1':
        'No connection: use a cable that carries data, try another USB port and close other ' +
        'software that may be using the device.',
    'home.dialog.interaction.troubleshoot2':
        'Interrupted download: reconnect EST, wait for the status to recover and download again. ' +
        'An interruption does not actively erase the old slot.',
    'home.dialog.interaction.troubleshoot3':
        'Unexpected behavior: check motor and sensor ports, units, steering direction and event ' +
        'conditions.',
    'home.dialog.hardware.title': 'Hardware guide',
    'home.dialog.hardware.lead':
        'EST Studio is designed for one computer connected to one EST. Every port selected in a ' +
        'block must match the physical wiring.',
    'home.dialog.hardware.controllerTitle': 'EST hub',
    'home.dialog.hardware.controller1':
        'USB carries device communication and programs. After connecting, check the connection ' +
        'status in the menu bar.',
    'home.dialog.hardware.controller2':
        'Hardware Status shows the connection, battery, firmware version and detected ' +
        'peripherals.',
    'home.dialog.hardware.controller3':
        'The hub has buttons, a display, a status light and sound output that can be controlled ' +
        'directly with blocks.',
    'home.dialog.hardware.hostHomeTitle': 'Hub screen and buttons',
    'home.dialog.hardware.hostHomeImageAlt': 'Example of the Recent Program screen on the EST hub',
    'home.dialog.hardware.hostImageCaption':
        'Example rendered from the hub firmware. Program names and readings are sample data; ' +
        'the screen can vary with firmware version and device state.',
    'home.dialog.hardware.hostHome1':
        'The hub has Back, Left, Up, Down, Right and Confirm buttons. On the home screen, Left or Up ' +
        'selects the previous item, Right or Down selects the next, and Confirm opens it. The six ' +
        'items are Recent Program, Programs, Port Viewer, IR Remote, Motor Output and Settings.',
    'home.dialog.hardware.hostHome2':
        'Battery level appears at the top. USB connection and menu position appear at the bottom. ' +
        'The icons scroll as you move through the home items.',
    'home.dialog.hardware.hostHome3':
        'Press Back briefly on the home screen to open the power-off confirmation. Press Back again ' +
        'to cancel or Confirm to power off. In a submenu, Back normally returns to the previous ' +
        'page or home screen.',
    'home.dialog.hardware.hostHome4':
        'Hold Back for about one second in the hub menus to emergency-stop and return home. During ' +
        'a USB program transfer, the screen shows progress and buttons are unavailable until it ends.',
    'home.dialog.hardware.hostProgramsTitle': 'Recent Program and program list',
    'home.dialog.hardware.hostProgramsImageAlt': 'Example of the EST hub program list',
    'home.dialog.hardware.hostPrograms1':
        'Choose Recent Program on the home screen and press Confirm to rerun the most recently used ' +
        'program. Nothing starts if there is no recent program.',
    'home.dialog.hardware.hostPrograms2':
        'Choose Programs to see saved program slots (0–7). Use Up and Down to select one, then ' +
        'Confirm to run it. Press Back while it is running to stop it.',
    'home.dialog.hardware.hostPrograms3':
        'Press Right on a selected program to open the delete confirmation. Cancel is selected by ' +
        'default; use Left or Right to select Delete, then Confirm. A deleted program cannot be ' +
        'restored from the hub, so check its name and slot first.',
    'home.dialog.hardware.hostPrograms4':
        'Very low battery may prevent a program from starting and prompt you to charge EST. If a ' +
        'program fails, read the on-screen error and press Back to leave the error page.',
    'home.dialog.hardware.hostPortsTitle': 'Port Viewer and sensor modes',
    'home.dialog.hardware.hostPortsImageAlt': 'Example of the EST hub Port Viewer',
    'home.dialog.hardware.hostPorts1':
        'Choose Port Viewer on the home screen. Use Left and Right to cycle through motor ports ' +
        'A, B, C, D and sensor ports 1, 2, 3, 4. Press Back to return home.',
    'home.dialog.hardware.hostPorts2':
        'Motor pages show the detected type, stopped/running state, speed and angle. Sensor pages ' +
        'show type, current mode and live value. Viewing ports does not drive motors.',
    'home.dialog.hardware.hostPorts3':
        'On a sensor port that supports modes, press Confirm to cycle: color (reflected/ambient/' +
        'color), ultrasonic (cm/inches/presence), infrared (proximity/beacon/remote), gyro ' +
        '(angle/rate), or temperature (Celsius/Fahrenheit). Touch and other single-mode sensors ' +
        'do not change mode when you press Confirm.',
    'home.dialog.hardware.hostRemoteTitle': 'IR Remote',
    'home.dialog.hardware.hostRemote1':
        'Connect the infrared sensor to sensor port 4 and the two motors you want to control. ' +
        'IR Remote on the home screen listens to remote channel 1.',
    'home.dialog.hardware.hostRemote2':
        'The default motor pair is B/C. Press Confirm to switch to A/D; all motors brake during the ' +
        'switch. Remote output can reach 100% power. Lift wheels off the ground and clear the ' +
        'movement area before testing.',
    'home.dialog.hardware.hostRemote3':
        'Back exits IR Remote and brakes the motors. A disconnected sensor or motor, or a lost ' +
        'remote signal, also stops output and shows a fault.',
    'home.dialog.hardware.hostMotorTitle': 'Motor Output (manual control)',
    'home.dialog.hardware.hostMotor1':
        'When you enter Motor Output, all A–D motors begin stopped and power starts at 25%.',
    'home.dialog.hardware.hostMotor2':
        'Up controls A, Left controls B, Right controls C and Down controls D. Each press cycles ' +
        'that port through Stop → Forward → Reverse → Stop.',
    'home.dialog.hardware.hostMotor3':
        'Confirm cycles power through 25%, 50%, 75% and 100%. Running motors adopt the new level ' +
        'immediately.',
    'home.dialog.hardware.hostMotor4':
        'Press Back briefly to leave this page and brake all motors. Re-entering resets all ports ' +
        'to Stop and power to 25%.',
    'home.dialog.hardware.hostMotorNote':
        'This is latched control, not hold-to-run: releasing a button does not stop the motor. ' +
        'Secure the robot or lift its wheels before testing. Hold Back for about one second if you ' +
        'need an immediate emergency stop.',
    'home.dialog.hardware.hostSettingsTitle': 'Settings, device info and power-off',
    'home.dialog.hardware.hostSettingsImageAlt': 'Example of the EST hub Settings screen',
    'home.dialog.hardware.hostSettings1':
        'Choose Settings on the home screen. Use Up/Down to select Backlight, Volume, Language or ' +
        'Device Info. Left/Right adjusts backlight from 10–100% or volume from 0–100%, both in ' +
        '10% steps.',
    'home.dialog.hardware.hostSettings2':
        'Use Left/Right on Language to switch among Chinese, English and Brazilian Portuguese. ' +
        'Choose Device Info and press Confirm to see model, firmware, bootloader, USB and battery ' +
        'information. Press Back to return to Settings, then Back again to return home.',
    'home.dialog.hardware.hostSettings3':
        'Backlight, volume and language settings are saved on the hub. Firmware updates are not ' +
        'started from this menu; use Hardware Status in EST Studio on the computer and follow the ' +
        'steps below.',
    'home.dialog.hardware.outputTitle': 'Motors and outputs',
    'home.dialog.hardware.output1':
        'Motors use ports A, B, C and D. A single-motor block must use the port where that motor ' +
        'is connected.',
    'home.dialog.hardware.output2':
        'Movement blocks control a left and right motor together. Set both ports first and check ' +
        'how the motors are installed.',
    'home.dialog.hardware.output3':
        'Speed and power normally use percentages. Rotations, degrees or seconds determine when a ' +
        'limited movement ends.',
    'home.dialog.hardware.sensorTitle': 'Sensors and inputs',
    'home.dialog.hardware.sensor1':
        'External sensors use ports 1, 2, 3 and 4. The port in the block must match the physical ' +
        'socket.',
    'home.dialog.hardware.sensor2':
        'The color sensor reads reflected light, ambient light and color for line following, ' +
        'recognition and brightness tests.',
    'home.dialog.hardware.sensor3':
        'Touch, ultrasonic and infrared sensors provide contact, distance, proximity and beacon ' +
        'input.',
    'home.dialog.hardware.sensor4':
        'The gyro reports angle and rate, while the temperature sensor reports temperature. Hub ' +
        'buttons and timers need no external port.',
    'home.dialog.hardware.sensor5':
        'The computer camera acts as virtual vision input without using ports 1–4. Open its camera ' +
        'window separately and use EST firmware that supports vision input.',
    'home.dialog.hardware.firmwareTitle': 'Firmware upgrade and downgrade',
    'home.dialog.hardware.firmware1':
        'Save the current project, connect EST to the computer by USB, keep its power stable and ' +
        'stop any running program before you begin.',
    'home.dialog.hardware.firmware2':
        'Open the editor, choose Hardware Status from the menu bar, confirm that EST is connected ' +
        'and note the current firmware version.',
    'home.dialog.hardware.firmware3':
        'Choose Firmware Update. Use Upgrade EST OS for normal updates; choose Downgrade to old ' +
        'EST only when an older project requires it.',
    'home.dialog.hardware.firmware4':
        'Read the confirmation, verify the target and choose Continue. The app releases the normal ' +
        'device connection before it starts writing the firmware.',
    'home.dialog.hardware.firmware5':
        'Wait for Updating firmware to finish. If Syncing sound resources appears after an EST OS ' +
        'upgrade, keep waiting; this is the second stage of the same update.',
    'home.dialog.hardware.firmware6':
        'The success dialog shows the target version, package path and SHA-256. Hardware Status ' +
        'refreshes after you close the dialog.',
    'home.dialog.hardware.firmware7':
        'If the update fails, follow the detailed error and check USB, power and the local Python ' +
        'environment, reconnect EST and retry. For repeated failures, record the error, app version ' +
        'and previous firmware version.',
    'home.dialog.hardware.firmwareNote':
        'Do not unplug USB, close the app, remove power or use the device while firmware or sound ' +
        'resources are being written. Connect, run, stop and download controls are temporarily ' +
        'unavailable during the update.',
    'home.dialog.hardware.careTitle': 'Connection and care',
    'home.dialog.hardware.care1':
        'Hold a connector by its plug, check its orientation and never pull the cable or force it ' +
        'into a socket.',
    'home.dialog.hardware.care2':
        'Stop the program before adjusting a mechanism, wheel or motor cable so the model cannot ' +
        'move unexpectedly.',
    'home.dialog.hardware.care3':
        'For unusual readings, check the port, plug and cable, then confirm that Hardware Status ' +
        'detects the peripheral.',
    'home.dialog.hardware.careNote':
        'Keep EST powered and connected by USB during a firmware update. Do not close the app ' +
        'before it finishes.',
    'home.dialog.blocks.title': 'Block reference',
    'home.dialog.blocks.lead':
        'This reference follows the current toolbox order and explains every available EST block, ' +
        'operator, variable, list and My Block function.',
    'home.dialog.blocks.startTitle': 'Build your first program',
    'home.dialog.blocks.start1': 'Drag “when program starts” from Events to begin a program stack.',
    'home.dialog.blocks.start2': 'Connect Motor, Movement, Display or Sound actions underneath it.',
    'home.dialog.blocks.start3':
        'Put sensor or operator blocks into value and condition inputs, then add waits, loops or ' +
        'decisions as needed.',
    'home.dialog.blocks.start4': 'Review the Python panel, choose a program slot and select Download or Run.',
    'home.dialog.blocks.categoryTitle': 'The 11 categories',
    'home.dialog.blocks.category1':
        'Motor: control one motor on A–D; set direction, speed, power, amount and stop action, or ' +
        'read angle and speed.',
    'home.dialog.blocks.category2':
        'Movement: treat two motors as left and right drive motors for straight motion, steering, ' +
        'tank movement and line following.',
    'home.dialog.blocks.category3':
        'Display: show an image or text on the hub, clear the screen and set the status light.',
    'home.dialog.blocks.category4': 'Sound: play effects or piano notes, set volume and stop all sound.',
    'home.dialog.blocks.category5':
        'Events: start a stack when the program starts, a hub button or condition changes, a ' +
        'message arrives or a timer passes a value.',
    'home.dialog.blocks.category6':
        'Control: wait, repeat, loop forever, test conditions and stop the current or other ' +
        'stacks.',
    'home.dialog.blocks.category7':
        'Sensors: read hub buttons, color, temperature, touch, ultrasonic, infrared, gyro and ' +
        'timer values.',
    'home.dialog.blocks.category8':
        'Operators: calculate, compare, combine logic, choose random values and join text for ' +
        'conditions and outputs.',
    'home.dialog.blocks.category9':
        'Vision: read validity, class, action, position and size for either hand, the body or face, ' +
        'and wait for a selected vision condition.',
    'home.dialog.blocks.category10':
        'Variables and lists: store and change numbers or text, manage collections and use their ' +
        'data in conditions, calculations and output.',
    'home.dialog.blocks.category11':
        'My Blocks: package logic for reuse and add number, text or Boolean arguments as needed.',
    'home.dialog.blocks.inputTitle': 'Understand inputs and shapes',
    'home.dialog.blocks.input1':
        'Type directly into a white value field or insert a variable, sensor reading or operator ' +
        'result.',
    'home.dialog.blocks.input2':
        'Motor ports, movement ports and event sensor ports accept either a menu choice or a ' +
        'standard variable.',
    'home.dialog.blocks.input3':
        'Rounded blocks report values or text; pointed blocks report true or false. Only matching ' +
        'shapes fit an input.',
    'home.dialog.blocks.patternTitle': 'Useful program patterns',
    'home.dialog.blocks.pattern1': 'One action: program start → set parameters → perform action → stop or finish.',
    'home.dialog.blocks.pattern2':
        'Continuous control: program start → repeat → read sensor → decide → control motor or ' +
        'output.',
    'home.dialog.blocks.pattern3':
        'Several tasks: split work across event stacks or broadcasts and decide clearly when each ' +
        'task stops.',
    'home.dialog.blocks.patternNote':
        'Test ports and direction at low speed for a short time before increasing speed or adding ' +
        'a loop.',
    'home.blockGuide.category.operators': 'Operators',
    'home.blockGuide.category.variables': 'Variables and lists',
    'home.blockGuide.category.myBlocks': 'My Blocks',
    'home.blockGuide.modesTitle': 'Modes and parameters',
    'home.blockGuide.previewLoading': 'Generating block image',
    'home.blockGuide.previewUnavailable': 'Block image is temporarily unavailable',
    'home.blockGuide.mode.motor.ports':
        'Output ports｜A, B, C and D. Select the port to which the motor is physically connected.',
    'home.blockGuide.mode.motor.direction':
        'Direction｜Clockwise or counterclockwise, viewed while facing the motor output shaft.',
    'home.blockGuide.mode.motor.amount':
        'Amount｜Run by rotations, degrees or seconds. Rotations and degrees control travel; seconds control duration.',
    'home.blockGuide.mode.motor.speedPower':
        'Speed and power｜Speed mode controls a target speed; power mode controls output directly. ' +
        'The sign also affects direction.',
    'home.blockGuide.mode.motor.stop':
        'Stop action｜Hold actively locks the current position; coast releases the motor so it can slow naturally.',
    'home.blockGuide.mode.motor.feedback':
        'Feedback｜Read accumulated degrees, current speed and stall state. Degrees can be reset at any ' +
        'mechanical reference position.',
    'home.blockGuide.mode.movement.pair':
        'Drive pair｜Choose the left and right drive-motor ports first; movement blocks control this pair together.',
    'home.blockGuide.mode.movement.direction':
        'Straight direction｜Forward or backward. Actual travel also depends on how the two motors are mounted.',
    'home.blockGuide.mode.movement.steering':
        'Steering｜0 drives straight; negative and positive values turn in opposite directions, with larger ' +
        'magnitudes turning more sharply.',
    'home.blockGuide.mode.movement.amount':
        'Amount｜Rotations, degrees and seconds are available, with the same meanings as the single-motor amount modes.',
    'home.blockGuide.mode.movement.speed':
        'Speed｜Set one drive speed or separate left and right speeds. Different speeds or opposite signs ' +
        'create differential or point turns.',
    'home.blockGuide.mode.movement.stop':
        'Stop action｜At the end of a move, either hold both wheel positions or let both wheels coast.',
    'home.blockGuide.mode.movement.lineFollow':
        'Dual-input PWM line following｜Initialize once, then supply left/right readings, base powers, Kp and ' +
        'Kd in a loop. Kp corrects present error; Kd damps rapid change.',
    'home.blockGuide.mode.display.image':
        'Images｜Choose from the expression and eye libraries. An image can remain on screen or be shown for ' +
        'a number of seconds.',
    'home.blockGuide.mode.display.text':
        'Text position｜Lay out text quickly by display line, or place it precisely with X and Y coordinates.',
    'home.blockGuide.mode.display.font':
        'Fonts｜Regular, bold or large, each available as black text or white text.',
    'home.blockGuide.mode.display.light': 'Status light｜Off, red or blue.',
    'home.blockGuide.mode.sound.playback':
        'Playback｜Play until done waits for the sound to finish; start sound continues immediately to the next block.',
    'home.blockGuide.mode.sound.note':
        'Notes｜Choose from the piano pitch range. Play for a duration, or keep playing until replaced or stopped.',
    'home.blockGuide.mode.sound.volume': 'Volume｜Sets the percentage volume for later sounds and notes.',
    'home.blockGuide.mode.event.start':
        'Start conditions｜A stack can start when the program starts, a condition becomes true, a hub button ' +
        'changes, or the timer passes a threshold.',
    'home.blockGuide.mode.event.button':
        'Button events｜Choose press or release for the left, confirm, right, up or down hub button.',
    'home.blockGuide.mode.event.broadcast':
        'Broadcasts｜Eight messages are available. Send and continue, or wait for the stacks started by that ' +
        'message to finish.',
    'home.blockGuide.mode.event.timer':
        'Timer event｜Starts when the number of elapsed program seconds passes the specified value.',
    'home.blockGuide.mode.control.wait':
        'Wait｜Pause for a number of seconds, or until a Boolean condition becomes true.',
    'home.blockGuide.mode.control.loop':
        'Loops｜Repeat a number of times, repeat forever, or repeat until a condition becomes true.',
    'home.blockGuide.mode.control.branch': 'Branches｜Use a single if branch or a two-way if/else branch.',
    'home.blockGuide.mode.control.stop':
        'Stop scope｜Stop other stacks, the current stack, or the entire user program.',
    'home.blockGuide.mode.sensing.ports':
        'Sensor ports｜1, 2, 3 and 4. Every read or wait block must match the sensor\'s physical port.',
    'home.blockGuide.mode.sensing.button':
        'Hub buttons｜State reads include none, back, left, confirm, right, up and down. Wait mode supports ' +
        'press or release for left, confirm, right, up and down.',
    'home.blockGuide.mode.sensing.colorLight':
        'Color sensor—light modes｜Reflected light measures the sensor\'s own reflected beam; ambient light ' +
        'measures surrounding light. Both can be read or compared with a threshold.',
    'home.blockGuide.mode.sensing.color':
        'Color sensor—color mode｜Recognizes none, black, blue, green, yellow, red, white and brown. Wait mode ' +
        'also provides a changed event.',
    'home.blockGuide.mode.sensing.compare':
        'Comparison conditions｜All comparison-style sensor blocks provide less than, greater than and equal to.',
    'home.blockGuide.mode.sensing.temperature': 'Temperature sensor｜Read in Celsius or Fahrenheit.',
    'home.blockGuide.mode.sensing.touch':
        'Touch sensor｜Read whether it is pressed now, or wait for a press or release event.',
    'home.blockGuide.mode.sensing.ultrasonic':
        'Ultrasonic sensor｜Read distance in centimeters or inches; compare it, or wait until it is less than, ' +
        'greater than or equal to a value.',
    'home.blockGuide.mode.sensing.infrared':
        'Infrared sensor—proximity mode｜Read relative proximity, compare it with a threshold, or wait for a ' +
        'threshold condition.',
    'home.blockGuide.mode.sensing.beacon':
        'Infrared sensor—beacon mode｜Uses fixed channel 1. Wait for top-left, bottom-left, top-right or ' +
        'bottom-right press; left/right release; or beacon active.',
    'home.blockGuide.mode.sensing.gyro':
        'Gyro sensor｜Angle mode reads relative rotation; rate mode reads current rotation speed. Reset zero, ' +
        'compare angle, or wait for an angle condition.',
    'home.blockGuide.mode.sensing.timer':
        'Timer｜Read seconds elapsed since the last reset. Reset immediately returns it to zero and restarts timing.',
    'home.blockGuide.mode.operators.arithmetic':
        'Numbers｜Add, subtract, multiply, divide, random, modulo, round and mathematical functions.',
    'home.blockGuide.mode.operators.logic':
        'Comparison and logic｜Greater than, less than, equal to, and, or and not.',
    'home.blockGuide.mode.operators.text':
        'Text｜Join text, select a character, find length and test whether text contains another value.',
    'home.blockGuide.mode.variables.scalar':
        'Variables｜Read a number or text value, set a new value, or change it by a numeric amount.',
    'home.blockGuide.mode.variables.list':
        'Lists｜Add, delete, insert, replace, read by index, find an index, get length and test containment.',
    'home.blockGuide.mode.myBlocks.definition':
        'Define｜Create a reusable custom procedure with a configurable name and parameters.',
    'home.blockGuide.mode.myBlocks.call': 'Call｜Runs an already-defined custom block wherever it is needed.',
    'home.blockGuide.motor_run_for':
        'Run motor for an amount｜Runs the selected motor in a direction for a number of rotations, ' +
        'degrees or seconds, then continues.',
    'home.blockGuide.motor_start':
        'Start motor｜Starts the selected motor in a direction and keeps it running until another ' +
        'block stops it or the program ends.',
    'home.blockGuide.motor_stop':
        'Stop motor｜Stops the selected motor using its current hold-position or coast setting.',
    'home.blockGuide.motor_set_speed':
        'Set motor speed｜Sets the default speed percentage used by later actions for the selected motor.',
    'home.blockGuide.motor_set_stop_action':
        'Set motor stop action｜Chooses whether the motor holds its position or coasts when it stops.',
    'home.blockGuide.motor_run_for_speed':
        'Run an amount at a speed｜Runs the motor at a given speed for rotations, degrees or seconds, ' +
        'then continues.',
    'home.blockGuide.motor_start_speed':
        'Start motor at speed｜Starts continuous movement at the given speed without waiting for a stop.',
    'home.blockGuide.motor_start_power':
        'Start motor at power｜Applies the given motor power continuously for direct output control.',
    'home.blockGuide.motor_reset_degrees':
        'Reset motor degrees｜Sets the selected motor’s current accumulated angle to zero.',
    'home.blockGuide.motor_degrees':
        'Motor degrees｜Reports how far the selected motor has turned since its angle was reset.',
    'home.blockGuide.motor_speed':
        'Motor speed｜Reports the current measured speed of the selected motor.',
    'home.blockGuide.motor_stalled':
        'Motor stalled?｜Reports true when the selected motor is obstructed and cannot turn as requested.',
    'home.blockGuide.drive_move_for':
        'Move straight for an amount｜Runs the current left and right motor pair forward or backward for ' +
        'rotations, degrees or seconds.',
    'home.blockGuide.drive_steer_for':
        'Steer for an amount｜Uses a steering value to vary the two motor speeds for a set distance or time.',
    'home.blockGuide.drive_start_steer':
        'Start steering｜Drives continuously with the given steering value until a Stop movement block runs.',
    'home.blockGuide.drive_stop': 'Stop movement｜Stops both motors in the current drive pair.',
    'home.blockGuide.drive_set_speed':
        'Set movement speed｜Sets the default speed percentage for later movement blocks.',
    'home.blockGuide.drive_set_pair':
        'Set left and right motors｜Selects the motor ports used as the left and right drive motors.',
    'home.blockGuide.drive_set_stop_action':
        'Set movement stop action｜Chooses hold-position or coast behavior for both drive motors.',
    'home.blockGuide.drive_steer_for_speed':
        'Steer an amount at a speed｜Moves with a given speed and steering value for rotations, degrees ' +
        'or seconds.',
    'home.blockGuide.drive_dual_speed_for':
        'Run two speeds for an amount｜Sets separate left and right speeds for a number of rotations, ' +
        'degrees or seconds.',
    'home.blockGuide.drive_start_steer_speed':
        'Start steering at speed｜Continuously drives both motors with a given speed and steering value.',
    'home.blockGuide.drive_start_dual_speed':
        'Start with two speeds｜Continuously drives with separate left and right speeds for tank turns ' +
        'or differential motion.',
    'home.blockGuide.drive_line_follow_init':
        'Initialize PWM line following｜Clears the previous controller error; run it once before the ' +
        'line-following loop.',
    'home.blockGuide.drive_line_follow_dual_step':
        'Run one dual-input PWM step｜Uses left and right inputs, base powers, Kp and Kd to update both ' +
        'motors once; normally placed in a loop.',
    'home.blockGuide.display_image_for':
        'Show image for a time｜Shows the selected image on the hub for the given number of seconds, ' +
        'then continues.',
    'home.blockGuide.display_image':
        'Show image｜Shows an image immediately and keeps it visible until another display action.',
    'home.blockGuide.display_draw':
        'Draw a custom image｜Opens a 180 x 128 monochrome canvas and shows the drawing on the hub.',
    'home.blockGuide.display_text_line':
        'Write text on a line｜Writes text to a selected display line for quick multi-line layouts.',
    'home.blockGuide.display_text_xy':
        'Write text at coordinates｜Writes text in the selected font at the given X and Y position.',
    'home.blockGuide.display_clear': 'Clear display｜Removes all images and text from the hub display.',
    'home.blockGuide.display_status_light':
        'Set status light｜Sets the hub status light to off, red or blue.',
    'home.blockGuide.sound_play_wait':
        'Play sound until done｜Plays the selected sound and waits for it to finish before continuing.',
    'home.blockGuide.sound_play':
        'Start sound｜Starts the selected sound and continues immediately without waiting.',
    'home.blockGuide.sound_beep_for':
        'Play note for a time｜Plays the selected piano note for the given number of seconds, then stops it.',
    'home.blockGuide.sound_beep':
        'Start note｜Starts the selected piano note and continues until another sound replaces or stops it.',
    'home.blockGuide.sound_stop_all': 'Stop all sounds｜Immediately stops the current sound or note.',
    'home.blockGuide.sound_set_volume': 'Set volume｜Sets the percentage volume used by later sounds.',
    'home.blockGuide.event_program_start':
        'When program starts｜Begins a stack underneath this block after the program is downloaded and run.',
    'home.blockGuide.event_brick_button':
        'When hub button changes｜Starts the stack when the selected hub button is pressed or released.',
    'home.blockGuide.event_condition':
        'When condition becomes true｜Watches a Boolean condition and starts the stack when it becomes true.',
    'home.blockGuide.event_broadcast_received':
        'When broadcast received｜Starts the stack after receiving the selected message.',
    'home.blockGuide.event_broadcast':
        'Broadcast｜Sends the selected message and continues without waiting for receiving stacks to finish.',
    'home.blockGuide.event_broadcast_wait':
        'Broadcast and wait｜Sends the selected message and waits for the stacks it starts to finish.',
    'home.blockGuide.event_timer':
        'When timer exceeds value｜Starts the stack when the program timer becomes greater than the given time.',
    'home.blockGuide.control_wait_seconds':
        'Wait seconds｜Pauses the current stack for a time while other stacks can keep running.',
    'home.blockGuide.control_wait_until':
        'Wait until｜Pauses the current stack until the given condition becomes true.',
    'home.blockGuide.control_repeat': 'Repeat｜Runs the blocks inside it the given number of times.',
    'home.blockGuide.control_forever':
        'Forever｜Continues running the blocks inside it until the stack or program is stopped.',
    'home.blockGuide.control_repeat_until':
        'Repeat until｜Repeats the blocks while the condition is false and exits when it becomes true.',
    'home.blockGuide.control_if': 'If｜Runs the blocks inside only when the condition is true.',
    'home.blockGuide.control_if_else':
        'If / else｜Runs the first branch when the condition is true and the second branch otherwise.',
    'home.blockGuide.control_stop_other_stacks':
        'Stop other stacks｜Stops all running stacks in the project except the current one.',
    'home.blockGuide.control_stop':
        'Stop stack or program｜Stops the current stack or the whole user program according to the menu option.',
    'home.blockGuide.sensor_brick_button_value':
        'Hub button value｜Reports the numeric value for the hub’s current button state.',
    'home.blockGuide.sensor_brick_button_pressed':
        'Hub button pressed?｜Reports whether the selected hub button is currently pressed.',
    'home.blockGuide.sensor_wait_brick_button':
        'Wait for hub button｜Pauses the current stack until the selected button is pressed or released.',
    'home.blockGuide.sensor_color_reflection':
        'Reflected light｜Reports the reflected-light percentage from the color sensor on the selected port.',
    'home.blockGuide.sensor_color_reflection_compare':
        'Compare reflected light｜Compares reflected light with a percentage and reports true or false.',
    'home.blockGuide.sensor_color_ambient':
        'Ambient light｜Reports ambient-light intensity from the color sensor on the selected port.',
    'home.blockGuide.sensor_color_ambient_compare':
        'Compare ambient light｜Compares ambient light with a percentage and reports true or false.',
    'home.blockGuide.sensor_color_value':
        'Read color｜Reports the color identified by the sensor on the selected port.',
    'home.blockGuide.sensor_color_is':
        'Color is?｜Reports whether the current detected color matches the selected color.',
    'home.blockGuide.sensor_wait_color':
        'Wait for color｜Pauses the stack until the selected color or color-change event occurs.',
    'home.blockGuide.sensor_temperature':
        'Read temperature｜Reports Celsius or Fahrenheit from the temperature sensor on the selected port.',
    'home.blockGuide.sensor_touch_pressed':
        'Touch sensor pressed?｜Reports whether the touch sensor on the selected port is pressed.',
    'home.blockGuide.sensor_wait_touch':
        'Wait for touch｜Pauses the stack until the touch sensor is pressed or released.',
    'home.blockGuide.sensor_ultrasonic_distance':
        'Ultrasonic distance｜Reports the measured distance in the selected unit.',
    'home.blockGuide.sensor_ultrasonic_compare':
        'Compare ultrasonic distance｜Compares the measured distance with a value and reports true or false.',
    'home.blockGuide.sensor_wait_ultrasonic':
        'Wait for ultrasonic distance｜Pauses the stack until the distance matches the comparison.',
    'home.blockGuide.sensor_ir_proximity':
        'Infrared proximity｜Reports relative proximity measured by the infrared sensor.',
    'home.blockGuide.sensor_ir_proximity_compare':
        'Compare infrared proximity｜Compares proximity with a percentage and reports true or false.',
    'home.blockGuide.sensor_wait_ir_proximity':
        'Wait for infrared proximity｜Pauses the stack until proximity matches the comparison.',
    'home.blockGuide.sensor_wait_ir_beacon_button':
        'Wait for infrared beacon button｜Waits for the selected channel 1 infrared beacon button event.',
    'home.blockGuide.sensor_gyro_angle':
        'Gyro angle｜Reports the angle measured from the gyro’s last reset position.',
    'home.blockGuide.sensor_gyro_rate':
        'Gyro rate｜Reports the current rotational speed measured by the gyro.',
    'home.blockGuide.sensor_gyro_reset':
        'Reset gyro angle｜Sets the gyro’s current direction to zero degrees.',
    'home.blockGuide.sensor_gyro_compare':
        'Compare gyro angle｜Compares the current angle with a value and reports true or false.',
    'home.blockGuide.sensor_wait_gyro':
        'Wait for gyro angle｜Pauses the stack until the angle matches the comparison.',
    'home.blockGuide.sensor_timer': 'Timer｜Reports the seconds elapsed since the timer was last reset.',
    'home.blockGuide.sensor_timer_reset': 'Reset timer｜Sets the program timer to zero and restarts it.',
    'home.blockGuide.operator_add': 'Add｜Reports the sum of two numbers.',
    'home.blockGuide.operator_subtract': 'Subtract｜Reports the first number minus the second.',
    'home.blockGuide.operator_multiply': 'Multiply｜Reports the product of two numbers.',
    'home.blockGuide.operator_divide': 'Divide｜Reports the first number divided by the second.',
    'home.blockGuide.operator_random': 'Random｜Reports a random number between the two limits.',
    'home.blockGuide.operator_gt': 'Greater than｜Reports whether the left value is greater than the right.',
    'home.blockGuide.operator_lt': 'Less than｜Reports whether the left value is less than the right.',
    'home.blockGuide.operator_equals': 'Equals｜Reports whether two values or pieces of text are equal.',
    'home.blockGuide.operator_and': 'And｜Reports true only when both input conditions are true.',
    'home.blockGuide.operator_or': 'Or｜Reports true when at least one input condition is true.',
    'home.blockGuide.operator_not': 'Not｜Reverses the true or false result of the input condition.',
    'home.blockGuide.operator_join': 'Join text｜Combines two pieces of text in order.',
    'home.blockGuide.operator_letter_of':
        'Character at position｜Reports one character at the selected position in text.',
    'home.blockGuide.operator_length': 'Text length｜Reports the number of characters in the input text.',
    'home.blockGuide.operator_contains':
        'Text contains?｜Reports whether the first text contains the second.',
    'home.blockGuide.operator_mod':
        'Remainder｜Reports the remainder after dividing the first number by the second.',
    'home.blockGuide.operator_round': 'Round｜Rounds a number to its nearest integer.',
    'home.blockGuide.operator_mathop':
        'Math function｜Applies the selected function, such as absolute value, square root or trigonometry.',
    'home.blockGuide.data_variable':
        'Variable value｜Reports the current value of a variable for value, text or port inputs.',
    'home.blockGuide.data_setvariableto': 'Set variable to｜Replaces the selected variable with a value.',
    'home.blockGuide.data_changevariableby':
        'Change variable by｜Adds a number to the selected variable’s current numeric value.',
    'home.blockGuide.data_listcontents': 'List contents｜Reports every item currently stored in a list.',
    'home.blockGuide.data_addtolist': 'Add to list｜Appends a new item to the end of the selected list.',
    'home.blockGuide.data_deleteoflist': 'Delete list item｜Deletes one item at a selected list position.',
    'home.blockGuide.data_deletealloflist': 'Delete all list items｜Clears the selected list.',
    'home.blockGuide.data_insertatlist': 'Insert list item｜Inserts a new item at a selected position.',
    'home.blockGuide.data_replaceitemoflist': 'Replace list item｜Changes an item at a selected position.',
    'home.blockGuide.data_itemoflist': 'Read list item｜Reports the item at a selected position.',
    'home.blockGuide.data_itemnumoflist':
        'Find item position｜Reports the first position where a value appears in the list.',
    'home.blockGuide.data_lengthoflist': 'List length｜Reports how many items the selected list contains.',
    'home.blockGuide.data_listcontainsitem':
        'List contains item?｜Reports whether the selected list contains the given value.',
    'home.blockGuide.procedures_definition':
        'Define My Block｜Names a reusable group of blocks and can add number, text or Boolean parameters.',
    'home.blockGuide.procedures_call':
        'Call My Block｜Runs an existing custom block and passes its current inputs to the parameters.',
    'home.dialog.ai.title': 'AI Coding Assistant',
    'home.dialog.ai.lead':
        'The AI Coding Assistant turns natural-language requests into EST block programs checked ' +
        'against local rules, then renders real block previews. You always decide whether to ' +
        'insert, replace, download or run the result.',
    'home.dialog.ai.openTitle': 'Open and use the panel',
    'home.dialog.ai.openImageAlt': 'The empty AI Coding Assistant panel in EST Studio',
    'home.dialog.ai.openImageCaption':
        'The AI Coding Assistant floats above the editor and does not modify the workspace on its own.',
    'home.dialog.ai.open1':
        'Return to the editor and choose AI Coding Assistant in the menu bar. Drag its header to ' +
        'move the floating panel.',
    'home.dialog.ai.open2':
        'Closing the panel keeps the current conversation. New conversation clears this session; ' +
        'use it for a different task or when the conversation becomes too long.',
    'home.dialog.ai.open3':
        'Press Enter to send or Shift+Enter for a new line. While generating, the Send button ' +
        'becomes Stop and can cancel the current request.',
    'home.dialog.ai.setupTitle': 'Connect an AI service',
    'home.dialog.ai.setupImageAlt': 'API settings for the AI Coding Assistant',
    'home.dialog.ai.setupImageCaption':
        'example.com, test-model and the hidden key in this image are test data. Do not copy them.',
    'home.dialog.ai.setup1':
        'For first use, choose Connect AI service at the bottom of the panel or open API settings ' +
        'from the top-right menu button.',
    'home.dialog.ai.setup2':
        'Choose an OpenAI, DeepSeek or local Ollama preset, or select No preset and enter fields ' +
        'manually. Presets only fill suggested fields and do not lock the provider.',
    'home.dialog.ai.setup3':
        'Enter the API URL and model ID supplied by the service. Remote services require the ' +
        'matching API key; an Ollama-style service on a loopback address can omit the key.',
    'home.dialog.ai.setup4':
        'Enable JSON mode only when the provider and selected model explicitly support it. Turn it ' +
        'off and retry if the service rejects the request format.',
    'home.dialog.ai.setup5':
        'Choose Confirm to save. You can begin when the footer shows Configured · provider / model. ' +
        'Changing the API URL requires a key that belongs to the new address.',
    'home.dialog.ai.setupNote':
        'API URLs must use HTTPS. HTTP is accepted only for localhost, 127.0.0.1 or the local IPv6 ' +
        'loopback address. Use only an endpoint you trust.',
    'home.dialog.ai.promptTitle': 'Describe a useful task',
    'home.dialog.ai.prompt1':
        'State the robot goal and, where possible, motor and sensor ports, left/right wheel roles, ' +
        'direction, speed, distance or time units, triggers, thresholds and stopping behavior.',
    'home.dialog.ai.prompt2':
        'For a complex task, generate the smallest runnable part first, then add sensor or vision ' +
        'logic, loops, variables, lists, My Blocks, custom drawing, display or sound in follow-up ' +
        'messages. The assistant can refine the previous proposal in the current conversation.',
    'home.dialog.ai.prompt3':
        'When EST is connected, the assistant reads one USB port snapshot and prefers detected ' +
        'devices. USB cannot know semantic roles such as left or right wheel, so state those roles.',
    'home.dialog.ai.prompt4':
        'You can chat and generate without connecting EST, but you must verify every port, device ' +
        'type and installation direction yourself.',
    'home.dialog.ai.applyTitle': 'Generate, preview and apply',
    'home.dialog.ai.applyImageAlt': 'AI-generated EST blocks with preview and apply controls',
    'home.dialog.ai.applyImageCaption':
        'Results first appear as real block previews. You must choose Replace workspace or Insert.',
    'home.dialog.ai.apply1':
        'The assistant may answer or ask for missing details first. Generated blocks appear only ' +
        'after it has a clear program proposal.',
    'home.dialog.ai.apply2':
        'EST Studio locally validates block types, inputs, ports and program structure before ' +
        'drawing the preview. A result that fails validation is not applied to the workspace.',
    'home.dialog.ai.apply3':
        'Review ports, direction, speed, units, thresholds, loops and stopping logic, and read any ' +
        'Program notes. Continue the conversation if something needs to change.',
    'home.dialog.ai.apply4':
        'Insert appends the stacks to the current workspace. Replace workspace asks for confirmation ' +
        'and then replaces the current blocks. Either operation can be restored with Undo.',
    'home.dialog.ai.apply5':
        'Applied means only that blocks entered the workspace. The AI never downloads or runs the ' +
        'program automatically; check it again, then use the editor Download or Run control.',
    'home.dialog.ai.applyNote':
        'Before testing on hardware, raise the wheels or provide a safe area and use low speed and ' +
        'short durations to verify direction and stopping. Always review AI-generated content.',
    'home.dialog.ai.scopeTitle': 'Current scope',
    'home.dialog.ai.scope1':
        'The assistant can generate event, motor, movement, display, sound, control, sensing, vision ' +
        'and operator blocks from the current EST toolbox, including several stacks in one proposal.',
    'home.dialog.ai.scope2':
        'It can create and use variables, lists and My Blocks. My Blocks support number, text and ' +
        'Boolean arguments, and it can generate custom bitmap data for the 180 × 128 hub display.',
    'home.dialog.ai.scope3':
        'It does not generate or execute arbitrary Python, XML or JavaScript, accept external image ' +
        'URLs, or apply unapproved raw Blockly mutations. Complete unsupported work separately.',
    'home.dialog.ai.scope4':
        'One proposal can contain at most 8 stacks and 256 blocks, with up to 24 levels of nesting. ' +
        'Split larger requests into smaller steps.',
    'home.dialog.ai.scope5':
        'The AI follows the supplied block catalog and value rules but can still misunderstand ' +
        'natural language, mechanisms, vision conditions or teaching intent. It does not replace ' +
        'preview review and hardware testing.',
    'home.dialog.ai.privacyTitle': 'Data, keys and costs',
    'home.dialog.ai.privacy1':
        'API settings and keys are encrypted on this computer. A key is used only with its saved ' +
        'API URL and is not automatically reused after the address changes.',
    'home.dialog.ai.privacy2':
        'Requests send this conversation, the required block rules and, when connected, one USB ' +
        'port snapshot to your configured AI endpoint. EST Studio does not automatically upload ' +
        'the entire current project.',
    'home.dialog.ai.privacy3':
        'Network access, availability, quotas, billing and data-handling rules for remote models ' +
        'come from the selected provider. EST Studio does not create an account or buy quota for you.',
    'home.dialog.ai.privacyNote':
        'Do not enter passwords, API keys, personal information or other sensitive content in a ' +
        'task description. Use only an AI service you trust and are authorized to access.',
    'home.dialog.ai.troubleshootTitle': 'Troubleshooting',
    'home.dialog.ai.troubleshoot1':
        'Cannot send: confirm that the footer says Configured and that the API URL, model ID and ' +
        'key all belong to the same service.',
    'home.dialog.ai.troubleshoot2':
        'For 400, 404 or 503, check the model ID, API URL and JSON mode. For 401 or 403, check the ' +
        'key and its permissions. For 402 or 429, check quota or wait before retrying.',
    'home.dialog.ai.troubleshoot3':
        'If a request exceeds 8 minutes or the connection drops, reduce the task and retry, then ' +
        'check the network, local Ollama service or remote provider status.',
    'home.dialog.ai.troubleshoot4':
        'For a validation or preview failure, split the task, state ports and parameters, then ' +
        'generate again. You can also use Check connection settings or Retry beside an error.',
    'home.dialog.software.title': 'Software information',
    'home.dialog.software.lead':
        'Current version: EST Studio {version}. This desktop visual programming app is made for ' +
        'EST.',
    'home.dialog.software.fileTitle': 'Project files',
    'home.dialog.software.file1':
        'EST Studio projects use the .ests extension. A saved project appears in Recent files for ' +
        'quick access.',
    'home.dialog.software.file2':
        'A recent-file card can open, rename or copy a project. Delete only removes it from the ' +
        'recent list; it does not delete the file from the computer.',
    'home.dialog.software.file3':
        'A recent entry may stop opening if the original file is moved or deleted outside EST ' +
        'Studio.',
    'home.dialog.software.workspaceTitle': 'Programming workspace',
    'home.dialog.software.workspace1':
        'The editor always uses EST upload mode, with no generic hardware selection or ' +
        'simulation/live-mode switch.',
    'home.dialog.software.workspace2':
        'Build logic in the blocks area. The Python panel shows the code generated from the ' +
        'current workspace.',
    'home.dialog.software.workspace3':
        'One project can contain several event stacks; generated code keeps their execution ' +
        'organized by stack.',
    'home.dialog.software.workspace4':
        'Vision is an optional per-project extension with recognition in a separate camera window. ' +
        'The AI Coding Assistant is a movable floating panel; neither downloads or runs a program ' +
        'automatically.',
    'home.dialog.software.updateTitle': 'Versions and updates',
    'home.dialog.software.update1':
        'The app version and EST firmware version are separate. Check both when the interface ' +
        'reports a compatibility problem.',
    'home.dialog.software.update2':
        'Hardware Status shows the firmware version and can install firmware when an update ' +
        'package is available.',
    'home.dialog.software.update3':
        'Back up important .ests files separately before moving to another computer or ' +
        'reinstalling the app.',
    'home.dialog.software.updateNote':
        'When reporting a problem, include the EST Studio version, firmware version, connection ' +
        'status and reproduction steps.',
    'home.dialog.about.title': 'About us',
    'home.dialog.about.lead':
        'EST Studio is a visual programming environment for the EST hub and its peripherals, ' +
        'joining building, coding and device testing in one flow.',
    'home.dialog.about.purposeTitle': 'What we aim to solve',
    'home.dialog.about.purpose1':
        'Let learners begin EST block programming without configuring generic hardware first.',
    'home.dialog.about.purpose2':
        'Give teachers and students one app for projects, building references, block and AI-assisted ' +
        'programming, vision interaction and device runs.',
    'home.dialog.about.purpose3':
        'Keep generated Python visible so learners can move gradually from block logic to text ' +
        'programming.',
    'home.dialog.about.foundationTitle': 'Technology and licenses',
    'home.dialog.about.foundation2':
        'It discovers EST over USB, converts blocks into Python programs that run on the device, ' +
        'and recognizes camera frames locally before sending structured vision data.',
    'home.dialog.about.foundation3':
        'The project retains MIT, Scratch Foundation and applicable trademark license files. ' +
        'Third-party names and marks belong to their owners.',
    'home.dialog.about.supportTitle': 'Prepare a support request',
    'home.dialog.about.support1':
        'Record what happened before the problem, the exact message shown and whether the issue ' +
        'repeats reliably.',
    'home.dialog.about.support2':
        'Include the app version, EST firmware version, Windows version and peripheral types in ' +
        'use.',
    'home.dialog.about.support3':
        'For project-specific issues, keep an .ests file that reproduces the problem and remove ' +
        'personal information you do not need to share.',
    'home.dialog.about.supportNote':
        'Check the matching guide on this page first; cable, port, firmware and block-input ' +
        'issues are often quick to rule out.',
    'home.dialog.build.title': 'Build guide',
    'home.dialog.build.body': 'This is placeholder content. It will be replaced with product build instructions.',
    'menu.hardwareStatus': 'Hardware Status',
    'status.disconnected': 'EST disconnected',
    'status.connected': 'EST connected',
    'status.upgradeRequired': 'EST upgrade required',
    'codeDrawer.expand': 'Expand Python code panel',
    'codeDrawer.collapse': 'Collapse Python code panel',
    'codeDrawer.resize': 'Drag to resize the Python code panel; double-click to reset',

    'programControls.group': 'EST program controls',
    'programControls.slotLabel': 'SLOT',
    'programControls.programSize': 'Program size: {used} / {limit} bytes',
    'programControls.programSizeWarning': 'Approaching capacity',
    'programControls.programSizeExceeded': 'Program exceeds device capacity',
    'programControls.previousSlot': 'Previous program slot',
    'programControls.nextSlot': 'Next program slot',
    'programControls.selectSlot': 'Select program slot',
    'programControls.selectSlotNumber': 'Select slot {slot}',
    'programControls.currentSlot': 'Current program slot {slot}',
    'programControls.downloadStart': 'Downloading to slot {slot}...',
    'programControls.downloadDone': 'Downloaded to slot {slot}',
    'programControls.runStart': 'Downloading and starting slot {slot}...',
    'programControls.runDone': 'Slot {slot} program started',
    'programControls.stopStart': 'Stopping program...',
    'programControls.stopDone': 'Program stopped',
    'programControls.failed': 'Operation failed',
    'programControls.errorTitle': 'EST program operation failed',
    'programControls.errorMessage': 'Could not complete the program operation.',
    'programControls.firmwareUpgradeRequired':
        'The current EST firmware does not support features used by this program. Upgrade to ' +
        'firmware that supports the required EST Studio features before running it.',
    'programControls.unknownError': 'Unknown error',
    'programControls.usbDisconnected': 'EST USB was disconnected. Reconnect EST and try again.',
    'programControls.stopProgram': 'Stop program',
    'programControls.runProgram': 'Run program',
    'programControls.runNeedsFirmware': 'Connect compatible firmware to run program',
    'programControls.downloadProgram': 'Download program',
    'programControls.downloadNeedsFirmware': 'Connect compatible firmware to download program',
    'migration.irChannelFixed':
        'EST infrared remote currently supports channel 1 only. Channels 2-4 in this project have ' +
        'been migrated to channel 1.',

    'hardware.title': 'Hardware Status',
    'hardware.subtitle': 'EST host and peripheral information',
    'hardware.refreshing': 'Refreshing...',
    'hardware.manualRefresh': 'Refresh',
    'hardware.close': 'Close hardware status',
    'hardware.runningNotice': 'Program is running; peripheral details are paused',
    'hardware.readError': 'Unable to read hardware status',
    'hardware.notConnected': 'EST disconnected',
    'hardware.connectionBattery': 'Connection and Battery',
    'hardware.connectionStatus': 'Connection',
    'hardware.connected': 'Connected',
    'hardware.disconnected': 'Disconnected',
    'hardware.firmwareVersion': 'Firmware',
    'hardware.protocolVersion': 'Protocol',
    'hardware.compatibility': 'Compatibility',
    'hardware.programCompatible': 'Ready to run current program',
    'hardware.battery': 'Battery',
    'hardware.adc': 'ADC',
    'hardware.sampleVoltage': 'Sample voltage',
    'hardware.motors': 'Motors',
    'hardware.sensors': 'Sensors',
    'hardware.connectedReadable': 'status readable',
    'hardware.noData': 'no data',
    'hardware.type': 'Type',
    'hardware.typeUnavailable': 'not provided',
    'hardware.output': 'Output',
    'hardware.power': 'Power',
    'hardware.angle': 'Angle',
    'hardware.state': 'State',
    'hardware.mode': 'Mode',
    'hardware.valid': 'Valid',
    'hardware.value': 'Value',
    'hardware.yes': 'yes',
    'hardware.no': 'no',
    'hardware.none': 'none',
    'hardware.unknown': 'unknown ({value})',
    'firmware.updateButton': 'Firmware Update',
    'firmware.menuAria': 'Firmware update options',
    'firmware.upgradeEstOs': 'Upgrade EST OS',
    'firmware.downgradeLegacyEst': 'Downgrade to old EST',
    'firmware.confirmTitle': 'Confirm firmware update',
    'firmware.confirmAction': 'Continue',
    'firmware.cancelAction': 'Cancel',
    'firmware.upgradeConfirmMessage': 'Upgrade to the latest EST OS?',
    'firmware.upgradeConfirmDetail':
        'Keep EST connected by USB. Do not unplug it or close the app during the update.',
    'firmware.downgradeConfirmMessage': 'Downgrade to the old EST system?',
    'firmware.downgradeConfirmDetail':
        'Use this for old project compatibility. Keep EST connected by USB during the downgrade.',
    'firmware.updateRunning': 'Updating firmware. Keep EST connected...',
    'firmware.audioSyncRunning': 'Syncing sound resources. Keep EST connected and do not use the device...',
    'firmware.updateDone': 'Firmware update complete: {version}',
    'firmware.updateWithAudioDone': 'Firmware and sound resources updated: {version}',
    'firmware.successTitle': 'Firmware update complete',
    'firmware.successMessage': 'EST has been updated to {version}',
    'firmware.successWithAudioTitle': 'Firmware and sound resources updated',
    'firmware.successWithAudioMessage': 'EST has been updated to {version}, and sound resources are synchronized',
    'firmware.successDetail': 'Package: {path}\nSHA-256: {sha256}',
    'firmware.errorTitle': 'Firmware update failed',
    'firmware.errorMessage': 'Could not complete the EST firmware update.',
    'firmware.busy': 'Updating...',

    'category.motor': 'Motor',
    'category.movement': 'Move',
    'category.display': 'Display',
    'category.sound': 'Play',
    'category.event': 'Events',
    'category.control': 'Control',
    'category.sensing': 'Sensors',

    'icon.divider': 'Divider',
    'icon.motor': 'Motor',
    'icon.drive': 'Drive base',
    'icon.display': 'Display',
    'icon.music': 'Music',
    'icon.event': 'Event',
    'icon.host': 'Host',
    'icon.button': 'Button',
    'icon.color': 'Color',
    'icon.temperature': 'Temperature',
    'icon.ultrasonic': 'Ultrasonic',
    'icon.ir': 'Infrared',
    'icon.gyro': 'Gyro',
    'history.undo': 'Undo',
    'history.redo': 'Redo',
    'steering.left': 'left',
    'steering.right': 'right',
    'steering.forward': 'forward',

    'block.motor.runFor': '%1 %2 run for %3 %4',
    'block.motor.start': '%1 %2 start motor',
    'block.motor.stop': '%1 stop motor',
    'block.motor.setSpeed': '%1 set speed to %2 %%',
    'block.motor.setStopAction': '%1 set motor stop action to %2',
    'block.motor.runForSpeed': '%1 run at %2 %% speed for %3 %4',
    'block.motor.startSpeed': '%1 start motor at %2 %% speed',
    'block.motor.startPower': '%1 start motor at %2 %% power',
    'block.motor.resetDegrees': '%1 reset degrees counted',
    'block.motor.degrees': '%1 degrees counted',
    'block.motor.speed': '%1 speed',
    'block.motor.stalled': 'motor %1 is stalled?',

    'block.movement.moveFor': 'move %1 for %2 %3',
    'block.movement.steerFor': 'steer %1 for %2 %3',
    'block.movement.startSteer': 'start steering %1',
    'block.movement.stop': 'stop moving',
    'block.movement.setSpeed': 'set move speed to %1 %%',
    'block.movement.setPair': 'set drive motors to %1 and %2',
    'block.movement.setStopAction': 'set drive motors stop action to %1',
    'block.movement.steerForSpeed': 'at %1 %% speed steer %2 for %3 %4',
    'block.movement.dualSpeedFor': 'move at %1 %2 %% speed for %3 %4',
    'block.movement.startSteerSpeed': 'at %1 %% speed start steering %2',
    'block.movement.startDualSpeed': 'start moving at %1 %2 %% speed',
    'block.movement.lineFollowInit': 'initialize PWM line follow parameters',
    'block.movement.lineFollowDualStep':
        'dual-input PWM line follow left %1 right %2 left base power %3 ' +
        'right base power %4 Kp %5 Kd %6',

    'block.display.imageFor': 'show %1 for %2 seconds',
    'block.display.image': 'show %1',
    'block.display.draw': 'draw image %1',
    'block.display.textLine': 'write %2 on line %1',
    'block.display.textXY': 'with font %1 write %4 at %2 , %3',
    'block.display.clear': 'clear display',
    'block.display.statusLight': 'set status light to %1',
    'drawing.title': 'Draw an EST screen image',
    'drawing.canvas': 'EST monochrome pixel canvas',
    'drawing.empty': 'Draw',
    'drawing.edit': 'Edit image',
    'drawing.brush': 'Brush',
    'drawing.eraser': 'Eraser',
    'drawing.rectangleOutline': 'Outline rectangle (two opposite corners)',
    'drawing.rectangleFill': 'Filled rectangle (two opposite corners)',
    'drawing.circleOutline': 'Outline circle (center, then radius)',
    'drawing.circleFill': 'Filled circle (center, then radius)',
    'drawing.text': 'Text',
    'drawing.textPlaceholder': 'Text to convert',
    'drawing.textSize': 'Text size',
    'drawing.shapeBlack': 'Black shape',
    'drawing.shapeWhite': 'White shape (erase)',
    'drawing.shapeDraw': 'Draw',
    'drawing.shapeErase': 'Erase',
    'drawing.undo': 'Undo',
    'drawing.redo': 'Redo',
    'drawing.clear': 'Clear',
    'drawing.done': 'Done',
    'drawing.brushSize': 'Brush size {size}',

    'block.sound.playWait': 'play sound %1 until done',
    'block.sound.play': 'start sound %1',
    'block.sound.beepFor': 'play piano note %1 for %2 seconds',
    'block.sound.beep': 'start piano note %1',
    'block.sound.stopAll': 'stop all sounds',
    'block.sound.setVolume': 'set volume to %1 %%',

    'block.event.programStart': 'when program starts',
    'block.event.brickButton': 'when %1 button %2',
    'block.event.condition': 'when %1',
    'block.event.broadcastReceived': 'when I receive %1',
    'block.event.broadcast': 'broadcast %1',
    'block.event.broadcastWait': 'broadcast %1 and wait',
    'block.event.timer': 'when timer > %1',

    'block.control.waitSeconds': 'wait %1 seconds',
    'block.control.waitUntil': 'wait until %1',
    'block.control.repeat': 'repeat %1 times',
    'block.control.forever': 'forever',
    'block.control.repeatUntil': 'repeat until %1',
    'block.control.if': 'if %1 then',
    'block.control.else': 'else',
    'block.control.stopOtherStacks': 'stop other stacks',
    'block.control.stop': 'stop %1',

    'block.sensing.buttonValue': 'button',
    'block.sensing.buttonPressed': '%1 button pressed?',
    'block.sensing.waitButton': 'wait until %1 button %2',
    'block.sensing.reflection': '%1 reflected light intensity',
    'block.sensing.reflectionCompare': '%1 reflected light intensity %2 %3 %%?',
    'block.sensing.ambient': '%1 ambient light intensity',
    'block.sensing.ambientCompare': '%1 ambient light intensity %2 %3 %%?',
    'block.sensing.colorValue': '%1 color',
    'block.sensing.colorIs': '%1 color is %2?',
    'block.sensing.waitColor': '%1 wait until color is %2',
    'block.sensing.temperature': '%1 temperature in %2',
    'block.sensing.touchPressed': '%1 pressed?',
    'block.sensing.waitTouch': '%1 wait until %2',
    'block.sensing.ultrasonicDistance': '%1 distance in %2',
    'block.sensing.ultrasonicCompare': '%1 distance %2 %3 %4?',
    'block.sensing.waitUltrasonic': '%1 wait until distance %2 %3 %4',
    'block.sensing.irProximity': '%1 proximity',
    'block.sensing.irProximityCompare': '%1 proximity %2 %3 %%?',
    'block.sensing.waitIrProximity': '%1 wait until proximity %2 %3 %%',
    'block.sensing.waitIrBeaconButton': '%1 wait until beacon %2 %3',
    'block.sensing.gyroAngle': '%1 angle',
    'block.sensing.gyroRate': '%1 angular velocity',
    'block.sensing.gyroReset': '%1 reset angle',
    'block.sensing.gyroCompare': '%1 angle %2 %3°?',
    'block.sensing.waitGyro': '%1 wait until angle %2 %3°',
    'block.sensing.timer': 'timer',
    'block.sensing.timerReset': 'reset timer',

    'option.motorDirection.clockwise': 'clockwise',
    'option.motorDirection.counterclockwise': 'counterclockwise',
    'option.driveDirection.forward': 'forward',
    'option.driveDirection.backward': 'backward',
    'option.motorUnit.rotations': 'rotations',
    'option.motorUnit.degrees': 'degrees',
    'option.motorUnit.seconds': 'seconds',
    'option.stopAction.hold': 'hold position',
    'option.stopAction.float': 'coast',
    'option.font.regular_black': 'regular black',
    'option.font.bold_black': 'bold black',
    'option.font.large_black': 'large black',
    'option.font.regular_white': 'regular white',
    'option.font.bold_white': 'bold white',
    'option.font.large_white': 'large white',
    'option.statusLight.off': 'off',
    'option.statusLight.red': 'red',
    'option.statusLight.blue': 'blue',
    'option.sound.pianoPrefix': 'Piano',
    'option.sound.communication_hello': 'Communication / Hello',
    'option.touchEvent.pressed': 'pressed',
    'option.touchEvent.released': 'released',
    'option.comparator.less': 'less than (<)',
    'option.comparator.greater': 'greater than (>)',
    'option.comparator.equal': 'equal to (=)',
    'option.comparator.changed': 'changed by',
    'option.color.none': 'none',
    'option.color.black': 'black',
    'option.color.blue': 'blue',
    'option.color.green': 'green',
    'option.color.yellow': 'yellow',
    'option.color.red': 'red',
    'option.color.white': 'white',
    'option.color.brown': 'brown',
    'option.colorEvent.changed': 'changed',
    'option.temperatureUnit.celsius': 'celsius',
    'option.temperatureUnit.fahrenheit': 'fahrenheit',
    'option.beaconEvent.top_left_pressed': 'top-left button pressed',
    'option.beaconEvent.bottom_left_pressed': 'bottom-left button pressed',
    'option.beaconEvent.left_released': 'left buttons released',
    'option.beaconEvent.top_right_pressed': 'top-right button pressed',
    'option.beaconEvent.bottom_right_pressed': 'bottom-right button pressed',
    'option.beaconEvent.right_released': 'right buttons released',
    'option.beaconEvent.active': 'beacon is active',
    'option.brickButton.none': 'none',
    'option.brickButton.back': 'back',
    'option.brickButton.left': 'left',
    'option.brickButton.confirm': 'confirm',
    'option.brickButton.right': 'right',
    'option.brickButton.up': 'up',
    'option.brickButton.down': 'down',
    'option.distanceUnit.centimeters': 'centimeters',
    'option.distanceUnit.inches': 'inches',
    'option.message.message_1': 'message1',
    'option.message.message_2': 'message2',
    'option.message.message_3': 'message3',
    'option.message.message_4': 'message4',
    'option.message.message_5': 'message5',
    'option.message.message_6': 'message6',
    'option.message.message_7': 'message7',
    'option.message.message_8': 'message8',
    'option.stopScope.this_stack': 'this stack',
    'option.stopScope.all': 'all'
};

const ptBR = {
    ...en,
    'home.blockGuide.vision_valid': 'Alvo visual válido｜Lê o estado recente da mão esquerda, direita, corpo ou rosto.',
    'home.blockGuide.vision_gesture': 'Comparar gesto｜Lê as duas mãos separadamente no mesmo programa.',
    'home.blockGuide.vision_class': 'Código da classe visual｜Retorna a classe do alvo ou -1 se inválido.',
    'home.blockGuide.vision_position': 'Posição e tamanho｜Retorna coordenadas ou tamanho do alvo, 0–100.',
    'block.vision.valid': 'visão %1 válida?',
    'block.vision.waitState': 'esperar até visão %1 ficar %2',
    'block.vision.waitGesture': 'esperar até visão %1 ser %2',
    'vision.valid': 'válido', 'vision.invalid': 'inválido',
    'category.vision': 'Visão',
    'vision.removedEvents': 'O projeto contém blocos de evento visual removidos. A abertura foi cancelada para preservar o programa. Substitua esses blocos na versão anterior antes de abrir aqui.',
    'extension.vision.description': 'Reconheça gestos, ações faciais e posturas com a câmera. Envie o alvo selecionado ao EST.',
    'block.vision.face.detected': 'rosto detectado?',
    'block.vision.face.action': 'ação facial é %1 ?',
    'block.vision.face.wait': 'esperar até ação facial ser %1',
    'block.vision.pose.detected': 'corpo detectado?',
    'block.vision.pose.action': 'postura é %1 ?',
    'block.vision.pose.wait': 'esperar até postura ser %1',
    'vision.face.natural': 'neutra', 'vision.face.smile': 'sorriso',
    'vision.face.blink': 'piscar', 'vision.face.mouth': 'boca aberta',
    'vision.pose.standing': 'em pé', 'vision.pose.leftUp': 'mão esquerda levantada',
    'vision.pose.rightUp': 'mão direita levantada', 'vision.pose.bothUp': 'duas mãos levantadas',
    'vision.pose.squat': 'agachado', 'vision.pose.leanLeft': 'inclinado à esquerda', 'vision.pose.leanRight': 'inclinado à direita',
    'home.blockGuide.vision_face_detected': 'Rosto detectado｜Lê diretamente o cache do rosto. Ative ações faciais na câmera.',
    'home.blockGuide.vision_face_action': 'Ação facial｜Compara sorriso, piscar, boca aberta ou neutra. Pode combinar ações; não identifica pessoas nem emoções.',
    'home.blockGuide.vision_wait_face': 'Esperar ação facial｜Espera a ação do rosto transmitido. Sem alvo, continua esperando.',
    'home.blockGuide.vision_pose_detected': 'Corpo detectado｜Lê diretamente o cache do corpo. Ative postura na câmera.',
    'home.blockGuide.vision_pose_action': 'Postura｜Compara posição em pé, mãos levantadas, agachamento ou inclinação por pontos visíveis.',
    'home.blockGuide.vision_wait_pose': 'Esperar postura｜Espera a postura transmitida sem alterar o alvo da câmera.',
    'home.blockGuide.mode.vision.target': 'Alvos reconhecidos｜O computador envia mãos, corpo e rosto ao mesmo tempo.',
    'home.blockGuide.vision_wait_state': 'Esperar estado visual｜Continua se a condição já for verdadeira; permite outras tarefas durante a espera.',
    'home.blockGuide.vision_wait_gesture': 'Esperar gesto｜Espera o cache da mão escolhida sem afetar outros tipos visuais.',
    'block.vision.gesture': 'visão %1 é %2?',
    'block.vision.class': 'código da visão %1',
    'block.vision.position': '%2 da visão %1 (0–100)',
    'vision.cameraRunning': 'Visão · Câmera ativa',
    'vision.settings': 'Ver câmera',
    'vision.stopCamera': 'Parar câmera',
    'vision.left': 'mão esquerda', 'vision.right': 'mão direita', 'vision.pose': 'corpo', 'vision.face': 'rosto',
    'vision.palm': 'palma aberta', 'vision.fist': 'punho fechado', 'vision.thumb': 'polegar para cima',
    'vision.point': 'apontar', 'vision.victory': 'vitória', 'vision.other': 'outro gesto',
    'vision.x': 'X', 'vision.y': 'Y', 'vision.width': 'largura', 'vision.height': 'altura',
    'menu.home': 'Inicio',
    'home.navigation': 'Navegacao inicial',
    'home.nav.files': 'Arquivos',
    'home.nav.build': 'Montagem',
    'home.nav.more': 'Outros',
    'home.startLine1': 'Comece aqui',
    'home.startLine2': 'Crie um novo programa',
    'home.start': 'Iniciar',
    'home.returnToEditor': 'Voltar ao editor',
    'home.productImages': 'Imagens de produtos EST',
    'home.animation.label': 'Blocos controlando braco, robo e carro robotico',
    'home.animation.eventBlock': 'Iniciar programa',
    'home.animation.motorBlock': 'Iniciar motor',
    'home.animation.displayBlock': 'Mostrar sorriso',
    'home.animation.arm.title': 'Braco robotico',
    'home.animation.arm.event': 'Iniciar programa',
    'home.animation.arm.action': 'Levantar braco',
    'home.animation.arm.result': 'Objeto preso',
    'home.animation.robot.title': 'Robo',
    'home.animation.robot.event': 'Iniciar programa',
    'home.animation.robot.action': 'Acenar braco',
    'home.animation.robot.result': 'Mostrar sorriso',
    'home.animation.car.title': 'Carro robotico',
    'home.animation.car.event': 'Iniciar programa',
    'home.animation.car.action': 'Avancar',
    'home.animation.car.result': 'Acender luz',
    'home.recentFiles': 'Arquivos recentes',
    'home.noRecentFiles': 'Ainda nao ha arquivos recentes',
    'home.noRecentFilesHint': 'Projetos novos e salvos aparecerao aqui.',
    'home.open': 'Abrir',
    'home.openFailed': 'Nao foi possivel abrir este projeto.',
    'home.replaceWarning': 'O projeto atual tem alteracoes nao salvas. Deseja substitui-lo?',
    'home.fileActions': 'Mais acoes',
    'home.delete': 'Excluir',
    'home.rename': 'Renomear',
    'home.copy': 'Copiar',
    'home.copyDone': 'Copia do projeto criada.',
    'home.copyFailed': 'Nao foi possivel copiar este projeto.',
    'home.renameFailed': 'Nao foi possivel renomear este projeto.',
    'home.fileName': 'Nome do arquivo',
    'home.cancel': 'Cancelar',
    'home.confirm': 'OK',
    'home.close': 'Fechar',
    'home.language': 'Idioma',
    'home.build.title': 'Cursos de montagem',
    'home.build.subtitle': 'Escolha um modelo para abrir o guia de montagem em PDF',
    'home.build.categories': 'Categorias de montagem',
    'home.build.category.basic': 'Curriculo basico',
    'home.build.category.pbl': 'Projeto PBL',
    'home.build.guide': 'Abrir guia de montagem PDF',
    'home.build.openFailed': 'Nao foi possivel abrir este guia de montagem.',
    'home.build.libraryDownload': 'Baixar a biblioteca completa de montagem',
    'home.build.libraryDownloadHint':
        'Adiciona {count} projetos (cerca de 43,6 MB). Os 8 projetos incluidos funcionam offline.',
    'home.build.libraryReady': 'Biblioteca completa instalada',
    'home.build.libraryReadyHint': '{count} projetos de montagem estao prontos para abrir.',
    'home.build.downloadButton': 'Baixar',
    'home.build.downloadPhase.checking': 'Verificando',
    'home.build.downloadPhase.downloading': 'Baixando {percent}%',
    'home.build.downloadPhase.extracting': 'Extraindo',
    'home.build.downloadPhase.verifying': 'Validando',
    'home.build.downloadPhase.complete': 'Concluido',
    'home.build.downloadPaused': 'Pausado em {percent}%',
    'home.build.downloadCancelling': 'Cancelando',
    'home.build.pauseButton': 'Pausar',
    'home.build.resumeButton': 'Continuar',
    'home.build.cancelButton': 'Cancelar',
    'home.build.downloadComplete': 'A biblioteca completa de montagem esta pronta.',
    'home.build.downloadCancelled': 'O download foi cancelado e os arquivos temporarios foram removidos.',
    'home.build.downloadFailed': 'O download falhou. Os 8 projetos incluidos continuam disponiveis.',
    'home.build.item.basic01': 'Aranha rastejante',
    'home.build.item.basic02': 'Carro em movimento',
    'home.build.item.basic04': 'Cao robotico',
    'home.build.item.basic13': 'Guarda de radar',
    'home.build.item.pbl01': 'Transporte preciso e robo de classificacao',
    'home.build.item.pbl04': 'Robo bipede',
    'home.build.item.pbl07': 'Classificador de cores',
    'home.build.item.pbl14': 'Braco robotico',
    'home.more.interaction': 'Guia de software e hardware',
    'home.more.hardware': 'Guia de hardware',
    'home.more.blocks': 'Guia de blocos',
    'home.more.software': 'Informacoes do software',
    'home.more.about': 'Sobre nos',
    'home.dialog.software.title': 'Informacoes do software',
    'home.dialog.software.body': 'EST Studio {version}\nSoftware visual de programacao para desktop',
    'menu.hardwareStatus': 'Status do hardware',
    'status.disconnected': 'EST desconectado',
    'status.connected': 'EST conectado',
    'status.upgradeRequired': 'Atualize o EST',
    'codeDrawer.expand': 'Expandir painel de codigo Python',
    'codeDrawer.collapse': 'Recolher painel de codigo Python',
    'codeDrawer.resize': 'Arraste para ajustar o painel de codigo Python; duplo clique para restaurar',

    'programControls.group': 'Controles do programa EST',
    'programControls.slotLabel': 'ESPAÇO',
    'programControls.programSize': 'Programa: {used} / {limit} bytes',
    'programControls.programSizeWarning': 'Capacidade quase cheia',
    'programControls.programSizeExceeded': 'Programa excede a capacidade',
    'programControls.previousSlot': 'Slot anterior',
    'programControls.nextSlot': 'Proximo slot',
    'programControls.selectSlot': 'Selecionar slot do programa',
    'programControls.selectSlotNumber': 'Selecionar slot {slot}',
    'programControls.currentSlot': 'Slot atual {slot}',
    'programControls.downloadStart': 'Baixando para o slot {slot}...',
    'programControls.downloadDone': 'Baixado para o slot {slot}',
    'programControls.runStart': 'Baixando e iniciando o slot {slot}...',
    'programControls.runDone': 'Programa do slot {slot} iniciado',
    'programControls.stopStart': 'Parando programa...',
    'programControls.stopDone': 'Programa parado',
    'programControls.failed': 'Operacao falhou',
    'programControls.errorTitle': 'Falha na operacao do programa EST',
    'programControls.errorMessage': 'Nao foi possivel concluir a operacao do programa.',
    'programControls.firmwareUpgradeRequired':
        'O firmware atual do EST nao suporta recursos usados por este programa. Atualize para um ' +
        'firmware compativel antes de executar.',
    'programControls.unknownError': 'Erro desconhecido',
    'programControls.usbDisconnected': 'O USB do EST foi desconectado. Reconecte o EST e tente novamente.',
    'programControls.stopProgram': 'Parar programa',
    'programControls.runProgram': 'Executar programa',
    'programControls.runNeedsFirmware': 'Conecte um firmware compativel para executar',
    'programControls.downloadProgram': 'Baixar programa',
    'programControls.downloadNeedsFirmware': 'Conecte um firmware compativel para baixar',
    'migration.irChannelFixed':
        'O controle remoto infravermelho EST atualmente suporta apenas o canal 1. Os canais 2-4 ' +
        'deste projeto foram migrados para o canal 1.',

    'hardware.title': 'Status do hardware',
    'hardware.subtitle': 'Informacoes do host EST e perifericos',
    'hardware.refreshing': 'Atualizando...',
    'hardware.manualRefresh': 'Atualizar',
    'hardware.close': 'Fechar status do hardware',
    'hardware.runningNotice': 'Programa em execucao; detalhes dos perifericos pausados',
    'hardware.readError': 'Nao foi possivel ler o status do hardware',
    'hardware.notConnected': 'EST desconectado',
    'hardware.connectionBattery': 'Conexao e bateria',
    'hardware.connectionStatus': 'Conexao',
    'hardware.connected': 'Conectado',
    'hardware.disconnected': 'Desconectado',
    'hardware.firmwareVersion': 'Firmware',
    'hardware.protocolVersion': 'Protocolo',
    'hardware.compatibility': 'Compatibilidade',
    'hardware.programCompatible': 'Pronto para executar o programa atual',
    'hardware.battery': 'Bateria',
    'hardware.sampleVoltage': 'Tensao amostrada',
    'hardware.motors': 'Motores',
    'hardware.sensors': 'Sensores',
    'hardware.connectedReadable': 'status legivel',
    'hardware.noData': 'sem dados',
    'hardware.typeUnavailable': 'nao informado',
    'hardware.power': 'Potencia',
    'hardware.angle': 'Angulo',
    'hardware.valid': 'Valido',
    'hardware.value': 'Valor atual',
    'hardware.yes': 'sim',
    'hardware.no': 'nao',
    'firmware.updateButton': 'Atualizar firmware',
    'firmware.menuAria': 'Opcoes de atualizacao de firmware',
    'firmware.upgradeEstOs': 'Atualizar EST OS',
    'firmware.downgradeLegacyEst': 'Voltar ao EST antigo',
    'firmware.confirmTitle': 'Confirmar atualizacao de firmware',
    'firmware.confirmAction': 'Continuar',
    'firmware.cancelAction': 'Cancelar',
    'firmware.upgradeConfirmMessage': 'Atualizar para o EST OS mais recente?',
    'firmware.upgradeConfirmDetail':
        'Mantenha o EST conectado por USB. Nao desconecte nem feche o app durante a atualizacao.',
    'firmware.downgradeConfirmMessage': 'Voltar para o sistema EST antigo?',
    'firmware.downgradeConfirmDetail':
        'Use isto para compatibilidade com projetos antigos. Mantenha o EST conectado por USB durante o processo.',
    'firmware.updateRunning': 'Atualizando firmware. Mantenha o EST conectado...',
    'firmware.audioSyncRunning': 'Sincronizando sons. Mantenha o EST conectado e nao use o dispositivo...',
    'firmware.updateDone': 'Atualizacao de firmware concluida: {version}',
    'firmware.updateWithAudioDone': 'Firmware e sons atualizados: {version}',
    'firmware.successTitle': 'Atualizacao concluida',
    'firmware.successMessage': 'EST atualizado para {version}',
    'firmware.successWithAudioTitle': 'Firmware e sons atualizados',
    'firmware.successWithAudioMessage': 'EST atualizado para {version} e recursos de som sincronizados',
    'firmware.successDetail': 'Pacote: {path}\nSHA-256: {sha256}',
    'firmware.errorTitle': 'Falha na atualizacao',
    'firmware.errorMessage': 'Nao foi possivel concluir a atualizacao do firmware EST.',
    'firmware.busy': 'Atualizando...',

    'category.motor': 'Motor',
    'category.movement': 'Movimento',
    'category.display': 'Tela',
    'category.sound': 'Reproduzir',
    'category.event': 'Eventos',
    'category.control': 'Controle',
    'category.sensing': 'Sensores',

    'icon.drive': 'Conjunto de motores',
    'icon.music': 'Musica',
    'icon.button': 'Botao',
    'icon.temperature': 'Temperatura',
    'history.undo': 'Desfazer',
    'history.redo': 'Refazer',
    'steering.left': 'esq.',
    'steering.right': 'dir.',
    'steering.forward': 'frente',

    'block.motor.runFor': '%1 %2 executar por %3 %4',
    'block.motor.start': '%1 %2 iniciar motor',
    'block.motor.stop': '%1 parar motor',
    'block.motor.setSpeed': '%1 definir velocidade para %2 %%',
    'block.motor.setStopAction': '%1 definir acao ao parar como %2',
    'block.motor.runForSpeed': '%1 executar a %2 %% de velocidade por %3 %4',
    'block.motor.startSpeed': '%1 iniciar motor a %2 %% de velocidade',
    'block.motor.startPower': '%1 iniciar motor a %2 %% de potencia',
    'block.motor.resetDegrees': '%1 zerar graus percorridos',
    'block.motor.degrees': '%1 graus percorridos',
    'block.motor.speed': '%1 velocidade',
    'block.motor.stalled': 'motor %1 esta travado?',

    'block.movement.moveFor': 'mover %1 por %2 %3',
    'block.movement.steerFor': 'virar %1 por %2 %3',
    'block.movement.startSteer': 'comecar virando %1',
    'block.movement.stop': 'parar movimento',
    'block.movement.setSpeed': 'definir velocidade de movimento para %1 %%',
    'block.movement.setPair': 'definir motores de movimento para %1 e %2',
    'block.movement.setStopAction': 'definir acao ao parar motores como %1',
    'block.movement.steerForSpeed': 'a %1 %% de velocidade virar %2 por %3 %4',
    'block.movement.dualSpeedFor': 'mover a %1 %2 %% de velocidade por %3 %4',
    'block.movement.startSteerSpeed': 'a %1 %% de velocidade comecar virando %2',
    'block.movement.startDualSpeed': 'comecar movendo a %1 %2 %% de velocidade',
    'block.movement.lineFollowInit': 'inicializar parametros PWM de seguir linha',
    'block.movement.lineFollowDualStep':
        'seguir linha PWM esq. %1 dir. %2 potencia esq. %3 ' +
        'potencia dir. %4 Kp %5 Kd %6',

    'block.display.imageFor': 'mostrar %1 por %2 segundos',
    'block.display.image': 'mostrar %1',
    'block.display.draw': 'desenhar imagem %1',
    'block.display.textLine': 'escrever %2 na linha %1',
    'block.display.textXY': 'com fonte %1 escrever %4 em %2 , %3',
    'block.display.clear': 'limpar tela',
    'block.display.statusLight': 'definir luz de status como %1',
    'drawing.title': 'Desenhar imagem na tela EST',
    'drawing.canvas': 'Tela de pixels monocromatica do EST',
    'drawing.empty': 'Desenhar',
    'drawing.edit': 'Editar imagem',
    'drawing.brush': 'Pincel',
    'drawing.eraser': 'Borracha',
    'drawing.rectangleOutline': 'Retangulo sem preenchimento (dois cantos opostos)',
    'drawing.rectangleFill': 'Retangulo preenchido (dois cantos opostos)',
    'drawing.circleOutline': 'Circulo sem preenchimento (centro e raio)',
    'drawing.circleFill': 'Circulo preenchido (centro e raio)',
    'drawing.text': 'Texto',
    'drawing.textPlaceholder': 'Texto para converter',
    'drawing.textSize': 'Tamanho do texto',
    'drawing.shapeBlack': 'Forma preta',
    'drawing.shapeWhite': 'Forma branca (apagar)',
    'drawing.shapeDraw': 'Desenhar',
    'drawing.shapeErase': 'Apagar',
    'drawing.undo': 'Desfazer',
    'drawing.redo': 'Refazer',
    'drawing.clear': 'Limpar',
    'drawing.done': 'Concluir',
    'drawing.brushSize': 'Tamanho do pincel {size}',

    'block.sound.playWait': 'reproduzir som %1 ate terminar',
    'block.sound.play': 'iniciar som %1',
    'block.sound.beepFor': 'tocar nota de piano %1 por %2 segundos',
    'block.sound.beep': 'iniciar nota de piano %1',
    'block.sound.stopAll': 'parar todos os sons',
    'block.sound.setVolume': 'definir volume para %1 %%',

    'block.event.programStart': 'quando o programa iniciar',
    'block.event.brickButton': 'quando botao %1 %2',
    'block.event.condition': 'quando %1',
    'block.event.broadcastReceived': 'quando receber %1',
    'block.event.broadcast': 'enviar %1',
    'block.event.broadcastWait': 'enviar %1 e esperar',
    'block.event.timer': 'quando cronometro > %1',

    'block.control.waitSeconds': 'esperar %1 segundos',
    'block.control.waitUntil': 'esperar ate %1',
    'block.control.repeat': 'repetir %1 vezes',
    'block.control.forever': 'repetir sempre',
    'block.control.repeatUntil': 'repetir ate %1',
    'block.control.if': 'se %1 entao',
    'block.control.else': 'senao',
    'block.control.stopOtherStacks': 'parar outras pilhas',
    'block.control.stop': 'parar %1',

    'block.sensing.buttonValue': 'botao',
    'block.sensing.buttonPressed': 'botao %1 pressionado?',
    'block.sensing.waitButton': 'esperar ate botao %1 %2',
    'block.sensing.reflection': '%1 intensidade de luz refletida',
    'block.sensing.reflectionCompare': '%1 intensidade refletida %2 %3 %%?',
    'block.sensing.ambient': '%1 intensidade de luz ambiente',
    'block.sensing.ambientCompare': '%1 intensidade ambiente %2 %3 %%?',
    'block.sensing.colorValue': '%1 cor',
    'block.sensing.colorIs': '%1 cor e %2?',
    'block.sensing.waitColor': '%1 esperar ate cor ser %2',
    'block.sensing.temperature': '%1 temperatura em %2',
    'block.sensing.touchPressed': '%1 pressionado?',
    'block.sensing.waitTouch': '%1 esperar ate %2',
    'block.sensing.ultrasonicDistance': '%1 distancia em %2',
    'block.sensing.ultrasonicCompare': '%1 distancia %2 %3 %4?',
    'block.sensing.waitUltrasonic': '%1 esperar ate distancia %2 %3 %4',
    'block.sensing.irProximity': '%1 proximidade',
    'block.sensing.irProximityCompare': '%1 proximidade %2 %3 %%?',
    'block.sensing.waitIrProximity': '%1 esperar ate proximidade %2 %3 %%',
    'block.sensing.waitIrBeaconButton': '%1 esperar ate farol %2 %3',
    'block.sensing.gyroAngle': '%1 angulo',
    'block.sensing.gyroRate': '%1 velocidade angular',
    'block.sensing.gyroReset': '%1 zerar angulo',
    'block.sensing.gyroCompare': '%1 angulo %2 %3°?',
    'block.sensing.waitGyro': '%1 esperar ate angulo %2 %3°',
    'block.sensing.timer': 'cronometro',
    'block.sensing.timerReset': 'zerar cronometro',

    'option.motorDirection.clockwise': 'horario',
    'option.motorDirection.counterclockwise': 'anti-horario',
    'option.driveDirection.forward': 'frente',
    'option.driveDirection.backward': 'tras',
    'option.motorUnit.rotations': 'rotacoes',
    'option.motorUnit.degrees': 'graus',
    'option.motorUnit.seconds': 'segundos',
    'option.stopAction.hold': 'manter posicao',
    'option.stopAction.float': 'deslizar livre',
    'option.font.regular_black': 'regular preto',
    'option.font.bold_black': 'negrito preto',
    'option.font.large_black': 'grande preto',
    'option.font.regular_white': 'regular branco',
    'option.font.bold_white': 'negrito branco',
    'option.font.large_white': 'grande branco',
    'option.statusLight.off': 'desligada',
    'option.statusLight.red': 'vermelha',
    'option.statusLight.blue': 'azul',
    'option.sound.pianoPrefix': 'Piano',
    'option.touchEvent.pressed': 'pressionado',
    'option.touchEvent.released': 'solto',
    'option.comparator.less': 'menor que (<)',
    'option.comparator.greater': 'maior que (>)',
    'option.comparator.equal': 'igual a (=)',
    'option.comparator.changed': 'mudou por',
    'option.color.none': 'sem cor',
    'option.color.black': 'preto',
    'option.color.blue': 'azul',
    'option.color.green': 'verde',
    'option.color.yellow': 'amarelo',
    'option.color.red': 'vermelho',
    'option.color.white': 'branco',
    'option.color.brown': 'marrom',
    'option.colorEvent.changed': 'mudou',
    'option.temperatureUnit.celsius': 'Celsius',
    'option.temperatureUnit.fahrenheit': 'Fahrenheit',
    'option.beaconEvent.top_left_pressed': 'botao superior esquerdo pressionado',
    'option.beaconEvent.bottom_left_pressed': 'botao inferior esquerdo pressionado',
    'option.beaconEvent.left_released': 'botoes esquerdos soltos',
    'option.beaconEvent.top_right_pressed': 'botao superior direito pressionado',
    'option.beaconEvent.bottom_right_pressed': 'botao inferior direito pressionado',
    'option.beaconEvent.right_released': 'botoes direitos soltos',
    'option.beaconEvent.active': 'farol ativo',
    'option.brickButton.none': 'nenhum',
    'option.brickButton.back': 'voltar',
    'option.brickButton.left': 'esquerda',
    'option.brickButton.confirm': 'confirmar',
    'option.brickButton.right': 'direita',
    'option.brickButton.up': 'cima',
    'option.brickButton.down': 'baixo',
    'option.distanceUnit.centimeters': 'centimetros',
    'option.distanceUnit.inches': 'polegadas',
    'option.message.message_1': 'mensagem1',
    'option.message.message_2': 'mensagem2',
    'option.message.message_3': 'mensagem3',
    'option.message.message_4': 'mensagem4',
    'option.message.message_5': 'mensagem5',
    'option.message.message_6': 'mensagem6',
    'option.message.message_7': 'mensagem7',
    'option.message.message_8': 'mensagem8',
    'option.stopScope.this_stack': 'esta pilha',
    'option.stopScope.all': 'programa inteiro'
};

const zhTW = {
    ...zhCN,
    'menu.home': '首頁',
    'home.navigation': '首頁導覽',
    'home.nav.files': '檔案',
    'home.nav.build': '搭建',
    'home.nav.more': '其他',
    'home.startLine1': '從這裡開始',
    'home.startLine2': '建立新的程式',
    'home.start': '開始',
    'home.returnToEditor': '返回編輯',
    'home.recentFiles': '最近檔案',
    'home.noRecentFiles': '尚無最近檔案',
    'home.noRecentFilesHint': '新建或儲存作品後會顯示在這裡。',
    'home.open': '開啟',
    'home.openFailed': '無法開啟這個專案檔案。',
    'home.replaceWarning': '目前作品有尚未儲存的修改。確定要換成另一個作品嗎？',
    'home.fileActions': '更多操作',
    'home.delete': '刪除',
    'home.rename': '重新命名',
    'home.copy': '複製',
    'home.language': '語言設定',
    'home.build.item.basic02': '前進小車',
    'home.build.item.basic04': '電子寵物狗',
    'home.build.item.pbl01': '精準運輸與分揀機器人',
    'home.build.item.pbl04': '雙足機器人',
    'home.build.item.pbl07': '顏色分揀機',
    'home.more.interaction': '軟硬體互動指南',
    'home.more.hardware': '硬體說明',
    'home.more.blocks': '積木模組說明',
    'home.more.software': '軟體資訊',
    'home.more.about': '關於我們',
    'home.dialog.software.title': '軟體資訊',
    'home.dialog.software.body': 'EST Studio {version}\n桌面圖形化程式設計軟體',
    'menu.hardwareStatus': '硬體狀態',
    'status.disconnected': 'EST 未連線',
    'status.connected': 'EST 已連線',
    'status.upgradeRequired': 'EST 需升級',
    'programControls.usbDisconnected': 'EST USB 連線已中斷，請重新連接 EST 後再試。',
    'hardware.title': '硬體狀態',
    'hardware.subtitle': 'EST 主機與外設資訊',
    'hardware.notConnected': 'EST 未連線',
    'hardware.connectionBattery': '連線與電池',
    'hardware.connectionStatus': '連線狀態',
    'hardware.connected': '已連線',
    'hardware.disconnected': '未連線',
    'hardware.firmwareVersion': '韌體版本',
    'hardware.protocolVersion': '協定版本',
    'hardware.compatibility': '相容狀態',
    'hardware.programCompatible': '可執行目前程式',
    'hardware.sampleVoltage': '採樣電壓',
    'category.motor': '馬達',
    'category.movement': '移動',
    'category.display': '顯示',
    'category.sound': '播放',
    'category.event': '事件',
    'category.control': '控制',
    'category.sensing': '感測器',
    'block.display.draw': '繪製圖形 %1',
    'drawing.title': '繪製 EST 螢幕圖形',
    'drawing.canvas': 'EST 黑白像素畫板',
    'drawing.empty': '點擊繪製',
    'drawing.edit': '編輯圖形',
    'drawing.brush': '畫筆',
    'drawing.eraser': '橡皮擦',
    'drawing.rectangleOutline': '空心矩形（兩點確定對角）',
    'drawing.rectangleFill': '實心矩形（兩點確定對角）',
    'drawing.circleOutline': '空心圓形（第一點為圓心，第二點確定半徑）',
    'drawing.circleFill': '實心圓形（第一點為圓心，第二點確定半徑）',
    'drawing.text': '文字',
    'drawing.textPlaceholder': '輸入要轉換的文字',
    'drawing.textSize': '文字大小',
    'drawing.shapeBlack': '黑色圖形',
    'drawing.shapeWhite': '白色圖形（擦除）',
    'drawing.shapeDraw': '繪製',
    'drawing.shapeErase': '擦除',
    'drawing.undo': '復原',
    'drawing.redo': '重做',
    'drawing.clear': '清空',
    'drawing.done': '完成',
    'drawing.brushSize': '畫筆粗細 {size}',
    'option.brickButton.back': '返回',
    'option.brickButton.confirm': '確認'
};

const ru = {
    ...en,
    'menu.home': 'Главная',
    'home.navigation': 'Навигация главной страницы',
    'home.nav.files': 'Файлы',
    'home.nav.build': 'Сборка',
    'home.nav.more': 'Другое',
    'home.startLine1': 'Начните здесь',
    'home.startLine2': 'Создайте новую программу',
    'home.start': 'Начать',
    'home.returnToEditor': 'Вернуться в редактор',
    'home.recentFiles': 'Недавние файлы',
    'home.noRecentFiles': 'Недавних файлов пока нет',
    'home.noRecentFilesHint': 'Новые и сохраненные проекты появятся здесь.',
    'home.open': 'Открыть',
    'home.openFailed': 'Не удалось открыть файл проекта.',
    'home.replaceWarning': 'В текущем проекте есть несохраненные изменения. Заменить его?',
    'home.fileActions': 'Дополнительные действия',
    'home.delete': 'Удалить',
    'home.rename': 'Переименовать',
    'home.copy': 'Копировать',
    'home.language': 'Язык',
    'home.more.interaction': 'Руководство по взаимодействию',
    'home.more.hardware': 'Описание оборудования',
    'home.more.blocks': 'Описание блоков',
    'home.more.software': 'О программе',
    'home.more.about': 'О нас',
    'home.dialog.software.title': 'О программе',
    'home.dialog.software.body': 'EST Studio {version}\nВизуальная среда программирования',
    'menu.hardwareStatus': 'Состояние оборудования',
    'status.disconnected': 'EST не подключен',
    'status.connected': 'EST подключен',
    'status.upgradeRequired': 'Нужно обновить EST',
    'programControls.usbDisconnected': 'USB EST отключен. Подключите EST снова и повторите попытку.',
    'hardware.title': 'Состояние оборудования',
    'hardware.subtitle': 'Информация о хабе EST и периферии',
    'hardware.notConnected': 'EST не подключен',
    'hardware.connectionBattery': 'Подключение и батарея',
    'hardware.connectionStatus': 'Подключение',
    'hardware.connected': 'Подключен',
    'hardware.disconnected': 'Не подключен',
    'hardware.motors': 'Моторы',
    'hardware.sensors': 'Датчики',
    'category.motor': 'Мотор',
    'category.movement': 'Движение',
    'category.display': 'Экран',
    'category.sound': 'Воспроизведение',
    'category.event': 'События',
    'category.control': 'Управление',
    'category.sensing': 'Датчики'
};

const hardwareMessages = require('../common/hardware-messages.json');
const EST_MESSAGES = {
    en: {...en, ...cameraMessages.en},
    ru: {...ru, ...cameraMessages.ru, ...visionGuideMessages.ru},
    'zh-cn': {...zhCN, ...cameraMessages['zh-cn']},
    'zh-tw': {...zhTW, ...cameraMessages['zh-tw'], ...visionGuideMessages['zh-tw']},
    'pt-br': {...ptBR, ...cameraMessages['pt-br'], ...visionGuideMessages['pt-br']}
};

Object.keys(EST_MESSAGES).forEach(locale => Object.assign(EST_MESSAGES[locale], hardwareMessages[locale]));

const normalizeKey = locale => String(locale || EST_DEFAULT_LOCALE)
    .toLowerCase()
    .replace(/_/g, '-');

const fallbackLocaleFor = locale => {
    if (locale === 'zh-tw') return 'zh-cn';
    return 'en';
};

const interpolate = (message, values = {}) => String(message).replace(/\{([^}]+)\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
));

export const normalizeEstLocale = locale => {
    const normalized = normalizeKey(locale);
    return Object.prototype.hasOwnProperty.call(EST_MESSAGES, normalized) ? normalized : EST_DEFAULT_LOCALE;
};

export const getCurrentEstLocale = () => {
    if (typeof window !== 'undefined' && window.estCurrentLocale) {
        return normalizeEstLocale(window.estCurrentLocale);
    }
    if (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang) {
        return normalizeEstLocale(document.documentElement.lang);
    }
    return EST_DEFAULT_LOCALE;
};

export const setCurrentEstLocale = (locale, options = {}) => {
    const normalized = normalizeEstLocale(locale);
    if (typeof window !== 'undefined') {
        window.estCurrentLocale = normalized;
        if (window.localStorage) window.localStorage.setItem('est-studio-locale', normalized);
    }
    if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.lang = normalized;
    }
    if (!options.silent && typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EST_LOCALE_CHANGED_EVENT, {
            detail: {locale: normalized}
        }));
    }
    return normalized;
};

export const getEstText = (id, locale = getCurrentEstLocale(), values) => {
    const normalized = normalizeEstLocale(locale);
    const dictionary = EST_MESSAGES[normalized] || EST_MESSAGES[EST_DEFAULT_LOCALE];
    const fallback = EST_MESSAGES[fallbackLocaleFor(normalized)] || EST_MESSAGES.en;
    const message = dictionary[id] || fallback[id] || zhCN[id] || en[id] || id;
    return interpolate(message, values);
};

export const getEstLocaleMenuName = locale => EST_LOCALE_NAMES[normalizeEstLocale(locale)];

export const getEstLocaleOptions = messagesByLocale => Object.keys(messagesByLocale || {})
    .filter(locale => EST_LOCALE_NAMES[normalizeEstLocale(locale)])
    .map(locale => ({
        label: getEstLocaleMenuName(locale),
        value: normalizeEstLocale(locale)
    }));

export const getEstLocalizedOptions = (group, values, locale = getCurrentEstLocale()) => (
    values.map(value => [getEstText(`option.${group}.${value}`, locale), value])
);

export const getEstImageOptions = imageIds => imageIds.map(id => [id.replace('/', ' / '), id]);

const pianoSoundLabel = id => {
    const match = /^Piano\/([A-G])(s?)([0-9])$/.exec(id);
    if (!match) return null;
    return `${match[1]}${match[2] ? '#' : ''}${match[3]}`;
};

export const getEstSoundOptions = (soundIds, locale = getCurrentEstLocale()) => (
    soundIds.map(id => {
        const note = pianoSoundLabel(id);
        if (note) {
            return [`${getEstText('option.sound.pianoPrefix', locale)} ${note}`, id];
        }
        return [id.replace('/', ' / '), id];
    })
);

export const formatEstSteeringDisplayText = (value, locale = getCurrentEstLocale()) => {
    const steering = Number(value);
    const rounded = Number.isFinite(steering) ? Math.round(Math.max(-100, Math.min(100, steering))) : 0;
    if (rounded < 0) return `${getEstText('steering.left', locale)}:${rounded}`;
    if (rounded > 0) return `${getEstText('steering.right', locale)}:${rounded}`;
    return `${getEstText('steering.forward', locale)}:0`;
};

export {
    EST_MESSAGES,
    editorMessageOverrides as EST_EDITOR_MESSAGE_OVERRIDES
};
