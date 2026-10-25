// Real Blockly locale regression in the isolated renderer. No hardware IPC is used.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = async ({evaluate, pause, window, output}) => {
    await evaluate(`(() => {
        const editor = findLocaleTestBlocks(), B = editor.ScratchBlocks;
        window.newLocaleSavedXml = B.Xml.workspaceToDom(editor.workspace);
        const wanted = ['event_whenflagclicked','motor_specifiedunit','combined_motor_starting','matrix_lamp_text',
            'control_wait','control_if_else','control_stop','cameraRecognition_changer_camer_mode',
            'grayv2_if_all_ch_way_state','operator_mathop'];
        const xml = newUiFixtureXml.cloneNode(true);
        for (const block of Array.from(xml.children)) {
            if (!wanted.includes(block.getAttribute('type').slice(4))) block.remove();
        }
        editor.workspace.clear(); B.Xml.domToWorkspace(xml, editor.workspace);
        const by = type => editor.workspace.getAllBlocks().find(b => b.type === 'new_' + type);
        by('motor_specifiedunit').setFieldValue('seconds','unit');
        by('motor_specifiedunit').setFieldValue('Retreat','SPIN');
        by('motor_box').setFieldValue('H','MOTOR');
        by('combined_motor_box').setFieldValue('H+C','MOTOR');
        by('cameraRecognition_changer_camer_mode').setFieldValue('3','MODE');
        by('grayv2_if_all_ch_way_state').setFieldValue('8','INTERSECTION_TYPE');
        by('control_stop').setFieldValue('other','STOP_OPTION');
        by('matrix_lamp_text').getInputTargetBlock('matrix_text').setFieldValue('用户文字 HELLO','TEXT');
        by('event_whenflagclicked').nextConnection.connect(by('matrix_lamp_text').previousConnection);
        by('matrix_lamp_text').nextConnection.connect(by('control_wait').previousConnection);
        const visible = ['new_motor_specifiedunit','new_combined_motor_starting','new_event_whenflagclicked',
            'new_cameraRecognition_changer_camer_mode','new_grayv2_if_all_ch_way_state'];
        let y = 20;
        for (const type of visible) {
            const block = editor.workspace.getTopBlocks(false).find(b=>b.type===type);
            block.moveBy(30,y); y += block.getHeightWidth().height + 24;
        }
        editor.workspace.getTopBlocks(false).filter(b=>!visible.includes(b.type))
            .forEach((block,index)=>block.moveBy(1400,20+index*120));
        window.newLocaleBaseCode = editor.workspaceToCode();
        window.newLocaleBaseValues = editor.workspace.getAllBlocks().map(block => [block.id,block.type,
            block.inputList.flatMap(input => input.fieldRow.filter(f => f.name).map(f => [f.name,f.getValue()]))])
            .sort((a,b) => a[0].localeCompare(b[0]));
    })()`);
    const results = [];
    try {
        for (const [locale, camera, line, face, seconds, other, otherwise] of [
            ['en', 'Camera', 'Line tracker V2', 'face recognition', 'seconds', 'other scripts', 'else'],
            ['pt-br', 'Câmera', 'Seguidor de linha V2', 'reconhecimento facial',
                'segundos', 'outros scripts', 'senão'],
            ['ru', 'Камера', 'Датчик линии V2', 'распознавание лиц',
                'секунд', 'другие скрипты', 'иначе'],
            ['zh-tw', '攝像頭識別', '巡線卡 V2', '人臉識別', '秒', '其他程式', '否則'],
            ['zh-cn', '摄像头识别', '巡线卡 V2', '人脸识别', '秒', '其他脚本', '否则'],
            ['pt-br', 'Câmera', 'Seguidor de linha V2', 'reconhecimento facial',
                'segundos', 'outros scripts', 'senão']]) {
            await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale',
                {detail:{locale:${JSON.stringify(locale)}}}))`);
            await pause(350);
            const result = await evaluate(`(() => {
                const editor = findLocaleTestBlocks(), B = editor.ScratchBlocks;
                const blocks = editor.workspace.getAllBlocks(), by = type => blocks.find(b => b.type === 'new_'+type);
                const text = (type,name) => by(type).getField(name).getText();
                const code = editor.workspaceToCode();
                const values = blocks.map(block => [block.id,block.type,
                    block.inputList.flatMap(input => input.fieldRow.filter(f => f.name)
                        .map(f => [f.name,f.getValue()]))]).sort((a,b) => a[0].localeCompare(b[0]));
                const headless = new B.Workspace();
                let labels = 0, untranslated = [], fixed = 0;
                try {
                    B.Xml.domToWorkspace(newUiFixtureXml,headless);
                    fixed = headless.getTopBlocks(false).length;
                    for (const block of headless.getAllBlocks()) {
                        for (const input of block.inputList) for (const field of input.fieldRow) {
                            const texts = typeof field.getOptions === 'function' ?
                                field.getOptions().map(([label]) => typeof label === 'string' ? label : label.alt) :
                                field.EDITABLE === false ? [field.getText()] : [];
                            for (const label of texts) {
                                labels++;
                                if (/[\u3400-\u9fff]/.test(label)) untranslated.push([block.type,field.name,label]);
                            }
                        }
                    }
                } finally {headless.dispose();}
                const saved = B.Xml.workspaceToDom(editor.workspace), reopened = new B.Workspace();
                let reopenedCode;
                try { B.Xml.domToWorkspace(saved,reopened); reopenedCode = B.NewPython.workspaceToCode(reopened); }
                finally {reopened.dispose();}
                return {locale:editor.props.locale, fixed, labels, untranslated,
                    categories:Array.from(document.querySelectorAll('.scratchCategoryMenuItemLabel'))
                        .map(el=>el.textContent.trim()),
                    face:text('cameraRecognition_changer_camer_mode','MODE'),
                    seconds:text('motor_specifiedunit','unit'), other:text('control_stop','STOP_OPTION'),
                    conditional:by('control_if_else').toString(),
                    text:by('matrix_lamp_text').getInputTargetBlock('matrix_text').getFieldValue('TEXT'),
                    sameCode:code===newLocaleBaseCode,
                    sameValues:JSON.stringify(values)===JSON.stringify(newLocaleBaseValues),
                    reopenedCode:reopenedCode===code};
            })()`);
            assert.equal(result.locale, locale);
            assert.equal(result.fixed, 107);
            assert.ok(result.categories.includes(camera) && result.categories.includes(line), JSON.stringify(result));
            assert.equal(result.face, face);
            assert.equal(result.seconds, seconds);
            assert.equal(result.other, other);
            assert.ok(result.conditional.includes(otherwise), result.conditional);
            assert.equal(result.text, '用户文字 HELLO', 'never translate user content');
            assert.ok(result.sameCode && result.sameValues && result.reopenedCode,
                `locale switching must preserve field values, project round-trip and generated code: ${locale}`);
            if (['en', 'pt-br', 'ru'].includes(locale)) {
                assert.deepStrictEqual(result.untranslated, [], `untranslated Blockly labels: ${locale}`);
            }
            results.push({locale, fixed: result.fixed, labelsChecked: result.labels, codeUnchanged: true});
            if (locale === 'pt-br') {
                const menu = await evaluate(`(() => {
                    const editor = findLocaleTestBlocks(), B = editor.ScratchBlocks;
                    const field = editor.workspace.getAllBlocks()
                        .find(b=>b.type==='new_cameraRecognition_changer_camer_mode').getField('MODE');
                    field.showEditor_(); return B.DropDownDiv.getContentDiv().textContent;
                })()`);
                assert.ok(menu.includes('reconhecimento facial') && menu.includes('reconhecimento de gestos'), menu);
                await pause(80);
                fs.writeFileSync(path.join(output, 'new-ai-locale-pt-br.png'),
                    (await window.webContents.capturePage()).toPNG());
                await evaluate('findLocaleTestBlocks().ScratchBlocks.DropDownDiv.hideWithoutAnimation()');
                const pair = await evaluate(`(() => {
                    const editor=findLocaleTestBlocks();
                    editor.workspace.getAllBlocks().find(b=>b.type==='new_combined_motor_box')
                        .getField('MOTOR').showEditor_();
                    const panel=document.querySelector('.new-combined-motor-selector');
                    return {text:panel.textContent,
                        values:Array.from(panel.querySelectorAll('[data-motor-port]')).map(b=>b.dataset.motorPort)};
                })()`);
                assert.ok(pair.text.includes('Motor esquerdo: H') && pair.text.includes('Motor direito: C'), pair.text);
                assert.deepStrictEqual(pair.values, 'ABCDEFGH'.split(''));
                await evaluate('findLocaleTestBlocks().ScratchBlocks.DropDownDiv.hideWithoutAnimation()');
            }
        }
        fs.writeFileSync(path.join(output, 'new-ai-locales.json'), JSON.stringify({passed: true, results}, null, 2));
        console.log('NEW AI block locales passed: all 107 blocks and dropdowns, five languages, repeated switching, ' +
            'user text/field values/code preserved, project round-trip and rendered Portuguese camera menu.');
    } finally {
        await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale', {detail:{locale:'zh-cn'}}))`);
        await pause(300);
        await evaluate(`(() => {
            const editor=findLocaleTestBlocks(); editor.ScratchBlocks.DropDownDiv.hideWithoutAnimation();
            editor.workspace.clear(); editor.ScratchBlocks.Xml.domToWorkspace(newLocaleSavedXml,editor.workspace);
        })()`);
    }
};
