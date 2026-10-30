import aiConversationGuide from './est-home-assets/home-guide-ai-conversation.png';
import aiSettingsGuide from './est-home-assets/home-guide-ai-settings.png';
import aiWelcomeGuide from './est-home-assets/home-guide-ai-welcome.png';
import estProductImage from './hardware/assets/est.png';
import newAiProductImage from './hardware/assets/new-ai.png';
import sparkAiProductImage from './hardware/assets/spark-ai.png';
import hostHomeGuide from './est-home-assets/home-guide-est-host-home.png';
import hostHomeGuideEN from './est-home-assets/home-guide-est-host-home-en.png';
import hostHomeGuidePT from './est-home-assets/home-guide-est-host-home-pt-br.png';
import hostPortsGuide from './est-home-assets/home-guide-est-host-ports.png';
import hostPortsGuideEN from './est-home-assets/home-guide-est-host-ports-en.png';
import hostPortsGuidePT from './est-home-assets/home-guide-est-host-ports-pt-br.png';
import hostProgramsGuide from './est-home-assets/home-guide-est-host-programs.png';
import hostProgramsGuideEN from './est-home-assets/home-guide-est-host-programs-en.png';
import hostProgramsGuidePT from './est-home-assets/home-guide-est-host-programs-pt-br.png';
import hostSettingsGuide from './est-home-assets/home-guide-est-host-settings.png';
import hostSettingsGuideEN from './est-home-assets/home-guide-est-host-settings-en.png';
import hostSettingsGuidePT from './est-home-assets/home-guide-est-host-settings-pt-br.png';
import visionCameraGuide from './est-home-assets/home-guide-vision-camera.png';
import visionCameraGuideEN from './est-home-assets/home-guide-vision-camera-en.png';
import visionCameraGuidePT from './est-home-assets/home-guide-vision-camera-pt-br.png';
import visionCameraGuideRU from './est-home-assets/home-guide-vision-camera-ru.png';
import visionCameraGuideTW from './est-home-assets/home-guide-vision-camera-zh-tw.png';
import estProductGuide from '../../resources/est-build-library/thumbnails/basic-01.jpg';

export const INFO_ITEMS = [
    {id: 'est', title: 'home.more.est', subtitle: 'home.more.estSummary'},
    {id: 'vision', title: 'home.more.vision', subtitle: 'home.more.visionSummary'},
    {id: 'interaction', title: 'home.more.interaction', subtitle: 'home.more.interactionSummary'},
    {id: 'hardware', title: 'home.more.hardware', subtitle: 'home.more.hardwareSummary'},
    {id: 'blocks', title: 'home.more.blocks', subtitle: 'home.more.blocksSummary'},
    {id: 'ai', title: 'home.more.ai', subtitle: 'home.more.aiSummary'},
    {id: 'software', title: 'home.more.software', subtitle: 'home.more.softwareSummary'},
    {id: 'about', title: 'home.more.about', subtitle: 'home.more.aboutSummary'}
];

export const PRODUCT_GUIDE_ITEMS = ['hardware', 'interaction', 'sensors', 'blocks', 'ai', 'firmware'].map(id => ({
    id,
    title: `home.more.guide.${id}`,
    subtitle: `home.more.guide.${id}Summary`
}));

