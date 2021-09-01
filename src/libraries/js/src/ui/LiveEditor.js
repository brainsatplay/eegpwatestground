

import { DOMFragment } from './DOMFragment';

/*
    Language Support
*/

import Prism from 'prismjs';

// GLSL
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-glsl';

import "prism-themes/themes/prism-vsc-dark-plus.css"
import './styles/defaults.css'


export class LiveEditor {

        constructor(settings={language: 'javascript', shortcuts:{}},parentNode=document.body) {

            // Internal Attributes
            this.ui
            this.props = {
                id: Math.floor(Math.random()*10000000),
                language: settings.language,
                supportedLanguages: ['javascript', 'html', 'css', 'glsl'],
                shortcuts: settings.shortcuts,
                settings:settings
            }
            this.editorId = this.props.id+'editor';
            this.input = undefined;

            if (this.props.supportedLanguages.includes(this.props.language)){

                // Where to Insert the Editor
                this.parentNode = parentNode;
                if(typeof this.parentNode === 'string') { //can just input the div id
                    this.parentNode = document.getElementById(this.parentNode);
                }
        
                this.init();
                this.onOpen()
            } else {
                console.error(`${this.props.language} is an unsupported language. Please choose from the following options: ${this.props.supportedLanguages}`)
            }

            this.quickrefhidden = true;
        }

        init = () => {

            let language;
            switch(this.props.language) {
                case 'glsl':
                    language = 'GLSL'
                    break;
                case 'html':
                    language = 'HTML'
                    break;
                case 'css':
                    language = 'CSS'
                    break;
                default:
                    language = this.props.language[0].toUpperCase() + this.props.language.slice(1)
              }

              let template = `
            <div id='${this.props.id}liveEditor' class="brainsatplay-live-code-editor">
                <div id='${this.props.id}editorContainer' style="position: relative; width: 100%; height: 100%;">
                    <div style="display: flex; position: absolute; top: 0; right: 0; z-index: 2;">
                        <button id='${this.props.id}referenceToggle' class="brainsatplay-default-button" style="width: auto;min-height: 35px;">Reference</button>    
                        <button id='${this.props.id}reset' class="brainsatplay-default-button" style="width: auto; min-height: 25px;">Reset</button>
                        <button id='${this.props.id}submit' class="brainsatplay-default-button" style="width: auto;min-height: 25px;">Save</button>
                        <button id='${this.props.id}close' class="brainsatplay-default-button" style="width: auto;min-height: 25px;">Close</button>
                    </div>
                    <textarea id='${this.props.id}editor' class="brainsatplay-code-editing" spellcheck="false" placeholder='Write your ${language} code...'></textarea>
                    <pre class="brainsatplay-code-highlighting" aria-hidden="true">
                        <code class="language-${this.props.language} brainsatplay-code-highlighting-content"></code>
                    </pre>
                </div>
            </div>
        `;

        let setup = () => {


            this.input = document.getElementById(`${this.props.id}editor`)

            let reset = document.getElementById(`${this.props.id}reset`)
            let close = document.getElementById(`${this.props.id}close`)
            let submitElement = document.getElementById(`${this.props.id}submit`)


            /* 
            
                Declare Events

            */

           close.onclick = () => {
               this.onClose()
           }

            reset.onclick = () => {
                if (this.props.language === 'javascript'){
                    // this.target[this.function] = eval(this.body);
                    // this.body = this.getFunctionBody(this.target[this.function]);
                    // this.head = this.getFunctionHead(this.target[this.function]);
                    this.target[this.key] = this.copy;
                } else if (['html', 'css'].includes(this.props.language)){
                    this.target[this.key] = this.copy;   
                    // try{ eval(this.defaultScripts); } catch(er) {alert('Script error: ', er);}
                } else if (this.props.language === 'glsl'){
                    this.target = this.copy;
                }
                this.input.value = this.copy;
                this._triggerCodeChange()
                this.onSave()
            }

            this.input.oninput = () => {
                this._updateDisplay(this.input.value)
                this._syncScroll(this.input)
                this.onInput(this.input.value)
            }

            if (this.props.shortcuts == null || this.props.shortcuts.save != false){
                this.onKeyDown = (e) => {
                    if ((window.navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey)  && e.keyCode == 83) {
                        e.preventDefault();
                        this.save()
                    }
                }
            }

            let toggle = document.getElementById(`${this.props.id}referenceToggle`)
            if (this.props.language === 'glsl'){
                this.insertGLSLReference()
                toggle.style.display = ''
                toggle.onclick = () => {
                    if(!this.quickrefhidden) {
                        document.getElementById(`${this.props.id}reference`).style.display = 'none';
                        this.quickrefhidden = true;
                    }
                    else {
                        document.getElementById(`${this.props.id}reference`).style.display = '';
                        this.quickrefhidden = false;
                    }
                }
            } else {
                toggle.style.display = 'none'
            }

            submitElement.onclick = () => {

                if (this.props.language === 'javascript'){
                    let newFunc = undefined;
                    try{ 
                        newFunc = eval(
                            // this.head+
                            this.input.value.replace(/window/g,'err').replace(/gapi/g,'err')
                            // +'}'
                            );
                    } 
                    catch (er) {console.log(er)}

                    if(newFunc){
                        this.target[this.key] = newFunc;
                        this.onSave(this.target)

                    } else if (this.key == null && this.target instanceof Object){
                        try {
                            newFunc = eval(`(${this.input.value})`)
                        } catch (e) {
                            console.log(e)
                        }

                        if (newFunc){
                            this.target = newFunc
                            this.head = this.target.name
                            this.body = this.target.prototype.constructor
                            this.onSave(this.target)
                        }
                    }
                } 
                
                else if (['html', 'css'].includes(this.props.language)) {
                    this.target = this.input.value;
                    this.onSave(this.target)
                    // try{ eval(document.getElementById(this.randomId+'htmlscripts').value.replace(/window/g,'err').replace(/gapi/g,'err')); } catch (er) {alert('Script error: ', er);}
                }

                else if (this.props.language === 'glsl'){
                    this.target = this.input.value;
                    this.onSave(this.target)
                }
            }

            document.addEventListener("keydown", this.onKeyDown, false);

            this.input.onscroll = () => {
                this._syncScroll(this.input)
            }

            this.input.onkeydown = (e) => {
                this._checkTab(this.input,e)
            }

            this.updateSettings(this.props.settings)
        }

        this.ui = new DOMFragment(
            template,
            this.parentNode,
            undefined,
            setup
        )
    }