export const EST_PRODUCTS = [
    {
        id: 'est',
        image: estProductImage,
        imageAlt: 'home.dialog.est.prototype.estImageAlt',
        name: 'home.dialog.est.prototype.currentName',
        summary: 'home.dialog.est.prototype.currentSummary',
        intro: 'home.dialog.est.prototype.currentIntro',
        facts: [
            ['home.dialog.est.prototype.audienceLabel', 'home.dialog.est.prototype.currentAudience'],
            ['home.dialog.est.prototype.hardwareLabel', 'home.dialog.est.prototype.currentHardware'],
            ['home.dialog.est.prototype.featureLabel', 'home.dialog.est.prototype.currentFeature'],
            ['home.dialog.est.prototype.projectLabel', 'home.dialog.est.prototype.currentProject']
        ],
        sections: [
            {
                title: 'home.dialog.est.controllerTitle',
                items: [
                    'home.dialog.est.controller1',
                    'home.dialog.est.controller2',
                    'home.dialog.est.controller3',
                    'home.dialog.est.controller4'
                ]
            },
            {
                title: 'home.dialog.est.hardwareTitle',
                items: [
                    'home.dialog.est.hardware1',
                    'home.dialog.est.hardware2',
                    'home.dialog.est.hardware3',
                    'home.dialog.est.hardware4'
                ]
            },
            {
                title: 'home.dialog.est.programmingTitle',
                items: [
                    'home.dialog.est.programming1',
                    'home.dialog.est.programming2',
                    'home.dialog.est.programming3',
                    'home.dialog.est.programming4'
                ]
            },
            {
                title: 'home.dialog.est.smartTitle',
                items: [
                    'home.dialog.est.smart1',
                    'home.dialog.est.smart2',
                    'home.dialog.est.smart3'
                ]
            },
            {
                title: 'home.dialog.est.useTitle',
                items: [
                    'home.dialog.est.use1',
                    'home.dialog.est.use2',
                    'home.dialog.est.use3'
                ],
                note: 'home.dialog.est.useNote'
            },
            {
                title: 'home.dialog.hardware.firmwareTitle',
                ordered: true,
                items: [
                    'home.dialog.hardware.firmware1',
                    'home.dialog.hardware.firmware2',
                    'home.dialog.hardware.firmware3',
                    'home.dialog.hardware.firmware4',
                    'home.dialog.hardware.firmware5',
                    'home.dialog.hardware.firmware6',
                    'home.dialog.hardware.firmware7'
                ],
                note: 'home.dialog.hardware.firmwareNote'
            }
        ]
    },
    {
        id: 'spark-ai',
        image: sparkAiProductImage,
        imageAlt: 'home.dialog.est.prototype.sparkImageAlt',
        name: 'home.dialog.est.prototype.newAName',
        summary: 'home.dialog.est.prototype.sparkSummary',
        intro: 'home.dialog.est.prototype.sparkIntro',
        facts: [
            ['home.dialog.est.prototype.audienceLabel', 'home.dialog.est.prototype.sparkAudience'],
            ['home.dialog.est.prototype.hardwareLabel', 'home.dialog.est.prototype.sparkHardware'],
            ['home.dialog.est.prototype.featureLabel', 'home.dialog.est.prototype.sparkFeature'],
            ['home.dialog.est.prototype.projectLabel', 'home.dialog.est.prototype.sparkProject']
        ],
        sections: [
            {
                title: 'home.dialog.est.prototype.sparkMenuTitle',
                menuProduct: 'spark-ai',
                items: [
                    'home.dialog.est.prototype.sparkMenu1',
                    'home.dialog.est.prototype.sparkMenu2',
                    'home.dialog.est.prototype.sparkMenu3',
                    'home.dialog.est.prototype.sparkMenu4',
                    'home.dialog.est.prototype.sparkMenu5'
                ]
            },
            {
                title: 'home.dialog.est.prototype.sparkHostTitle',
                items: [
                    'home.dialog.est.prototype.sparkHost1',
                    'home.dialog.est.prototype.sparkHost2',
                    'home.dialog.est.prototype.sparkHost3',
                    'home.dialog.est.prototype.sparkHost4',
                    'home.dialog.est.prototype.sparkHost5'
                ],
                note: 'home.dialog.est.prototype.sparkHostNote'
            },
            {
                title: 'home.dialog.est.prototype.sparkDeviceTitle',
                items: [
                    'home.dialog.est.prototype.sparkDevice1',
                    'home.dialog.est.prototype.sparkDevice2',
                    'home.dialog.est.prototype.sparkDevice3',
                    'home.dialog.est.prototype.sparkDevice4'
                ]
            },
            {
                title: 'home.dialog.est.prototype.sparkMotorTitle',
                items: [
                    'home.dialog.est.prototype.sparkMotor1',
                    'home.dialog.est.prototype.sparkMotor2',
                    'home.dialog.est.prototype.sparkMotor3'
                ]
            },
            {
                title: 'home.dialog.est.prototype.sparkSensorTitle',
                items: [
                    'home.dialog.est.prototype.sparkSensor1',
                    'home.dialog.est.prototype.sparkSensor2',
                    'home.dialog.est.prototype.sparkSensor3',
                    'home.dialog.est.prototype.sparkSensor4'
                ]
            },
            {
                title: 'home.dialog.est.prototype.sparkProgramTitle',
                items: [
                    'home.dialog.est.prototype.sparkProgram1',
                    'home.dialog.est.prototype.sparkProgram2',
                    'home.dialog.est.prototype.sparkProgram3',
                    'home.dialog.est.prototype.sparkProgram4'
                ]
            },
            {
                title: 'home.dialog.est.prototype.sparkAiTitle',
                items: [
                    'home.dialog.est.prototype.sparkAi1',
                    'home.dialog.est.prototype.sparkAi2',
                    'home.dialog.est.prototype.sparkAi3'
                ]
            },
            {
                title: 'home.dialog.est.prototype.sparkFirmwareTitle',
                ordered: true,
                items: [
                    'home.dialog.est.prototype.sparkFirmware1',
                    'home.dialog.est.prototype.sparkFirmware2',
                    'home.dialog.est.prototype.sparkFirmware3',
                    'home.dialog.est.prototype.sparkFirmware4'
                ],
                note: 'home.dialog.est.prototype.sparkFirmwareNote'
            }
        ]
    },
    {
        id: 'new-ai',
        image: newAiProductImage,
        imageAlt: 'home.dialog.est.prototype.newAiImageAlt',
        name: 'home.dialog.est.prototype.newBName',
        summary: 'home.dialog.est.prototype.newAiSummary',
        intro: 'home.dialog.est.prototype.newAiIntro',
        facts: [
            ['home.dialog.est.prototype.audienceLabel', 'home.dialog.est.prototype.newAiAudience'],
            ['home.dialog.est.prototype.hardwareLabel', 'home.dialog.est.prototype.newAiHardware'],
            ['home.dialog.est.prototype.featureLabel', 'home.dialog.est.prototype.newAiFeature'],
            ['home.dialog.est.prototype.projectLabel', 'home.dialog.est.prototype.newAiProject']
        ],
        sections: [
            {
                title: 'home.dialog.est.prototype.newAiMenuTitle',
                menuProduct: 'new-ai',
                items: [
                    'home.dialog.est.prototype.newAiMenu1',
                    'home.dialog.est.prototype.newAiMenu2',
                    'home.dialog.est.prototype.newAiMenu3',
                    'home.dialog.est.prototype.newAiMenu4',
                    'home.dialog.est.prototype.newAiMenu5'
                ]
            },
            {
                title: 'home.dialog.est.prototype.newAiHostTitle',
                items: [
                    'home.dialog.est.prototype.newAiHost1',
                    'home.dialog.est.prototype.newAiHost2',
                    'home.dialog.est.prototype.newAiHost3',
                    'home.dialog.est.prototype.newAiHost4',
                    'home.dialog.est.prototype.newAiHost5'
                ]
            },
            {
                title: 'home.dialog.est.prototype.newAiDeviceTitle',
                items: [
                    'home.dialog.est.prototype.newAiDevice1',
                    'home.dialog.est.prototype.newAiDevice2',
                    'home.dialog.est.prototype.newAiDevice3',
                    'home.dialog.est.prototype.newAiDevice4'
                ]
            },
            {
                title: 'home.dialog.est.prototype.newAiMotorTitle',
                items: [
                    'home.dialog.est.prototype.newAiMotor1',
                    'home.dialog.est.prototype.newAiMotor2',
                    'home.dialog.est.prototype.newAiMotor3'
                ]
            },
            {
                title: 'home.dialog.est.prototype.newAiSensorTitle',
                items: [
                    'home.dialog.est.prototype.newAiSensor1',
                    'home.dialog.est.prototype.newAiSensor2',
                    'home.dialog.est.prototype.newAiSensor3',
                    'home.dialog.est.prototype.newAiSensor4'
                ]
            },
            {
                title: 'home.dialog.est.prototype.newAiVisionTitle',
                items: [
                    'home.dialog.est.prototype.newAiVision1',
                    'home.dialog.est.prototype.newAiVision2',
                    'home.dialog.est.prototype.newAiVision3',
                    'home.dialog.est.prototype.newAiVision4'
                ]
            },
            {
                title: 'home.dialog.est.prototype.newAiProgramTitle',
                items: [
                    'home.dialog.est.prototype.newAiProgram1',
                    'home.dialog.est.prototype.newAiProgram2',
                    'home.dialog.est.prototype.newAiProgram3',
                    'home.dialog.est.prototype.newAiProgram4'
                ]
            },
            {
                title: 'home.dialog.est.prototype.newAiAiTitle',
                items: [
                    'home.dialog.est.prototype.newAiAi1',
                    'home.dialog.est.prototype.newAiAi2',
                    'home.dialog.est.prototype.newAiAi3'
                ]
            },
            {
                title: 'home.dialog.est.prototype.newAiFirmwareTitle',
                ordered: true,
                items: [
                    'home.dialog.est.prototype.newAiFirmware1',
                    'home.dialog.est.prototype.newAiFirmware2',
                    'home.dialog.est.prototype.newAiFirmware3',
                    'home.dialog.est.prototype.newAiFirmware4'
                ],
                note: 'home.dialog.est.prototype.newAiFirmwareNote'
            }
        ]
    }
];

const EST_PRODUCT_SHARED_SECTIONS = [
    {
        title: 'home.dialog.est.prototype.sharedProjectTitle',
        items: [
            'home.dialog.est.prototype.sharedProject1',
            'home.dialog.est.prototype.sharedProject2',
            'home.dialog.est.prototype.sharedProject3'
        ]
    },
    {
        title: 'home.dialog.est.prototype.sharedAiTitle',
        items: [
            'home.dialog.est.prototype.sharedAi1',
            'home.dialog.est.prototype.sharedAi2',
            'home.dialog.est.prototype.sharedAi3'
        ]
    }
];

const INFO_DIALOGS = {
    est: {
        lead: 'home.dialog.est.lead',
        sections: [
            {
                title: 'home.dialog.est.overviewTitle',
                image: estProductGuide,
                imageAlt: 'home.dialog.est.overviewImageAlt',
                caption: 'home.dialog.est.overviewImageCaption',
                items: [
                    'home.dialog.est.overview1',
                    'home.dialog.est.overview2',
                    'home.dialog.est.overview3'
                ]
            },
            {
                title: 'home.dialog.est.controllerTitle',
                items: [
                    'home.dialog.est.controller1',
                    'home.dialog.est.controller2',
                    'home.dialog.est.controller3',
                    'home.dialog.est.controller4'
                ]
            },
            {
                title: 'home.dialog.est.hardwareTitle',
                items: [
                    'home.dialog.est.hardware1',
                    'home.dialog.est.hardware2',
                    'home.dialog.est.hardware3',
                    'home.dialog.est.hardware4'
                ]
            },
            {
                title: 'home.dialog.est.programmingTitle',
                items: [
                    'home.dialog.est.programming1',
                    'home.dialog.est.programming2',
                    'home.dialog.est.programming3',
                    'home.dialog.est.programming4'
                ]
            },
            {
                title: 'home.dialog.est.smartTitle',
                items: [
                    'home.dialog.est.smart1',
                    'home.dialog.est.smart2',
                    'home.dialog.est.smart3'
                ]
            },
            {
                title: 'home.dialog.est.useTitle',
                items: [
                    'home.dialog.est.use1',
                    'home.dialog.est.use2',
                    'home.dialog.est.use3'
                ],
                note: 'home.dialog.est.useNote'
            }
        ]
    },
    vision: {
        lead: 'home.dialog.vision.lead',
        action: 'vision',
        actionLabel: 'home.dialog.vision.openAction',
        sections: [
            {
                title: 'home.dialog.vision.startTitle',
                image: visionCameraGuide,
                localizedImages: {
                    'en': visionCameraGuideEN,
                    'ru': visionCameraGuideRU,
                    'pt-br': visionCameraGuidePT,
                    'zh-tw': visionCameraGuideTW
                },
                imageAlt: 'home.dialog.vision.startImageAlt',
                caption: 'home.dialog.vision.startImageCaption',
                ordered: true,
                items: [
                    'home.dialog.vision.start1',
                    'home.dialog.vision.start2',
                    'home.dialog.vision.start3',
                    'home.dialog.vision.start4'
                ]
            },
            {
                title: 'home.dialog.vision.modeTitle',
                items: [
                    'home.dialog.vision.mode1',
                    'home.dialog.vision.mode2',
                    'home.dialog.vision.mode3',
                    'home.dialog.vision.mode4'
                ]
            },
            {
                title: 'home.dialog.vision.programTitle',
                ordered: true,
                items: [
                    'home.dialog.vision.program1',
                    'home.dialog.vision.program2',
                    'home.dialog.vision.program3',
                    'home.dialog.vision.program4'
                ],
                note: 'home.dialog.vision.programNote'
            },
            {
                title: 'home.dialog.vision.firmwareTitle',
                items: [
                    'home.dialog.vision.firmware1',
                    'home.dialog.vision.firmware2',
                    'home.dialog.vision.firmware3',
                    'home.dialog.vision.firmware4'
                ]
            },
            {
                title: 'home.dialog.vision.privacyTitle',
                items: [
                    'home.dialog.vision.privacy1',
                    'home.dialog.vision.privacy2',
                    'home.dialog.vision.privacy3'
                ]
            },
            {
                title: 'home.dialog.vision.troubleshootTitle',
                items: [
                    'home.dialog.vision.troubleshoot1',
                    'home.dialog.vision.troubleshoot2',
                    'home.dialog.vision.troubleshoot3',
                    'home.dialog.vision.troubleshoot4'
                ]
            }
        ]
    },
    interaction: {
        lead: 'home.dialog.interaction.lead',
        sections: [
            {
                title: 'home.dialog.interaction.connectTitle',
                ordered: true,
                items: [
                    'home.dialog.interaction.connect1',
                    'home.dialog.interaction.connect2',
                    'home.dialog.interaction.connect3',
                    'home.dialog.interaction.connect4'
                ]
            },
            {
                title: 'home.dialog.interaction.programTitle',
                items: [
                    'home.dialog.interaction.program1',
                    'home.dialog.interaction.program2',
                    'home.dialog.interaction.program3',
                    'home.dialog.interaction.program4'
                ]
            },
            {
                title: 'home.dialog.interaction.hostTitle',
                items: [
                    'home.dialog.interaction.host1',
                    'home.dialog.interaction.host2'
                ]
            },
            {
                title: 'home.dialog.interaction.feedbackTitle',
                items: [
                    'home.dialog.interaction.feedback1',
                    'home.dialog.interaction.feedback2',
                    'home.dialog.interaction.feedback3'
                ],
                note: 'home.dialog.interaction.feedbackNote'
            },
            {
                title: 'home.dialog.interaction.visionTitle',
                items: [
                    'home.dialog.interaction.vision1',
                    'home.dialog.interaction.vision2',
                    'home.dialog.interaction.vision3'
                ]
            },
            {
                title: 'home.dialog.interaction.troubleshootTitle',
                items: [
                    'home.dialog.interaction.troubleshoot1',
                    'home.dialog.interaction.troubleshoot2',
                    'home.dialog.interaction.troubleshoot3'
                ]
            }
        ]
    },
    hardware: {
        lead: 'home.dialog.hardware.lead',
        sections: [
            {
                title: 'home.dialog.hardware.controllerTitle',
                items: [
                    'home.dialog.hardware.controller1',
                    'home.dialog.hardware.controller2',
                    'home.dialog.hardware.controller3'
                ]
            },
            {
                title: 'home.dialog.hardware.hostHomeTitle',
                image: hostHomeGuide,
                localizedImages: {
                    'en': hostHomeGuideEN,
                    'pt-br': hostHomeGuidePT
                },
                imageAlt: 'home.dialog.hardware.hostHomeImageAlt',
                caption: 'home.dialog.hardware.hostImageCaption',
                items: [
                    'home.dialog.hardware.hostHome1',
                    'home.dialog.hardware.hostHome2',
                    'home.dialog.hardware.hostHome3',
                    'home.dialog.hardware.hostHome4'
                ]
            },
            {
                title: 'home.dialog.hardware.hostProgramsTitle',
                image: hostProgramsGuide,
                localizedImages: {
                    'en': hostProgramsGuideEN,
                    'pt-br': hostProgramsGuidePT
                },
                imageAlt: 'home.dialog.hardware.hostProgramsImageAlt',
                caption: 'home.dialog.hardware.hostImageCaption',
                items: [
                    'home.dialog.hardware.hostPrograms1',
                    'home.dialog.hardware.hostPrograms2',
                    'home.dialog.hardware.hostPrograms3',
                    'home.dialog.hardware.hostPrograms4'
                ]
            },
            {
                title: 'home.dialog.hardware.hostPortsTitle',
                image: hostPortsGuide,
                localizedImages: {
                    'en': hostPortsGuideEN,
                    'pt-br': hostPortsGuidePT
                },
                imageAlt: 'home.dialog.hardware.hostPortsImageAlt',
                caption: 'home.dialog.hardware.hostImageCaption',
                items: [
                    'home.dialog.hardware.hostPorts1',
                    'home.dialog.hardware.hostPorts2',
                    'home.dialog.hardware.hostPorts3'
                ]
            },
            {
                title: 'home.dialog.hardware.hostRemoteTitle',
                items: [
                    'home.dialog.hardware.hostRemote1',
                    'home.dialog.hardware.hostRemote2',
                    'home.dialog.hardware.hostRemote3'
                ]
            },
            {
                title: 'home.dialog.hardware.hostMotorTitle',
                items: [
                    'home.dialog.hardware.hostMotor1',
                    'home.dialog.hardware.hostMotor2',
                    'home.dialog.hardware.hostMotor3',
                    'home.dialog.hardware.hostMotor4'
                ],
                note: 'home.dialog.hardware.hostMotorNote'
            },
            {
                title: 'home.dialog.hardware.hostSettingsTitle',
                image: hostSettingsGuide,
                localizedImages: {
                    'en': hostSettingsGuideEN,
                    'pt-br': hostSettingsGuidePT
                },
                imageAlt: 'home.dialog.hardware.hostSettingsImageAlt',
                caption: 'home.dialog.hardware.hostImageCaption',
                items: [
                    'home.dialog.hardware.hostSettings1',
                    'home.dialog.hardware.hostSettings2',
                    'home.dialog.hardware.hostSettings3'
                ]
            },
            {
                title: 'home.dialog.hardware.outputTitle',
                items: [
                    'home.dialog.hardware.output1',
                    'home.dialog.hardware.output2',
                    'home.dialog.hardware.output3'
                ]
            },
            {
                title: 'home.dialog.hardware.sensorTitle',
                items: [
                    'home.dialog.hardware.sensor1',
                    'home.dialog.hardware.sensor2',
                    'home.dialog.hardware.sensor3',
                    'home.dialog.hardware.sensor4',
                    'home.dialog.hardware.sensor5'
                ]
            },
            {
                title: 'home.dialog.hardware.firmwareTitle',
                ordered: true,
                items: [
                    'home.dialog.hardware.firmware1',
                    'home.dialog.hardware.firmware2',
                    'home.dialog.hardware.firmware3',
                    'home.dialog.hardware.firmware4',
                    'home.dialog.hardware.firmware5',
                    'home.dialog.hardware.firmware6',
                    'home.dialog.hardware.firmware7'
                ],
                note: 'home.dialog.hardware.firmwareNote'
            },
            {
                title: 'home.dialog.hardware.careTitle',
                items: [
                    'home.dialog.hardware.care1',
                    'home.dialog.hardware.care2',
                    'home.dialog.hardware.care3'
                ],
                note: 'home.dialog.hardware.careNote'
            }
        ]
    },
    blocks: {
        lead: 'home.dialog.blocks.lead'
    },
    ai: {
        lead: 'home.dialog.ai.lead',
        sections: [
            {
                title: 'home.dialog.ai.openTitle',
                image: aiWelcomeGuide,
                imageAlt: 'home.dialog.ai.openImageAlt',
                caption: 'home.dialog.ai.openImageCaption',
                items: [
                    'home.dialog.ai.open1',
                    'home.dialog.ai.open2',
                    'home.dialog.ai.open3'
                ]
            },
            {
                title: 'home.dialog.ai.setupTitle',
                image: aiSettingsGuide,
                imageAlt: 'home.dialog.ai.setupImageAlt',
                caption: 'home.dialog.ai.setupImageCaption',
                ordered: true,
                items: [
                    'home.dialog.ai.setup1',
                    'home.dialog.ai.setup2',
                    'home.dialog.ai.setup3',
                    'home.dialog.ai.setup4',
                    'home.dialog.ai.setup5'
                ],
                note: 'home.dialog.ai.setupNote'
            },
            {
                title: 'home.dialog.ai.promptTitle',
                items: [
                    'home.dialog.ai.prompt1',
                    'home.dialog.ai.prompt2',
                    'home.dialog.ai.prompt3',
                    'home.dialog.ai.prompt4'
                ]
            },
            {
                title: 'home.dialog.ai.applyTitle',
                image: aiConversationGuide,
                imageAlt: 'home.dialog.ai.applyImageAlt',
                caption: 'home.dialog.ai.applyImageCaption',
                ordered: true,
                items: [
                    'home.dialog.ai.apply1',
                    'home.dialog.ai.apply2',
                    'home.dialog.ai.apply3',
                    'home.dialog.ai.apply4',
                    'home.dialog.ai.apply5'
                ],
                note: 'home.dialog.ai.applyNote'
            },
            {
                title: 'home.dialog.ai.scopeTitle',
                items: [
                    'home.dialog.ai.scope1',
                    'home.dialog.ai.scope2',
                    'home.dialog.ai.scope3',
                    'home.dialog.ai.scope4',
                    'home.dialog.ai.scope5'
                ]
            },
            {
                title: 'home.dialog.ai.privacyTitle',
                items: [
                    'home.dialog.ai.privacy1',
                    'home.dialog.ai.privacy2',
                    'home.dialog.ai.privacy3'
                ],
                note: 'home.dialog.ai.privacyNote'
            },
            {
                title: 'home.dialog.ai.troubleshootTitle',
                items: [
                    'home.dialog.ai.troubleshoot1',
                    'home.dialog.ai.troubleshoot2',
                    'home.dialog.ai.troubleshoot3',
                    'home.dialog.ai.troubleshoot4'
                ]
            }
        ]
    },
    software: {
        lead: 'home.dialog.software.lead',
        sections: [
            {
                title: 'home.dialog.software.fileTitle',
                items: [
                    'home.dialog.software.file1',
                    'home.dialog.software.file2',
                    'home.dialog.software.file3'
                ]
            },
            {
                title: 'home.dialog.software.workspaceTitle',
                items: [
                    'home.dialog.software.workspace1',
                    'home.dialog.software.workspace2',
                    'home.dialog.software.workspace3',
                    'home.dialog.software.workspace4'
                ]
            },
            {
                title: 'home.dialog.software.updateTitle',
                items: [
                    'home.dialog.software.update1',
                    'home.dialog.software.update2',
                    'home.dialog.software.update3'
                ],
                note: 'home.dialog.software.updateNote'
            }
        ]
    },
    about: {
        lead: 'home.dialog.about.lead',
        sections: [
            {
                title: 'home.dialog.about.purposeTitle',
                items: [
                    'home.dialog.about.purpose1',
                    'home.dialog.about.purpose2',
                    'home.dialog.about.purpose3'
                ]
            },
            {
                title: 'home.dialog.about.foundationTitle',
                items: [
                    'home.dialog.about.foundation2',
                    'home.dialog.about.foundation3'
                ]
            },
            {
                title: 'home.dialog.about.supportTitle',
                items: [
                    'home.dialog.about.support1',
                    'home.dialog.about.support2',
                    'home.dialog.about.support3'
                ],
                note: 'home.dialog.about.supportNote'
            }
        ]
    }
};