    save(){
        let submitElement = document.getElementById(`${this.props.id}submit`)
        submitElement.click()
    }

    deinit = () => {
        let editor = document.getElementById(`${this.props.id}liveEditor`);
        editor.parentNode.removeChild(editor);   
    }

    _setContent() {

        let head = document.getElementById(`${this.props.id}head`)
        this.input = document.getElementById(`${this.props.id}editor`)
        let reset = document.getElementById(`${this.props.id}reset`)

        // if (this.head != null) head.innerHTML = this.head;

        if (this.body != null) {
            this.input.value = this.body
            this._triggerCodeChange()
        }
        else {
            reset.style.display = 'none'
        }
    }

    _updateSettings(settings){
        this.onSave = settings.onSave ?? (() => {})
        this.onInput = settings.onInput ?? (() => {})
        this.onOpen = settings.onOpen ?? (() => {})
        this.onClose = settings.onClose ?? (() => {})

        let close = document.getElementById(`${this.props.id}close`)
        if (close && settings.showClose === false) close.style.display = 'none'


        // For JS Editor
        this.key = settings.key;

        // For All Editors
        this.target = settings.target; //e.g. this.session.atlas
        if (this.props.language === 'javascript'){

            // Handle Specific Functions (from target)
            if (typeof this.target === 'object' && this.target != null && this.key != null){
                this.head = this.getFunctionHead(this.target[this.key]);
                this.body = this.target[this.key] // this.getFunctionBody(this.target[this.function]);
                this.copy = this.target[this.key].toString();
            } 

            // Handle Whole Classes
            else if (this.key == null && this.target instanceof Object) {
                this.target = this.target
                this.head = settings.className ?? this.target.name;
                this.body = this.target.prototype.constructor.toString().replace(/class (.+){/g, `class ${settings.className}{`)
                this.copy = this.body
            } else {
                console.warn('settings file is improperly configured...')
            }
        } else if (['html', 'css'].includes(this.props.language)) {
            if (this.target != null){
                // if (typeof this.target === 'string'){
                //     this.target = document.getElementById(this.target);
                // }
                this.head = this.props.language // this.target.id
                this.body = this.target[this.key]//this.target.innerHTML
                this.copy = this.target[this.key]//this.target.innerHTML
            } else {
                console.warn('settings file does not contain a target...')
            }
        } else if (this.props.language === 'glsl'){
            if (this.target){
                this.head = 'WebGL Shader';
                this.body = this.target[this.key].replace(new RegExp(";(?!\n)", "g"), ";\n")
                .replace(new RegExp("{(?!\n)", "g"), "{\n")
                .replace(new RegExp("}(?!\n)", "g"), "}\n");
                this.copy = this.body
            } else {
                console.warn('settings file does not contain a target...')
            }
        }
    }

    updateSettings(settings = {}){
        this._updateSettings(settings)
        this._setContent()
    }

    onSave = () => {} // Can be set by user
    onOpen = () => {}
    onClose= () => {}

    //Get the text inside of a function (regular or arrow);
    getFunctionBody = (method) => {
        return method.toString().replace(/^\W*(function[^{]+\{([\s\S]*)\}|[^=]+=>[^{]*\{([\s\S]*)\}|[^=]+=>(.+))/i, '$2$3$4');
    }

    getFunctionHead = (method) => {
        let fnstring = method.toString();
        return fnstring.slice(0,fnstring.indexOf('{') + 1);
    }

    insertGLSLReference = () => {

        document.getElementById(`${this.props.id}editorContainer`)
        .insertAdjacentHTML(
            'afterbegin',
            `<div id='${this.props.id}reference' style='position:absolute; background-color:black; color:white; z-index:2; display:none; font-size:16px bold; height:80%; overflow-y:scroll; border:1px solid red;'>
                <style>
                    table tr th {
                        border: 2px solid gold;
                    }
                    table tr td {
                        border: 1px solid blue;
                    }
                </style>
                Shader Quick Reference Sheet. For common WebGL see: <a style='color:lightgreen;' href='https://www.khronos.org/files/webgl/webgl-reference-card-1_0.pdf'>WebGL Reference Sheet</a>
                <table style='font-size:12px;'>
                    <tr><th width='30%'>Uniforms</th><th width='20%'>Ranges</th><th width='50%'>Descriptions</th></tr>
                    <tr><td>uniform float iTime</td><td>0-</td><td>Time increment</td></tr>
                    <tr><td>uniform float iTimeDelta</td><td>0-</td><td>Time since last frame</td></tr>
                    <tr><td>uniform vec2 iResolution</td><td>0-</td><td>Viewport Resolution</td></tr>
                    <tr><td>uniform vec4 iMouse</td><td>0-dim</td><td>Mouseover relative pixel coordinates, [PosX,PosY,LastClickX,LastClickY]</td></tr>
                    <tr><td>uniform float iMouseInput</td><td>0.0 or 1.0</td><td>Mouse clicked before current frame?</td></tr>
                    <tr><td>uniform sampler2D iImage</td><td>2D array of vec4(r,g,b,a)</td><td>Copy of image from last frame</td></tr>
                    <tr><td>uniform float iAudioFFT[256]</td><td>0-255</td><td>Audio power spectrum, higher index = higher frequencies</td></tr>
                    <tr><td>uniform float iHEG</td><td>-5-+5 typical</td><td>HEG smoothed ratio score, begins at 0</td></tr>
                    <tr><td>uniform float iHRV</td><td>0-50(bpm change)</td><td>Heart Rate Variability</td></tr>
                    <tr><td>uniform float iHR</td><td>30-200(bpm)</td><td>Heart Rate</td></tr>
                    <tr><td>uniform float iHB</td><td>0-1</td><td>Heart Beat, is 1 when heartbeat occurs and falls off to 0 at 1/sec speed </td></tr>
                    <tr><td>uniform float iBRV</td><td>0-10</td><td>Breathing Rate Variability, lower is better</td></tr>
                    <tr><td>uniform float iFFT[256]</td><td>0-150(uV) typical</td><td>EEG Power spectrum 0-128Hz, higher frequencies have much lower values</td></tr>
                    <tr><td>uniform float iFrontalAlpha1Coherence</td><td>0-1 typical</td><td>Alpha 1 Mean Squared Coherence</td></tr>
                    <tr><td>uniform float iDelta</td><td>0-50(uV) typical</td><td>Mean Delta Bandpower</td></tr>
                    <tr><td>uniform float iTheta</td><td>0-50(uV) typical</td><td>Mean Theta Bandpower</td></tr>
                    <tr><td>uniform float iAlpha1</td><td>0-10(uV) typical</td><td>Mean Alpha1 Bandpower</td></tr>
                    <tr><td>uniform float iAlpha2</td><td>0-10(uV) typical</td><td>Mean Alpha2 Bandpower</td></tr>
                    <tr><td>uniform float iBeta</td><td>0-10(uV) typical</td><td>Mean Beta Bandpower</td></tr>
                    <tr><td>uniform float iGamma</td><td>0-5(uV) typical</td><td>Mean Low Gamma (30-45Hz) Bandpower</td></tr>
                    <tr><td>uniform float i40Hz</td><td>0-5(uV) typical</td><td>40Hz Gamma Bandpower</td></tr>
                    <tr><td>uniform float iAlphaTheta</td><td>0-10</td><td>Alpha/Theta Bandpower Ratio</td></tr>
                    <tr><td>uniform float iAlpha1Alpha2</td><td>0-10</td><td>Alpha1/Alpha2 Bandpower Ratio</td></tr>
                    <tr><td>uniform float iAlphaBeta</td><td>0-10</td><td>Alpha/Beta Bandpower Ratio</td></tr>
                    <tr><td>uniform float iThetaBeta</td><td>0-10</td><td>Theta/Beta Bandpower Ratio</td></tr>
                    <tr><td>uniform vec4 iDate</td><td>0-</td><td>x=year,y=month,z=day,w=time of day (sec)</td></tr>
                    <tr><td>uniform float iFrame</td><td>0-</td><td>Frame ticks since begin</td></tr>
                    <tr><td>uniform float iFrameRate</td><td>0-</td><td>Frames per Second</td></tr>
                    <tr><td>uniform sampler2D iChannel0..3</td><td>2D array of vec4(r,g,b,a)</td><td>Texture channel, by default has a 2048x2048 grid texture</td></tr>
                    <tr><td>uniform vec3 iChannelResolution[4]</td><td>Array of vec3</td><td>Texture resolution, default 2048x2048</td></tr>
                    <tr><td>uniform float iChannelTime[4]</td><td>Array of float</td><td>iTime per channel, same as iTime just used by some shaderToys</td></tr>
                    <tr><td colSpan=3>If pasting from ShaderToy and it only has the mainImage function but no main(), paste this at the bottom of the shader: <br>
                      void main() {<br>
                        mainImage(gl_FragColor, vUv*iResolution);<br>
                      }
                    </td></tr>
                </table>
            </div>
            `)
    }

    // Live Editor Internal Functionality
    _replaceFunctionBody = (fnToReplace,newBody) => {
        let head = this.getFunctionHead(fnToReplace);
        let newFunc = eval(head+newBody+'}');
        return newFunc;
    }

    // Live Editor UI Updates
    _updateDisplay = (text) => {
        let result_element = this.parentNode.querySelector(`.brainsatplay-code-highlighting-content`);
        let replacedText = text.replace(new RegExp("\&", "g"), "&amp").replace(new RegExp("\<", "g"), "&lt;"); // Don't Actually Create New HTML
        result_element.innerHTML = replacedText;
        Prism.highlightElement(result_element);
    }

    _syncScroll = (element) => {
        /* Scroll result to scroll coords of event - sync with textarea */
        let result_element = this.parentNode.querySelector(".brainsatplay-code-highlighting");
        // Get and set x and y
        result_element.scrollTop = element.scrollTop;

        // If the scroll limit has been reached, flip the synchronization
        if (result_element.scrollTop < element.scrollTop) element.scrollTop = result_element.scrollTop

        result_element.scrollLeft = element.scrollLeft;
      }

    _triggerCodeChange(){
        var event = document.createEvent("Event");
        event.initEvent("input", true, true);
        document.getElementById(`${this.props.id}editor`).dispatchEvent(event);
    }

    _checkTab = (element, event) => {
        let code = element.value;
        if(event.key == "Tab") {
            /* Tab key pressed */
            event.preventDefault(); // stop normal
            let before_tab = code.slice(0, element.selectionStart); // text before tab
            let after_tab = code.slice(element.selectionEnd, element.value.length); // text after tab
            let cursor_pos = element.selectionEnd + 1; // where cursor moves after tab - 2 for 2 spaces
            element.value = before_tab + "\t" + after_tab; // add tab char - 2 spaces
            // move cursor
            element.selectionStart = cursor_pos;
            element.selectionEnd = cursor_pos;

            // Trigger Update Function
            this._triggerCodeChange()
        }
    }
}