// Reuse the existing copy while keeping each product's ports and firmware instructions separate.
export const getProductGuide = (productId, dialogId) => {
    const product = EST_PRODUCTS.find(item => item.id === productId);
    if (!product) return INFO_DIALOGS[dialogId];
    const sectionsWithTitles = (sections, titles) => sections.filter(section => titles.includes(section.title));
    if (dialogId === 'ai') {
        const productAiTitles = {
            'est': ['home.dialog.est.smartTitle'],
            'spark-ai': ['home.dialog.est.prototype.sparkAiTitle'],
            'new-ai': [
                'home.dialog.est.prototype.newAiAiTitle',
                'home.dialog.est.prototype.newAiVisionTitle'
            ]
        }[productId] || [];
        return {
            ...INFO_DIALOGS.ai,
            sections: [
                ...sectionsWithTitles(product.sections, productAiTitles),
                ...INFO_DIALOGS.ai.sections
            ]
        };
    }
    if (productId === 'est') {
        if (dialogId === 'sensors') {
            return {
                lead: product.intro,
                sections: sectionsWithTitles(INFO_DIALOGS.hardware.sections, [
                    'home.dialog.hardware.outputTitle', 'home.dialog.hardware.sensorTitle'
                ])
            };
        }
        if (dialogId === 'firmware') {
            return {
                lead: 'home.more.guide.firmwareSummary',
                sections: sectionsWithTitles(product.sections, ['home.dialog.hardware.firmwareTitle'])
            };
        }
        if (dialogId === 'hardware') {
            return {
                ...INFO_DIALOGS.hardware,
                sections: INFO_DIALOGS.hardware.sections.filter(section =>
                    !['home.dialog.hardware.outputTitle', 'home.dialog.hardware.sensorTitle',
                        'home.dialog.hardware.firmwareTitle'].includes(section.title)
                )
            };
        }
        return INFO_DIALOGS[dialogId];
    }
    const prefix = productId === 'spark-ai' ? 'spark' : 'newAi';
    const sectionNames = {
        hardware: ['Menu', 'Host', 'Device'],
        interaction: ['Menu', 'Program'],
        sensors: ['Motor', 'Sensor'],
        blocks: ['Program'],
        firmware: ['Firmware']
    }[dialogId];
    if (!sectionNames) return INFO_DIALOGS[dialogId];
    const sections = sectionsWithTitles(product.sections, sectionNames.map(name =>
        `home.dialog.est.prototype.${prefix}${name}Title`
    ));
    if (dialogId === 'interaction' || dialogId === 'blocks') sections.push(EST_PRODUCT_SHARED_SECTIONS[0]);
    return {lead: product.intro, sections};
};
