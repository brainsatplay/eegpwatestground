//TODO: WebXR, Generalize threejs scene composition


import {Session} from '../../../libraries/js/src/Session'
import {DOMFragment} from '../../../libraries/js/src/ui/DOMFragment'
import { SoundJS } from '../../../libraries/js/src/utils/Sound';
import { LiveEditor } from '../../../libraries/js/src/ui/LiveEditor'
import { eegmath } from '../../../libraries/js/src/utils/eegmath';

import * as settingsFile from './settings'

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GUI } from 'three/examples/jsm/libs/dat.gui.module'

import {addChannelOptions, addCoherenceOptions } from '../../../platform/js/frontend/menus/selectTemplates'

import {GraphManager} from '../../../libraries/js/src/GraphManager'
import {Buzz} from '../../../libraries/js/src/plugins/haptics/Buzz'

//Import shader urls
import vertexShader from './shaders/vertex.glsl'
import galaxyFragmentShader from "./shaders/fractalGalaxy/fragment.glsl"
import negaGalaxyFragmentShader from "./shaders/nega_fractalGalaxy/fragment.glsl"
import wavesFragmentShader from './shaders/waves/fragment.glsl'
import noiseCircleFragmentShader from './shaders/noiseCircle/fragment.glsl'
import creationFragmentShader from './shaders/creation/fragment.glsl'
import blobFragmentShader from './shaders/voronoiblobs/fragment.glsl'
import fractalpyramidFragmentShader from './shaders/fractalpyramid/fragment.glsl'
import cineshaderlavaFragmentShader from './shaders/cineshaderlava/fragment.glsl'
import octagramsFragmentShader from './shaders/octagrams/fragment.glsl'
import marbleFragmentShader from './shaders/marble/fragment.glsl'
import turbulenceFragmentShader from './shaders/turbulence/fragment.glsl'
import pulseFragmentShader from './shaders/pulse/fragment.glsl'

import spinthings from './shaders/spinthings/fragment.glsl'
import bandsynth from './shaders/bandlimited/fragment.glsl'
import tripclock from './shaders/clock/fragment.glsl'
import julia from './shaders/julia/fragment.glsl'

//Import sound files
import bloops from './sounds/wav/guitarbloops.wav'
import acousticloop3 from './sounds/wav/acousticloop3.wav'
import washhigh from './sounds/wav/wash_high.wav'
import washlow from './sounds/wav/wash_low.wav'
import oceanwaves from './sounds/mp3/oceanwaves.mp3'
import fluteloop1 from './sounds/wav/fluteloops1.wav'
import fluteloop2 from './sounds/wav/fluteloops2.wav'
import fluteloop3 from './sounds/wav/fluteloops3.wav'
import fluteshot1 from './sounds/wav/fluteshot1.wav'
import fluteshot2 from './sounds/wav/fluteshot2.wav'
import drumhit1 from './sounds/wav/drum_hit_1.wav'
import drumkick1 from './sounds/wav/drum_kick_1.wav'

//Textures
import uvgrid from './uvgrid.png'


import { TutorialManager } from '../../../libraries/js/src/ui/TutorialManager';

//Example Applet for integrating with the UI Manager
export class SensoriumApplet {

    constructor(
        parent=document.body,
        session=new Session(),
        settings=[]
    ) {

        //-------Keep these------- 
        this.session = session; //Reference to the Session to access data and subscribe
        this.parentNode = parent;
        this.info = settingsFile.settings;
        this.settings = settings;
        this.AppletHTML = null;
        //------------------------

        //settings structure
        /*
        settings input: [{
            "title": false, //true or false for intro title
            "mode": "multi", //solo or multi auto select
            "domain": "https://localhost:443", //Set server domain settings to find sessions
            "login": false, // choose username, randomid if not specified
            "session": true, // specify session name, true for autojoin
            "spectating": false // select whether you are spectating or participating
            "shader":{
                "name":"Galaxy"
                OR
                "frag": "raw glsl code"
            }}{
            "feedback":"iHEG",  //can use the option value OR text i.e. "HEG Ratio"
            "soundurl":{
                "name":"",
                "url":"", //Optional if you have a custom url
                OR
                "buffer":bufferdata //directly copy a sound buffer
            }
        }, {
            //add more feedback and sound settings
        }];
        */

        if(this.settings.length === 0) this.settings = [{}];


        
        this.props = { //Changes to this can be used to auto-update the HTML and track important UI values 
            id: String(Math.floor(Math.random()*1000000)), //Keep random ID
            //Add whatever else
        };

        //-------Required Multiplayer Properties------- 
        this.subtitle = `Dynamic audiovisual feedback. Let's get weird!` // Specify a subtitle for the title screen
        //----------------------------------------------

        //-------Other Multiplayer Properties------- 
        this.stateIds = []
        this.mode = 'single';
        this.roomId = true;
        //----------------------------------------------


        // Plugins
        this.graph = new GraphManager(this.session)
        let app = {
			props: {
				id: this.props.id
			},
			info: {
                name: this.info.name, 
                graph: {
                    nodes: [
                        {id: 'buzz', class: Buzz},
                    ],
                }
            }
		}

        this.graph.init(app)
        this.graph.streams = ['modifiers','hostData']

        this.tutorialManager = null

        this.currentView = 'plane'

        // Audio
        this.effectStruct = { source:undefined, input:undefined, controls:undefined, feedback:undefined, feedbackOption:undefined, muted:false, lastGain:1, uiIdx:false, sourceIdx:false, playing:false, id:undefined, paused:false, playbackRate:1 };
        this.visuals = [];
        this.effects = [];//array of effectStructs
        this.soundUrls = [
            {url:oceanwaves, name:"Ocean Waves"},
            {url:bloops, name:"Guitar Bloops"},
            {url:washhigh, name:"Guitar Wash (High)"},
            {url:washlow, name:"Guitar Wash (Low)"},
            {url:acousticloop3, name:"Acoustic Loop"},
            {url:drumhit1, name:"Drum Sound 1"},
            {url:drumkick1, name:"Drum Kick 1"},
            {url:fluteshot2, name:"Flute Shot 2"},
            {url:fluteloop1, name:"Flute Loop 1"},
            {url:fluteloop2, name:"Flute Loop 2"},
            {url:fluteloop3, name:"Flute Loop 3"},
            {url:fluteshot1, name:"Flute Shot 1"},
            {url:fluteshot2, name:"Flute Shot 2"},
        ];

        this.looping = false;
        this.hidden = false;
        this.editorhidden = true;
        this.quickrefhidden = true;
        this.shaderEdited = false;

        // UI
        this.three = {}
        this.currentShader = null;

        this.three.planes = [];
        this.guiControllers = [];

        this.mouseclicked = 0.0;
        this.mousexyzw = [0,0,0,0];

        //Available uniforms for shaders. See comments for usage
        this.modifiers = {
            iAudio:           new Array(256).fill(0),     //Audio analyser FFT, array of 256, values max at 255
            iHRV:             1,                          //Heart Rate Variability (values typically 5-30)
            iHEG:             0,                          //HEG change from baseline, starts at zero and can go positive or negative
            iHR:              1,                          //Heart Rate in BPM
            iHB:              0,                          //Is 1 when a heart beat occurs, falls off toward zero on a 1/t curve (s)
            iBRV:             0,                          //Breathing rate variability, usually low, ideal is 0.
            iFFT:             new Array(256).fill(0),     //Raw EEG FFT, array of 256. Values *should* typically be between 0 and 100 (for microvolts) but this can vary a lot so normalize or clamp values as you use them
            iDelta:           1,                          //Delta bandpower average. The following bandpowers have generally decreasing amplitudes with frequency.
            iTheta:           1,                          //Theta bandpower average.
            iAlpha1:          1,                          //Alpha1 " "
            iAlpha2:          1,                          //Alpha2 " "
            iBeta:            1,                          //Beta " "
            iGamma:           1,                          //Low Gamma (30-45Hz) " "
            iThetaBeta:       1,                          //Theta/Beta ratio
            iAlpha1Alpha2:    1,                          //Alpha1/Alpha2 ratio
            iAlphaBeta:       1,                          //Alpha/Beta ratio
            i40Hz:            1,                          //40Hz bandpower
            iFrontalAlpha1Coherence: 0                           //Alpha 1 coherence, typically between 0 and 1 and up, 0.9 and up is a strong correlation
        };

        this.uniformSettings = {
            iAudio:           {default: new Array(256).fill(0), min:0,max:255},              //Audio analyser FFT, array of 256, values max at 255
            iHRV:             {default:1, min:0, max:40,step:0.5},                           //Heart Rate Variability (values typically 5-30)
            iHEG:             {default:0, min:-3, max:3,step:0.1},                           //HEG change from baseline, starts at zero and can go positive or negative
            iHR:              {default:1, min:1, max:240,step:1},                            //Heart Rate in BPM
            iHB:              {default:0, min:0, max:1},                                     //Is 1 when a heart beat occurs, falls off toward zero on a 1/t curve (s)
            iBRV:             {default:1, min:0, max:10,step:0.5},                           //Breathing rate variability, usually low, ideal is 0.
            iFFT:             {default:new Array(256).fill(0),min:0,max:1000},               //Raw EEG FFT, array of 256. Values *should* typically be between 0 and 100 (for microvolts) but this can vary a lot so normalize or clamp values as you use them
            iDelta:           {default:1, min:0, max:100,step:0.5},                          //Delta bandpower average. The following bandpowers have generally decreasing amplitudes with frequency.
            iTheta:           {default:1, min:0, max:100,step:0.5},                          //Theta bandpower average.
            iAlpha1:          {default:1, min:0, max:100,step:0.5},                          //Alpha1 " "
            iAlpha2:          {default:1, min:0, max:100,step:0.5},                          //Alpha2 " "
            iBeta:            {default:1, min:0, max:100,step:0.5},                          //Beta " "
            iGamma:           {default:1, min:0, max:100,step:0.5},                          //Low Gamma (30-45Hz) " "
            iThetaBeta:       {default:1, min:0, max:5,step:0.1},                            //Theta/Beta ratio
            iAlpha1Alpha2:    {default:1, min:0, max:5,step:0.1},                            //Alpha1/Alpha2 ratio
            iAlphaBeta:       {default:1, min:0, max:5,step:0.1},                            //Alpha/Beta ratio
            iAlphaTheta:      {default:1, min:0, max:5,step:0.1},
            i40Hz:            {default:1, min:0, max:10,step:0.1},                           //40Hz bandpower
            iFrontalAlpha1Coherence: {default:0, min:0, max:1.1,step:0.1}                           //Alpha 1 coherence, typically between 0 and 1 and up, 0.9 and up is a strong correlation
        };

        let date = new Date();

        this.additionalUniforms = {
            iTime: 0, //milliseconds elapsed from shader begin
            iTimeDelta:0,
            iFrame:0,
            iFrameRate:0,
            iChannelTime:[0,0,0,0],
            iChannelResolution:[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()],
            iChannel0:null,
            iChannel1:null,
            iChannel2:null,
            iChannel3:null,
            iSampleRate:44100,
            iResolution: ['x','y'], //viewport resolution
            iDate: new THREE.Vector4(date.getYear(),date.getMonth(),date.getDay(),date.getHours()*3600+date.getMinutes()*60+date.getSeconds()),
            iMouse: ['x','y','z','w'],  //XY mouse coordinates, z, w are last click location
            iMouseInput: false, //Click occurred before past frame?
            iImage: null //Texture map returned from shader (to keep state)
        }

        this.shaders = {
            galaxy: {
                name: 'Galaxy',
                vertexShader: vertexShader,
                fragmentShader: galaxyFragmentShader,
                uniforms: ['iResolution','iTime','iAudio','iHRV','iHEG','iHB','iHR','iFrontalAlpha1Coherence', 'iFFT'],
                credit: 'JoshP x CBS'
            },
            negagalaxy: {
                name: 'Nega Galaxy',
                vertexShader: vertexShader,
                fragmentShader: negaGalaxyFragmentShader,
                uniforms: ['iResolution','iTime','iAudio','iHRV','iHEG','iHB','iHR','iFrontalAlpha1Coherence'],
                credit: 'JoshP'
            },
            creation: {
                name: 'Creation',
                vertexShader: vertexShader,
                fragmentShader: creationFragmentShader,
                uniforms: ['iResolution','iTime','iFrontalAlpha1Coherence','iHEG','iHRV'],
                credit: 'Danilo Guanabara'
            },
            voronoiblobs: {
                name: 'Voronoi Blobs',
                vertexShader: vertexShader,
                fragmentShader: blobFragmentShader,
                uniforms: ['iResolution','iTime','iHEG','iHB','iAudio','iFrontalAlpha1Coherence'],
                credit: 'Elise'
            },
            spinthings: {
                name: 'Spin Things',
                vertexShader: vertexShader,
                fragmentShader: spinthings,
                uniforms: ['iResolution','iTime','iHEG','iHRV','iHB','iAudio','iFrontalAlpha1Coherence'],
                credit: 'Vinicius_Jesus'
            },
            pulse: {
                name: 'Pulse',
                vertexShader: vertexShader,
                fragmentShader: pulseFragmentShader,
                uniforms: ['iResolution','iTime','iHEG','iHRV','iHR','iHB','iAudio','iFrontalAlpha1Coherence'],
                credit: 'haquxx'
            },
            marble: {
                name: 'Glowing Marble',
                vertexShader: vertexShader,
                fragmentShader: marbleFragmentShader,
                uniforms: ['iResolution','iTime','iHEG','iHRV','iHR','iHB','iAudio','iFrontalAlpha1Coherence'],
                credit: 'nasana'
            },
            turbulence: {
                name: 'Turbulence',
                vertexShader: vertexShader,
                fragmentShader: turbulenceFragmentShader,
                uniforms: ['iResolution','iTime','iHEG','iHRV','iHB','iAudio','iFrontalAlpha1Coherence'],
                credit: 'exandro'
            },
            bandwidth: {
                name: 'Bandlimited Synthesis',
                vertexShader: vertexShader,
                fragmentShader: bandsynth,
                uniforms: ['iResolution','iTime','iHEG','iHB','iAudio','iFrontalAlpha1Coherence'],
                credit: 'Vinicius_Jesus'
            },
            clock: {
                name: 'Clock',
                vertexShader: vertexShader,
                fragmentShader: tripclock,
                uniforms: ['iResolution','iTime','iHEG','iHRV','iHB','iAudio','iFrontalAlpha1Coherence','iDate'],
                credit: '4eckme'
            },
            julia: {
                name: 'Julia Set',
                vertexShader: vertexShader,
                fragmentShader: julia,
                uniforms: ['iResolution','iTime','iHEG','iHR','iHB','iAudio','iFFT','iFrontalAlpha1Coherence'],
                credit: 'gaetanThiesson'
            }
        }

        this.brainMetrics = [
            {name:'delta',label: 'Delta', color: [0,0.5,1]}, // Blue-Cyan
            {name:'theta',label: 'Theta',color: [1,0,1]}, // Purple
            {name:'alpha1',label: 'Low Alpha',color:[0,1,0]}, // Green
            {name:'alpha2',label: 'High Alpha',color: [0,1,0]}, // Green
            {name:'beta',label: 'Beta',color: [1,1,0]}, // Yellow
            {name:'lowgamma',label: 'Gamma',color: [1,0,0]} // Red
        ]

        this.brainData = []   
        this.lastColorSwitch=Date.now() 
        this.isHost = false;
        this.hostStreamId = undefined;
        this.hostStreamSub = undefined;
        this.hostSoundsUpdated = false;

        this.history = 5; 

this.shaderTemplate = `
#define FFTLENGTH 256
precision mediump float;
uniform vec2 iResolution; //Shader display resolution
uniform float iTime; //Shader time increment

uniform float iHEG;
uniform float iHRV;
uniform float iHR;
uniform float iHB;
uniform float iFrontalAlpha1Coherence;
uniform float iFFT[FFTLENGTH];
uniform float iAudio[FFTLENGTH];
void main(){
    gl_FragColor = vec4(iAudio[20]/255. + iHEG*0.1+gl_FragCoord.x/gl_FragCoord.y,gl_FragCoord.y/gl_FragCoord.x,gl_FragCoord.y/gl_FragCoord.x - iHEG*0.1 - iAudio[120]/255.,1.0);
}                    
`;
    }

    //---------------------------------
    //---Required template functions---
    //---------------------------------

    //Initalize the app with the DOMFragment component for HTML rendering/logic to be used by the UI manager. Customize the app however otherwise.
    init() {

        //HTML render function, can also just be a plain template string, add the random ID to named divs so they don't cause conflicts with other UI elements
        let HTMLtemplate = (props=this.props) => { 
            return `
            <div id='${props.id}' style='height:100%; width:100%; position: relative; max-height: 100vh;'>
                            
                <button id='`+props.id+`showhide' style='position:absolute; top: 0px; z-index:5; opacity:1;'>Hide Controls</button> 
                <div id='${props.id}overlay' style='position:absolute; z-index:4; height:100%; width:100%; opacity:0.0; background-color:black; transition:all 1s ease-in-out; pointer-events:none;'></div>
                <div id='`+props.id+`menu' style='display: flex; transition: 0.5s; max-height: 100%; padding: 25px; position: absolute; top: 0; left: 0; width: 100%; z-index:4; overflow: hidden; background: rgba(0,0,0,0.0); height: 100%;'>
                    <div>
                        <div class='guiContainer' style="position:absolute; bottom: 0px; left: 0px; z-index: 6;"></div>
                        <div style="display: flex; align-items: center;">
                            <h3 style='text-shadow: 0px 0px 2px black, 0 0 10px black;'>Effects</h3>
                            <button id='${props.id}addeffect' style="background: black; color: white; margin: 25px 10px;">+</button>
                            <button id='${props.id}changeview' style="background: black; color: white; margin: 25px 10px;">Change View</button>
                            <button id='${props.id}submitconfig' style="background: black; color: white; margin: 25px 10px; display:none;">Set Game Config</button>
                            <button id='${props.id}share' style="background: black; color: white; margin: 25px 10px;">Get Shareable Link</button>
                            <span style='text-shadow: 0px 0px 2px black, 0 0 10px black;' id='${props.id}menuspan'>User Controls:</span><input type='checkbox' id='${props.id}controls' checked>
                            <span style='text-shadow: 0px 0px 2px black, 0 0 10px black;' id='${props.id}menuspan2'>Share Modifiers:</span><input type='checkbox' id='${props.id}modifiers'>
                        </div>
                        <div id='${props.id}effectmenu'></div>
                    </div>
                    <div style="width: 100%; height: 100%;">
                        <div>
                            <select id='${props.id}shaderSelector'>
                            </select>
                            <button id='${props.id}editshader'>Edit</button>
                        </div>
                        <div id='${props.id}editorContainer' style='height: 100%; width: 100%; padding: 25px; position: relative; display:none;'>
                        </div>
                    </div>
                </div>

                <div id='${props.id}container' style="height:100%; width:100%; z-index:0;">
                </div>
            </div>  
                                        
            `;
        }

        //HTML UI logic setup. e.g. buttons, animations, xhr, etc.
        let setupHTML = (props=this.props) => {
            this.session.registerApp(this)
            this.session.startApp(this.props.id)

            document.getElementById(props.id+'changeview').onclick = () => {
                this.swapCurrentView();
            }

            this.appletContainer = document.getElementById(props.id);
            this.currentShader = this.shaders[Object.keys(this.shaders)[0]];

            let editorContainer = document.getElementById(`${props.id}editorContainer`);
            this.liveEditor = new LiveEditor(
                {
                    language: 'glsl', 
                    target: this.currentShader,
                    key: 'fragmentShader',
                    onSave: () => {
                        this.shaderEdited = true;
                        this.setShaderFromText(this.liveEditor.input.value);
                    }
            }, editorContainer)

            this.tutorialManager = this.createTutorial()
            this.tutorialManager.updateParent(this.appletContainer)


            document.getElementById(this.props.id).onmousemove = (ev) => {
                this.mousexyzw[0] = ev.offsetX;
                this.mousexyzw[1] = ev.offsetY;
            }

            document.getElementById(this.props.id).onmousedown = (ev) => {
                this.mouseclicked = 1.0;
                this.mousexyzw[2] = ev.offsetX;
                this.mousexyzw[3] = ev.offsetY;
            }

            /**
             * GUI
             */
            this.canvasContainer = document.getElementById(props.id+'container')
            this.gui = new GUI({ autoPlace: false });
            this.appletContainer.querySelector('.guiContainer').appendChild(this.gui.domElement);

            document.getElementById(props.id+'editshader').onclick = () => {
                if(this.editorhidden === false) {
                    document.getElementById(`${props.id}editorContainer`).style.display = 'none';
                    this.editorhidden = true;
                } else {
                    document.getElementById(`${props.id}editorContainer`).style.display = '';
                    this.editorhidden = false;
                }
            }

            document.getElementById(props.id+'addeffect').onclick = () => {
                this.addSoundInput();
                console.log('clicked to add sound input')
            };

            let selector = document.getElementById(`${this.props.id}shaderSelector`)
            Object.keys(this.shaders).forEach((k) => {
                selector.insertAdjacentHTML('beforeend', `<option value='${this.shaders[k].name}'>${this.shaders[k].name} by ${this.shaders[k].credit}</option>`)
            });
            selector.insertAdjacentHTML('beforeend', `<option value='fromtext'>Blank Shader</option>`)
            this.swapShader();
            
            
            selector.onchange = (ev) => {


                let onSwap = () => {
                    if(this.previousSelect === 'fromtext')
                    this.shaderTemplate = this.liveEditor.input.value;
                
                    this.previousSelect = ev.target.value;

                    if (ev.target.value === 'fromtext') {
                        console.log('from text')
                        // document.getElementById(props.id+'textshader').style.display = '';
                        this.startTime = Date.now(); //reset start time

                        let fragmentShader = this.shaderTemplate;
                        this.liveEditor.updateSettings({language: 'glsl', target: fragmentShader})

                        editorContainer.style.display = '';
                        this.editorhidden = false;
                    }
                    else if (ev.target.value != 'Gallery'){
                        for(const prop in this.shaders) {
                            if(ev.target.value === this.shaders[prop].name) {
                                this.currentShader = this.shaders[prop];
                                break;
                            }
                        }
                        if(ev.target.value === 'Galaxy' || ev.target.value === 'Nega Galaxy')  this.startTime = Date.now() - Math.random()*1000000; //random start time for default shaders just to vary them up
                        this.shaderEdited = false;
                        this.swapShader();
                        this.setEffectOptions();
                    } 
                    else {
                    
                        // document.getElementById(props.id+'textshader').style.display = 'none';
                    }

                    document.getElementById(this.props.id+'overlay').style.opacity = 0.0;
                }

                if(this.startTime < 1) {
                    document.getElementById(this.props.id+'overlay').style.opacity = 1.0;

                    setTimeout(()=>{
                        onSwap();
                    },1000);
                } else onSwap();
                  
            }

            let showhide = document.getElementById(props.id+'showhide');
            let menu = document.getElementById(props.id+"menu")
            showhide.onclick = () => {
                if(this.hidden == false) {
                    this.hidden = true;
                    menu.style.maxHeight = "0";
                    menu.style.padding = "0% 25px"
                    document.getElementById(props.id+"showhide").innerHTML = "Show Controls";
                    if(document.getElementById(props.id+'exitSession') && this.mode === 'multi') {
                        document.getElementById(props.id+'exitSession').style.display = 'none';   
                    }
                    // document.getElementById(props.id+'addeffect').style.display = "none";
                    // document.getElementById(props.id+'effectmenu').style.display = "none";
                    // document.getElementById(props.id+'shaderSelector').style.display = "none";
                    // this.appletContainer.querySelector('.guiContainer').style.display = "none";
                    // document.getElementById(props.id+'Micin').style.display = "none";
                }
                else{
                    this.hidden = false;
                    menu.style.maxHeight = "100%";
                    menu.style.padding = '25px'
                    document.getElementById(props.id+"showhide").innerHTML = "Hide Controls";
                    document.getElementById(props.id+'addeffect').style.display = "";
                    document.getElementById(props.id+'effectmenu').style.display = "";
                    document.getElementById(props.id+'shaderSelector').style.display = "";
                    this.appletContainer.querySelector('.guiContainer').style.display = "";
                    if(document.getElementById(props.id+'exitSession') && this.mode === 'multi') {
                        document.getElementById(props.id+'exitSession').style.display = '';   
                    }
                }
            }

            showhide.onmouseover = () => {
                showhide.style.opacity = 1.0;
            }
            showhide.onmouseleave = () => {
                showhide.style.opacity = 0.2;
            }

            document.getElementById(props.id+'submitconfig').onclick = () => {
                let config;
                if(!this.hostSoundsUpdated) {
                    config = this.getCurrentConfiguration(true,document.getElementById(this.props.id+'modifiers').checked);
                    this.hostSoundsUpdated = true;
                } else {
                    config = this.getCurrentConfiguration(false,document.getElementById(this.props.id+'modifiers').checked);
                }
                this.session.setSessionSettings(this.roomId,config);
            }

            document.getElementById(props.id+'share').onclick = () => {
                let address = this.generateShareableAddress();
                navigator.clipboard.writeText(address).then(function() {
                    console.log('Async: Copying to clipboard was successful!');
                  }, function(err) {
                    console.error('Async: Could not copy text: ', err);
                });
                document.getElementById(props.id+'share').innerHTML = "Copied to Clipboard!";
                setTimeout(()=>{document.getElementById(props.id+'share').innerHTML = "Get Shareable Link"},1000);
            }

        }


        this.AppletHTML = new DOMFragment( // Fast HTML rendering container object
            HTMLtemplate,       //Define the html template string or function with properties
            this.parentNode,    //Define where to append to (use the parentNode)
            this.props,         //Reference to the HTML render properties (optional)
            setupHTML,          //The setup functions for buttons and other onclick/onchange/etc functions which won't work inline in the template string
            undefined,          //Can have an onchange function fire when properties change
            "NEVER"             //Changes to props or the template string will automatically rerender the html template if "NEVER" is changed to "FRAMERATE" or another value, otherwise the UI manager handles resizing and reinits when new apps are added/destroyed
        );  

        
        this.AppletHTML.appendStylesheet("./_dist_/platform/styles/css/prism/prism-vsc-dark-plus.css");

        //Add whatever else you need to initialize
        this.looping = true;
        
        this.ct = 0;


    /**
     * Scene
     */
    this.three.scene = new THREE.Scene()

    /**
     * Camera
     */

    this.baseCameraPos = new THREE.Vector3(0,0,3)
    this.camera = new THREE.PerspectiveCamera(75, this.canvasContainer.offsetWidth/this.canvasContainer.offsetHeight, 0.01, 1000)
    this.camera.position.z = this.baseCameraPos.z//*1.5

    /**
     * Texture Params
     */

    let containerAspect = this.canvasContainer.offsetWidth/this.canvasContainer.offsetHeight //this.appletContainer.offsetWidth/this.appletContainer.offsetHeight
    this.fov_y = this.camera.position.z * this.camera.getFilmHeight() / this.camera.getFocalLength();

    // Square
    //  this.three.meshWidth = this.three.meshHeight = Math.min(((fov_y)* this.camera.aspect) / containerAspect, (fov_y)* this.camera.aspect);

    // Fit Screen
    this.three.meshWidth = this.fov_y * this.camera.aspect
    this.three.meshHeight = this.three.meshWidth/containerAspect

    // Renderer
    this.three.renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } );
    this.three.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2))
    this.three.renderer.setSize( this.canvasContainer.offsetWidth, this.canvasContainer.offsetHeight );
    this.canvasContainer.appendChild( this.three.renderer.domElement );
    this.three.renderer.domElement.style.width = '100%'
    this.three.renderer.domElement.style.height = '100%'
    this.three.renderer.domElement.id = `${this.props.id}canvas`
    this.three.renderer.domElement.style.opacity = '0'
    this.three.renderer.domElement.style.transition = 'opacity 1s'

    // Controls
    this.controls = new OrbitControls(this.camera, this.three.renderer.domElement)
    this.controls.enablePan = true
    this.controls.enableDamping = true
    this.controls.enabled = true;
    this.controls.minPolarAngle = 2*Math.PI/6; // radians
    this.controls.maxPolarAngle = 4*Math.PI/6; // radians
    this.controls.minDistance = this.baseCameraPos.z; // radians
    this.controls.maxDistance = this.baseCameraPos.z*1000; // radians

    // Plane
    const geometry = this.createViewGeometry();
    let tStart = Date.now();

    let shaderKeys = Object.keys(this.shaders);
    let numShaders = shaderKeys.length;

    this.additionalUniforms.iResolution = new THREE.Vector2(this.three.meshWidth, this.three.meshHeight); //Required for ShaderToy shaders
    
    let k = shaderKeys[0];
    // shaderKeys.forEach((k,i) => {
        let material = new THREE.ShaderMaterial({
            transparent: true,
            side: THREE.DoubleSide,
            vertexShader: this.shaders[k].vertexShader,
            fragmentShader: this.shaders[k].fragmentShader,
            uniforms: {}// Default Uniforms 
        });

        
        let bciuniforms = {}; 
        this.shaders[k].uniforms.forEach((u)=>{
            let pass = false;
            for(const prop in this.modifiers) {
                if(u === prop) {
                    bciuniforms[u]={value:this.modifiers[u]};
                    pass = true;
                    break;
                }
            }
            if(!pass) {
                let found = Object.keys(this.additionalUniforms).find((j) => {
                    if(u === j) {
                        return true;
                    }
                });
                if(found) {
                    if(u === 'iImage') {
                        this.three.renderer.domElement.ctx.clearRect(0,0,this.AppletHTML.node.clientWidth,this.AppletHTML.node.clientHeight);
                        bciuniforms[u]={type:'t', value: new THREE.Texture(this.three.renderer.domElement.toDataURL())}
                    }
                    else if (u === 'iChannelResolution') {
                        bciuniforms[u] = {type:'v3v', value:this.additionalUniforms[u]};
                    }   else if (u.includes('iChannel')) {
                        if(!this.additionalUniforms[u]) {
                            this.additionalUniforms[u] = new THREE.Texture(uvgrid);
                        }
                        bciuniforms[u] = {type:'t', value:this.additionalUniforms[u]};
                        if(!bciuniforms['iChannelResolution']) {
                            bciuniforms['iChannelResolution'] = {type:'v3v', value:this.additionalUniforms['iChannelResolution']};
                        }
                        let ch = parseInt(u[8]);
                        bciuniforms['iChannelResolution'].value[ch] = new THREE.Vector3(
                            bciuniforms[u].value.image.width,
                            bciuniforms[u].value.image.height
                        )
                    }
                    else bciuniforms[u]={value:this.additionalUniforms[u]};
                }
            } //add arbitrary uniforms not listed anywhere
        });
        material.uniforms = bciuniforms;
    

        let radius = 0;//10
        let plane = new THREE.Mesh(geometry, material)
        plane.name = k
        let angle = (2 * Math.PI * 1) - Math.PI/2
        // let angle = (2 * Math.PI * i/numShaders) - Math.PI/2
        plane.position.set(radius*(Math.cos(angle)),0,radius*(Math.sin(angle)))
        plane.rotation.set(0,-angle - Math.PI/2,0)
        this.three.planes.push(plane)
        this.three.scene.add(plane)
    // });

        // Animate
        this.startTime = Date.now();
        this.render = () => {
            if (this.three.renderer.domElement != null){

                let time = (Date.now() - this.startTime)/1000;
                this.additionalUniforms.iTimeDelta = time - this.additionalUniforms.iTime;
                this.additionalUniforms.iTime = time;
                this.additionalUniforms.iFrame++;
                this.additionalUniforms.iFrameRate = 1/(this.additionalUniforms.iTimeDelta*0.001);
                
                
                let userData = this.session.getBrainstormData(this.info.name, this.graph.streams)
                //let hostData = this.session.getHostData(this.info.name);
                //console.log(userData)
                if (userData.length > 0){
                    let averageModifiers = {};
                    userData.forEach((data) => {
                       if(!data['modifiers']) data['modifiers'] = this.modifiers;
                       if (data['modifiers']){
                            // Only average watched values
                            this.currentShader.uniforms.forEach(name => {
                                if (averageModifiers[name] == null) averageModifiers[name] = []

                                if (data['modifiers'][name] != null && data['modifiers'][name].constructor === Uint8Array) {
                                    data['modifiers'][name] = Array.from(data['modifiers'][name])
                                }
                                averageModifiers[name].push(data['modifiers'][name])
                            });
                        }
                    })

                    for (let mod in averageModifiers){
                        if (!Array.isArray(averageModifiers[mod][0])) averageModifiers[mod] = this.session.atlas.mean(averageModifiers[mod])
                        else { // Average across each sample (e.g. FFTs)
                            let newArr = Array(averageModifiers[mod][0].length)
                            for (let i = 0; i < newArr.length; i++){
                                let sampleAve = []
                                averageModifiers[mod].forEach(a => {
                                    if (a != null) sampleAve.push(a[i])
                                })
                                newArr[i] = this.session.atlas.mean(sampleAve)
                            }
                            averageModifiers[mod] = newArr
                        }
                    }

                    let neosensoryBuzz = this.session.getDevice('buzz')
                    if (neosensoryBuzz){
                        this.updateBuzz(averageModifiers)
                    }

                    this.three.planes.forEach(p => {
                        this.updateMaterialUniforms(p.material,averageModifiers);
                    });

                    this.controls.update()
                    this.three.renderer.render( this.three.scene, this.camera );
                }
            }
        };

        this.three.renderer.setAnimationLoop( this.render );
        this.animate();

        setTimeout(() => {
            this.three.renderer.domElement.style.opacity = '1'
        }, 100)
        
        document.getElementById(this.props.id+'addeffect').click();

        //console.log(this.settings);

        this.session.createIntro(this, (info) => {
            this.tutorialManager.init();
            if(info && this.roomId !== info.id){
                this.mode = 'multi';

                if(this.hostStreamId) {
                    this.stateIds.forEach(id => this.session.state.unsubscribeAll(id));
                    this.session.state.unsubscribe(this.roomId,this.hostStreamSub);
                }

                this.roomId = info.id;
            
                this.hostData = {};
                // Multiplayer
                this.stateIds.push(this.session.streamAppData('modifiers', this.modifiers, this.roomId ));
                this.hostStreamId = this.session.streamAppData('hostData', this.hostData, this.roomId );
                this.stateIds.push(this.hostStreamId);
                
                
                this.hostStreamSub = this.session.state.subscribe(this.roomId ,(newResult)=>{
                    //console.log(newResult)
                    if(newResult.settings[0]) {
                        if(!newResult.settings[0].settingsSet) {
                            this.configure(newResult.settings);
                            newResult.settings[0].settingsSet = true;
                        }
                    }
                            
                    if(newResult.host) {
                        if(this.session.info.auth.id === newResult.host && !this.isHost) {
                            this.isHost = true;
                            document.getElementById(this.props.id+'submitconfig').style.display = '';
                        } else if (this.session.info.auth.id !== newResult.host && this.isHost) {
                            this.isHost = false;
                            document.getElementById(this.props.id+'submitconfig').style.display = 'none';
                        }
                    }                  
                });
            }            
        });
       
        //document.getElementById(this.props.id).getElementsByClassName('brainsatplay-default-fullscreen-icon')[0].click();
        this.configure(this.settings);
        //You can give the app initialization settings if you want via an array.

    }

    //Delete all event listeners and loops here and delete the HTML block
    deinit() {
        this.looping = false;
        this.effects.forEach((struct,idx)=>{
            if(struct.id === 'Micin') {
                struct.source.mediaStream.getTracks()[0].stop();
            }
            else if(struct.sourceIdx) window.audio.stopSound(struct.sourceIdx);
            
        });

        this.tutorialManager.deinit()

        document.removeEventListener("keydown", this.saveShader);


        this.stateIds.forEach(id => {
            this.session.state.unsubscribeAll(id);
        })
        this.three.renderer.setAnimationLoop( null );
        this.clearThree()
        this.AppletHTML.deleteNode();
        this.session.removeApp(this.props.id)

        //Be sure to unsubscribe from state if using it and remove any extra event listeners
    }

    createTutorial = (props=this.props) => {
        
        let tooltips = [
            {
                target: `${props.id}effectmenu`,
                content: `
                <h3>Choose your Effects</h3>
                <hr>
                <p>This is where you choose feedback effects, they will be applied
                if a data stream is available. For audio feedback select 'Audio FFT' and a sound, or use your Microphone!</p>
                `
            }, 
            {
                target: `${this.props.id}editorContainer`,
                content: `
                <h3>Real-Time Shader Coding</h3>
                <hr>
                <p>Modify the visualization in real-time—or select from our default shaders.</p>
                `
            },
          ]

          return new TutorialManager(this.info.name, tooltips, this.appletContainer)
    }

    //Responsive UI update, for resizing and responding to new connections detected by the UI manager
    responsive() {

        this.tutorialManager.responsive()

        if(this.three.renderer) {
            this.camera.aspect = this.canvasContainer.offsetWidth/this.canvasContainer.offsetHeight
            this.camera.updateProjectionMatrix()
            // Resize Plane Geometry
            let containerAspect = this.canvasContainer.offsetWidth/this.canvasContainer.offsetHeight
            // let fov_y = this.camera.position.z * this.camera.getFilmHeight() / this.camera.getFocalLength();
            // this.three.meshWidth = this.three.meshHeight = Math.min(((fov_y)* this.camera.aspect) / containerAspect, (fov_y)* this.camera.aspect);
            this.three.meshWidth = this.fov_y * this.camera.aspect
            this.three.meshHeight = this.three.meshWidth/containerAspect

            let newGeometry = this.createViewGeometry();
            this.three.planes.forEach(p => {
                p.geometry.dispose()
                p.geometry = newGeometry
                p.material.uniforms.iResolution.value = new THREE.Vector2(this.three.meshWidth, this.three.meshHeight)
                
                p.rotation.set(0,Math.PI,0);
            });
            
            this.three.renderer.setSize(this.canvasContainer.offsetWidth, this.canvasContainer.offsetHeight);
        }
    }

    //settings structure
    /*
    settings input: [{
        "shader":{
            "name":"Galaxy"
            OR
            "frag": "raw glsl code"
        }}{
        "feedback":"iHEG", //can use the option value OR text i.e. "HEG Ratio"
        "soundurl":{
            "name":"",
            "url":""//Optional if you have a custom url   
        }
        OR
        "soundbuffer"{
            "buffer": [channel1,channel2], //directly copy sound float32array buffer data sent over network via audioBuffer.getChannelData(channel)
            "samplerate": samplerate, //e.g. 48000
            "frameCount": duration // bufferdata.length/samplerate;
        }
    }, {
        //add more feedback and sound settings
    }];
    */
    configure(settings=[]) { //For configuring from the address bar or saved settings. Expects an array of arguments [a,b,c] to do whatever with

        console.log("Configure with settings:",settings);
        
        let textdecoder = new TextDecoder();

        settings.forEach((cmd,i) => {
            if(typeof cmd === 'object') {
                
                if(this.effects.length === i) {
                    document.getElementById(this.props.id+'addeffect').click();
                }
                if(cmd.controls == false && this.hidden == false) {
                    document.getElementById(this.props.id+'showhide').onclick();
                    document.getElementById(this.props.id+'showhide').onmouseleave();
                    document.getElementById(this.props.id+'exitSession').style.display = 'none';   
                }
                if(cmd.fullscreen == true) {
                    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement
                    if (!fullscreenElement) {
                        try{
                            if (this.AppletHTML.node.requestFullscreen) {
                                this.AppletHTML.node.requestFullscreen()
                            } else if (this.AppletHTML.node.webkitRequestFullscreen) {
                                this.AppletHTML.node.webkitRequestFullscreen()
                            }
                        } catch(er) {console.error(er)}
                    } 
                }
                if(cmd.shader) {
                    let shaderselector = document.getElementById(this.props.id+'shaderSelector');
                    if(cmd.shader.name) {
                        Array.from(shaderselector.options).forEach((opt,j) => {
                            if(opt.value === cmd.shader.name) {
                                shaderselector.selectedIndex = j;
                                //console.log(shaderselector.value);
                                let ev = {target:shaderselector}
                                shaderselector.onchange(ev);
                            }
                        });
                    } else if (cmd.shader.frag) {
                        shaderselector.selectedIndex = shaderselector.options.length-1;
                        let ev = {target:shaderselector}
                        shaderselector.onchange(ev);
                        let fragment;
                        if(!cmd.shader.frag.includes('#define')) fragment =  textdecoder.decode(Uint8Array.from(JSON.parse(cmd.shader.frag)));
                        else fragment = cmd.shader.frag;
                        //this.liveEditor.updateSettings({language: 'glsl', target: fragment });
                        this.liveEditor.input.value = fragment;
                        this.liveEditor.input.oninput();
                        this.setShaderFromText(fragment);
                    }
                }
                if(cmd.modifiers) {
                    Object.assign(this.modifiers,cmd.modifiers);
                }
                if(cmd.view) {
                    this.currentView = cmd.view;
                    this.updateCurrentView();
                }
                if(cmd.feedback) {
                    Array.from(this.effects[i].feedback.options).forEach((opt,j) => {
                        if(opt.value === cmd.feedback || opt.text === cmd.feedback) {
                            this.effects[i].feedback.selectedIndex = j;
                            this.effects[i].feedback.onchange();
                        }
                    });
                }
                if(cmd.soundurl) { //{"name":"etc","url":""}
                    let soundselect = document.getElementById(this.props.id+'soundselect'+this.effects[i].uiIdx);
                    let foundidx = 0;
                    let found = Array.from(soundselect.options).find((opt,k) => {
                        if(opt.innerHTML === cmd.soundurl.name || opt.value === cmd.soundurl.url) {
                            foundidx = k; 
                            return true;
                        }
                    });
                    if(!found) {
                        this.soundUrls.push(cmd.soundurl); //{"name":"etc","url":""}
                        soundselect.insertAdjacentHTML('beforeend', `<option value='${cmd.soundurl.url}'>${cmd.soundurl.name}</option>`);
                        foundidx = soundselect.options.length-1;
                    }
                    console.log(foundidx)
                    soundselect.selectedIndex = foundidx;
                    soundselect.onchange();
                }
                else if (cmd.soundbuffer) { //load a sound buffer directly from audiosourcenode.buffer sent through the system. 
                    if(!window.audio) window.audio = new SoundJS();
                    if(!window.audio.ctx) return false;

                    let buf = window.audio.ctx.createBuffer(cmd.soundbuffer.buffers.length,cmd.soundbuffer.duration/cmd.soundbuffer.samplerate,cmd.soundbuffer.samplerate);
                    cmd.soundbuffer.buffers.forEach((b,j) => {
                        if(typeof b === 'string') buf.copyToChannel(Float32Array.from(textdecoder.decode(b)),j+1,0); //parse string
                        else buf.copyToChannel(b,j+1,0); //parse raw Float32Array
                    });

                    this.effects[i].input.style.display='none';
                    document.getElementById(this.props.id+'fileinfo'+this.effects[i].uiIdx).style.display = '';
                    window.audio.finishedLoading([buf]);

                    document.getElementById(this.props.id+'fileinfo'+this.effects[i].uiIdx).style.display = 'none';
                    document.getElementById(this.props.id+'soundselect'+this.effects[i].uiIdx).selectedIndex = 0;
    
                    if(!this.effects[i].controls) {
                        document.getElementById(this.props.id+'effectWrapper'+this.effects[i].uiIdx).querySelector('.sound').insertAdjacentHTML('beforeend',controls(newEffect.uiIdx));
                        this.effects[i].controls = document.getElementById(this.props.id+'controlWrapper'+this.effects[i].uiIdx);
                    } else {this.effects[i].controls.style.display=""}
                    this.effects[i].source = window.audio.sourceList[sourceListIdx]; 
                    this.effects[i].sourceIdx = sourceListIdx;
                    document.getElementById(this.props.id+'status'+this.effects[i].uiIdx).innerHTML = "Loading..." 
    
                    this.loadSoundControls(this.effects[i]);
                    document.getElementById(this.props.id+'status'+this.effects[i].uiIdx).innerHTML = "";
                }
            }
        });
    }

    //--------------------------------------------
    //--Add anything else for internal use below--
    //--------------------------------------------

    //get all settings and additional sound buffers which can be sent as configurations to configure other screens
    //settings structure
    /*
    settings: [{
        "controls":false,
        "shader":{
            "name":"Galaxy"
            OR
            "frag": "raw glsl code"
        }}{
        "feedback":"iHEG", //use the uniform or the option text
        "soundurl":{
            "name":"",
            "url":""//Optional if you have a custom url   
        }
        OR
        "soundbuffer"{
            "buffer": [channel1,channel2], //directly copy sound float32array buffer data sent over network via audioBuffer.getChannelData(channel)
            "samplerate": samplerate, //e.g. 48000
            "frameCount": duration // bufferdata.length/samplerate;
        }
    }, {
        //add more feedback and sound settings
    }];
    */

    createViewGeometry(type=this.currentView){
        if (type === 'sphere'){
            return new THREE.SphereGeometry(Math.min(this.three.meshWidth, this.three.meshHeight), 50, 50).rotateY(-Math.PI*0.5);
        } else if (type === 'plane') {
            return new THREE.PlaneGeometry(this.three.meshWidth, this.three.meshHeight, 1, 1);
        } else if (type === 'circle') {      
            return new THREE.CircleGeometry( Math.min(this.three.meshWidth, this.three.meshHeight), 32 );
        } else if (type === 'halfsphere') {      
            return new THREE.SphereGeometry(Math.min(this.three.meshWidth, this.three.meshHeight), 50, 50, -2*Math.PI, Math.PI, 0, Math.PI).translate(0,0,-3);
        } else if (type === 'vrscreen') {
            return new THREE.SphereGeometry(Math.min(this.three.meshWidth, this.three.meshHeight), 50, 50, -2*Math.PI-1, Math.PI+1, 0.5, Math.PI-1).rotateY(0.5).translate(0,0,-3);
        }
    }

    swapCurrentView(){
        if(this.currentView === 'plane') {
            this.currentView = 'vrscreen';
            this.updateCurrentView();
        } else if (this.currentView === 'vrscreen') {
            this.currentView = 'sphere';
            this.updateCurrentView();
        } else if (this.currentView === 'sphere') {
            this.currentView = 'halfsphere';
            this.updateCurrentView();
        } else if (this.currentView === 'halfsphere') {
            this.currentView = 'circle';
            this.updateCurrentView();
        } else if (this.currentView === 'circle') {
            this.currentView = 'plane';
            this.updateCurrentView();
        }
    }

    updateCurrentView(type=this.currentView){
        this.three.planes.forEach(mesh => {
            mesh.geometry.dispose()
            if (type === 'sphere'){
                mesh.geometry = this.createViewGeometry('sphere')
                mesh.rotation.set(0,Math.PI,0)
            } else if (type === 'plane') {
                mesh.geometry = this.createViewGeometry('plane')
                mesh.rotation.set(0,Math.PI,0)   
            } else if (type === 'circle') {
                mesh.geometry = this.createViewGeometry('circle');
                mesh.rotation.set(0,Math.PI,0)   
            } else if (type === 'halfsphere') {
                mesh.geometry = this.createViewGeometry('halfsphere');
                mesh.rotation.set(0,Math.PI,0)   
            } else if (type === 'vrscreen') {
                mesh.geometry = this.createViewGeometry('vrscreen');
                mesh.rotation.set(0,Math.PI,0)
            }
        })
    }


    getCurrentConfiguration = (includeSounds=false, includeModifiers=true, encodeSoundsAsText=false) => {
        let settings = [];
        let textencoder = new TextEncoder();
        this.effects.forEach((eff,j) => {
            settings.push({
                feedback:eff.feedback.value
            });
            if(includeSounds){ //optional for speed. should only run once otherwise
                //console.log(eff);
                if(eff.sourceIdx !== false) {
                    if(includeSounds !== 'urls' && document.getElementById(this.props.id+'soundselect'+eff.uiIdx).value === 'none') {
                        settings[j].soundbuffer = {};
                        settings[j].soundbuffer.buffers = new Array(eff.source.buffer.numberOfChannels).fill(new Float32Array(Math.floor(eff.source.buffer.duration*eff.source.buffer.sampleRate)));
                        settings[j].soundbuffer.buffers.forEach((channel,k) => {
                            console.log(eff.source.buffer)
                            eff.source.buffer.copyFromChannel(channel,k,0);
                            if(encodeSoundsAsText) settings[j].soundbuffer.buffers[k] = "["+textencoder.encode(channel.toString())+"]";
                        });
                        settings[j].soundbuffer.samplerate = eff.source.buffer.sampleRate;
                        settings[j].soundbuffer.duration = eff.source.buffer.duration;
                    } else {
                        settings[j].soundurl = {
                            name:Array.from(document.getElementById(this.props.id+'soundselect'+eff.uiIdx).options)[document.getElementById(this.props.id+'soundselect'+eff.uiIdx).selectedIndex].innerHTML,
                            url:document.getElementById(this.props.id+'soundselect'+eff.uiIdx).value
                        };
                    }
                }
            }
        });
        
        let shaderselector = document.getElementById(this.props.id+'shaderSelector');
        settings[0].controls = document.getElementById(this.props.id+'controls').checked;
        settings[0].shader = {};
        
        settings[0].view = this.currentView;
        if(shaderselector.value !== 'fromtext' && !this.shaderEdited)
            settings[0].shader.name = shaderselector.value;
        else settings[0].shader.frag = this.liveEditor.input.value;

        if(includeModifiers) settings[0].modifiers = this.modifiers;
        

        // Auto-Join Configuration Settings
        settings[0].title = false
        settings[0].mode = this.mode;
        if(this.mode === 'multi') {
            settings[0].domain = this.session.info.auth.url.href;
            settings[0].login = false;
            settings[0].session = this.roomId;
            settings[0].spectating = false;
        }
        console.log("Current settings: ",settings);

        settings[0].fullscreen = true;

        return settings;
    }

    generateShareableAddress = () => {
        let config = this.getCurrentConfiguration('urls',document.getElementById(this.props.id+'modifiers').checked);
        
        if(config[0].shader.frag) {
            let textencoder = new TextEncoder();
            config[0].shader.frag = "[" +textencoder.encode(config[0].shader.frag).toString() + "]";
            //console.log(config[0].shader.frag)
        }

        let address;
        let adr = window.location.href.split('/');
        if(adr.length === 2) address = adr[0];
        else if (adr.length >= 3) address = adr.slice(0,3).join('/');

        if(address.indexOf("#Sensorium") > -1) address = address.slice(0,address.indexOf("#Sensorium"));
        address+=`#{"name":"Sensorium","settings":${JSON.stringify(config)}}`;
        
        return address;
    }

    addSoundInput = () => {
        let fileinput = (idx=0, props=this.props) => {
            return `
            <div style="display: flex;">

                <div style="padding-right: 25px;">
                    <span style='text-shadow: 0px 0px 2px black, 0 0 10px black;'>Effect</span>
                    <div id='${props.id}selectors${idx}'></div>
                </div>
                <div class="sound">
                    <span style='text-shadow: 0px 0px 2px black, 0 0 10px black;'>Sound</span>
                    <div id='${props.id}fileWrapper${idx}' style="">  
                        <select id='${props.id}soundselect${idx}'><option value='none' disabled>Choose an Audio Source</option></select> 
                        <span id='${props.id}customspan${idx}' style='display:none;'><input type='text' id='${props.id}customname${idx}' placeholder='File Name'></input><input type='text' id='${props.id}customurl${idx}' placeholder='File URL'></input><button id='${props.id}customsubmit${idx}'>Load</button></span>
                        <span id='${props.id}status${idx}'></span>
                    </div>
                    <span id='${props.id}fileinfo${idx}' style='text-shadow: 0px 0px 2px black, 0 0 10px black; display:none;'>Loading...</span>
                </div>
                </div>
            `;
        }

        let controls = (idx=0, props=this.props) => {
            return `
                <span id='${props.id}controlWrapper${idx}'>
                    <button id='${props.id}play${idx}'>Play</button>
                    <button id='${props.id}pause${idx}' style='display:none;'>Pause</button>
                    <button id='${props.id}mute${idx}' style='display:none;'>Mute</button>
                    <button id='${props.id}stop${idx}'>Remove</button>
                </span>
            `;
        }
        
        let fdback = (idx=0, props=this.props) => {
            return `
            <select id='${props.id}select${idx}'>
                <option value='none'>None</option>
                <option value='iAudio'>Audio FFT</option>
                <option value='iHB'>Heart Beat</option>
                <option value='iHR'>Heart Rate</option>
                <option value='iHEG'>HEG Ratio</option>
                <option value='iHRV'>Heart Rate Variability</option>
                <option value='iBRV'>Breathing Rate Variability</option>
                <option value='iFFT'>EEG Bandpower FFT</option>
                <option value='iDelta'>Delta Bandpower</option>
                <option value='iTheta'>Theta Bandpower</option>
                <option value='iAlpha1'>Alpha1 Bandpower</option>
                <option value='iAlpha2'>Alpha2 Bandpower</option>
                <option value='iBeta'>Beta Bandpower</option>
                <option value='iGamma'>Low Gamma Bandpower</option>
                <option value='i40Hz'>40Hz Bandpower</option>
                <option value='iThetaBeta'>Theta/Beta Ratio</option>
                <option value='iAlpha1Alpha2'>Alpha 2/1 Ratio</option>
                <option value='iAlphaBeta'>Alpha/Beta Ratio</option>
                <option value='iAlphaTheta'>Alpha/Theta Ratio</option>
                <option value='iFrontalAlpha1Coherence'>Frontal Alpha Coherence</option>
            </select>
            <select id='${props.id}channel${idx}' style='display:none;'></select>
            `;
        }

        let idx = this.ct; this.ct++;

        let newEffect = JSON.parse(JSON.stringify(this.effectStruct));
        this.effects.push(newEffect);
        newEffect.uiIdx = idx;
        
        document.getElementById(this.props.id+'effectmenu').insertAdjacentHTML('beforeend',`<div id='${this.props.id}effectWrapper${idx}'>`+fileinput(idx)+`</div>`);
        newEffect.input = document.getElementById(this.props.id+'fileWrapper'+idx);

        document.getElementById(this.props.id+'selectors'+newEffect.uiIdx).insertAdjacentHTML('beforeend',fdback(idx));
        newEffect.feedback = document.getElementById(this.props.id+'select'+newEffect.uiIdx)
        //console.log(newEffect.feedback.value)

        document.getElementById(this.props.id+'select'+newEffect.uiIdx).onchange = () => {
            let value = document.getElementById(this.props.id+'select'+newEffect.uiIdx).value;
            newEffect.feedbackOption = value;

            if(value.includes('eeg')){
                document.getElementById(this.props.id+'channel'+newEffect.uiIdx).style.display = "";
                if(value.includes('coh')) {
                    addCoherenceOptions(this.props.id+'channel'+newEffect.uiIdx,this.session.atlas.data.coherence);
                } else {
                    addChannelOptions(this.props.id+'channel'+newEffect.uiIdx,this.session.atlas.data.eegshared.eegChannelTags);
                }
            } else if (value.includes('heg')) {
                document.getElementById(this.props.id+'channel'+newEffect.uiIdx).style.display = "none";
            } 
            
            let fileWrapper = document.getElementById(`${this.props.id}fileWrapper${newEffect.uiIdx}`)
            //console.log(value)
            
        }

        document.getElementById(this.props.id+'soundselect'+newEffect.uiIdx).insertAdjacentHTML('beforeend', `<option value='none'>None</option>`);
        document.getElementById(this.props.id+'soundselect'+newEffect.uiIdx).insertAdjacentHTML('beforeend', `<option value='micin'>Mic In</option>`);

        document.getElementById(this.props.id+'customsubmit'+newEffect.uiIdx).onclick = () => {
            let name = document.getElementById(this.props.id+'customname'+newEffect.uiIdx).value;
            let url = document.getElementById(this.props.id+'customurl'+newEffect.uiIdx).value;
            if(name.length>0 && url.length>0) {
                var option = document.createElement("option");
                option.innerHTML = name;
                option.value = url;
                document.getElementById(this.props.id+'soundselect'+newEffect.uiIdx).add(option);
                document.getElementById(this.props.id+'soundselect'+newEffect.uiIdx).selectedIndex = document.getElementById(this.props.id+'soundselect'+newEffect.uiIdx).options.length-1;
                document.getElementById(this.props.id+'soundselect'+newEffect.uiIdx).onchange();
            }
        }

        this.soundUrls.forEach((obj)=>{
            var option = document.createElement("option");
            option.innerHTML = obj.name;
            option.value = obj.url;
            document.getElementById(this.props.id+'soundselect'+newEffect.uiIdx).add(option);
        });

        
        document.getElementById(this.props.id+'soundselect'+newEffect.uiIdx).insertAdjacentHTML('beforeend', `<option value='custom'>Add Audio URL</option>`);
        document.getElementById(this.props.id+'soundselect'+newEffect.uiIdx).insertAdjacentHTML('beforeend', `<option value='addfile'>Add Local File</option>`)


        document.getElementById(this.props.id+'soundselect'+newEffect.uiIdx).onchange = () => {
            let soundurl = document.getElementById(this.props.id+'soundselect'+newEffect.uiIdx).value;
                        
            let idx = undefined;
            let found = this.effects.find((o,i) => {
                if(o.id === 'Micin') {
                    idx=i;
                    return true;
                }
            });

            if (soundurl === 'custom') {
                document.getElementById(this.props.id+'customspan'+newEffect.uiIdx).style.display = '';
            } else {
                document.getElementById(this.props.id+'customspan'+newEffect.uiIdx).style.display = 'none';   
            }

            if (soundurl === 'micin'){
                if(!found){
                    //start mic
                    if(!window.audio) {
                        window.audio = new SoundJS();
                        if (window.audio.ctx===null) {return;};
                    }

                    if(this.effects[this.effects.length-1].sourceIdx !== false) this.effects.push(JSON.parse(JSON.stringify(this.effectStruct)));
                    let fx = this.effects[this.effects.length-1];

                    fx.sourceIdx = window.audio.record(undefined,undefined,null,null,false,()=>{
                        if(fx.sourceIdx !== undefined) {
                            fx.source = window.audio.sourceList[window.audio.sourceList.length-1];
                            //window.audio.sourceGains[fx.sourceIdx].gain.value = 0;
                            fx.playing = true;
                            fx.id = 'Micin';
                            //fx.source.mediaStream.getTracks()[0].enabled = false;
                            this.hostSoundsUpdated = false;
                        }
                    });
                   
                }
            }
            else if (found != null){
                found.source.mediaStream.getTracks()[0].stop();
            } 

            if (!['micin', 'none', 'custom'].includes(soundurl)) {
                console.log(soundurl)
                if (soundurl === 'addfile') {
                    if(!window.audio) window.audio = new SoundJS();
                    if (window.audio.ctx===null) {return;};
                    //document.getElementById(this.props.id+'status'+newEffect.uiIdx).innerHTML = "Loading..." 
                    window.audio.decodeLocalAudioFile((sourceListIdx)=>{ 
                        
                        document.getElementById(this.props.id+'fileinfo'+newEffect.uiIdx).style.display = 'none';
                        document.getElementById(this.props.id+'soundselect'+newEffect.uiIdx).selectedIndex = 0;
        
                        if(!newEffect.controls) {
                            document.getElementById(this.props.id+'effectWrapper'+newEffect.uiIdx).querySelector('.sound').insertAdjacentHTML('beforeend',controls(newEffect.uiIdx));
                            newEffect.controls = document.getElementById(this.props.id+'controlWrapper'+newEffect.uiIdx);
                        } else {newEffect.controls.style.display=""}
                        newEffect.source = window.audio.sourceList[sourceListIdx]; 
                        newEffect.sourceIdx = sourceListIdx;
                        
        
                        this.loadSoundControls(newEffect);
                        document.getElementById(this.props.id+'status'+newEffect.uiIdx).innerHTML = "";
                        this.hostSoundsUpdated = false;
                    }, 
                    ()=> { 
                        console.log("Decoding...");
                        newEffect.input.style.display='none';
                        document.getElementById(this.props.id+'fileinfo'+newEffect.uiIdx).style.display = '';
                    });
                } else {
                    
                    if(!window.audio) window.audio = new SoundJS();
                    if (window.audio.ctx===null) {return;};
                    
                    window.audio.addSounds(soundurl,(sourceListIdx)=>{ 
                    
                        document.getElementById(this.props.id+'fileinfo'+newEffect.uiIdx).style.display = 'none';
                        document.getElementById(this.props.id+'soundselect'+newEffect.uiIdx).selectedIndex = 0;

                        if(!newEffect.controls) {
                            document.getElementById(this.props.id+'effectWrapper'+newEffect.uiIdx).querySelector('.sound').insertAdjacentHTML('beforeend',controls(newEffect.uiIdx));
                            newEffect.controls = document.getElementById(this.props.id+'controlWrapper'+newEffect.uiIdx);
                        } else {newEffect.controls.style.display=""}
                        newEffect.source = window.audio.sourceList[sourceListIdx]; 
                        newEffect.sourceIdx = sourceListIdx;
                        
                        document.getElementById(this.props.id+'status'+newEffect.uiIdx).innerHTML = "Loading..." 
                        this.loadSoundControls(newEffect);
                        document.getElementById(this.props.id+'status'+newEffect.uiIdx).innerHTML = "";
                        this.hostSoundsUpdated = false;
                    }, 
                    ()=> { 
                        console.log("Decoding...");
                        newEffect.input.style.display='none';
                        document.getElementById(this.props.id+'fileinfo'+newEffect.uiIdx).style.display = '';
                    }, false);
                }
            }

        }

        if(this.currentShader !== null)
            this.setEffectOptions();


    //     document.getElementById(this.props.id+'uploadedFile'+idx).onclick = () => {
    //         if(!window.audio) window.audio = new SoundJS();
    //         if (window.audio.ctx===null) {return;};

    //         window.audio.decodeLocalAudioFile((sourceListIdx)=>{ 
                
    //             document.getElementById(this.props.id+'fileinfo'+idx).style.display = 'none';
    //             document.getElementById(this.props.id+'soundselect'+newEffect.uiIdx).selectedIndex = 0;

    //             if(!newEffect.controls) {
    //                 document.getElementById(this.props.id+'effectWrapper'+idx).insertAdjacentHTML('beforeend',controls(idx));
    //                 newEffect.controls = document.getElementById(this.props.id+'controlWrapper'+idx);
    //             } else {newEffect.controls.style.display=""}
    //             newEffect.source = window.audio.sourceList[sourceListIdx]; 
    //             newEffect.sourceIdx = sourceListIdx;
    //             document.getElementById(this.props.id+'status'+idx).innerHTML = "Loading..." 

    //             this.loadSoundControls(newEffect);
    //             document.getElementById(this.props.id+'status'+idx).innerHTML = "";
    //         }, 
    //         ()=> { 
    //             console.log("Decoding...");
    //             newEffect.input.style.display='none';
    //             document.getElementById(this.props.id+'fileinfo'+idx).style.display = '';
    //         });
            
    //     }
        
        
    }

    setEffectOptions() {
        this.effects.forEach((eff)=>{
            if(!eff.id) {
                let sel = document.getElementById(this.props.id+'select'+eff.uiIdx);
                for(let i = 0; i < sel.options.length; i++){
                    if(this.currentShader.uniforms.indexOf(sel.options[i].value)>-1){
                        sel.options[i].style.display='';
                    } else if (sel.options[i].value !== 'none') {
                        sel.options[i].style.display='none';
                    }   
                    if(sel.options[i].selected === true && sel.options[i].style.display==='none') {
                        sel.options[0].selected = true;
                    }
                }
            }
        });
    }

    //doSomething(){}
    loadSoundControls = (newEffect) => {
        
        document.getElementById(this.props.id+'play'+newEffect.uiIdx).onclick = () => {
            try{window.audio.playSound(newEffect.sourceIdx,0,true);}catch(er){}
            //.log(newEffect.sourceIdx);
            newEffect.playing = true;
            document.getElementById(this.props.id+'play'+newEffect.uiIdx).style.display = 'none';
            document.getElementById(this.props.id+'pause'+newEffect.uiIdx).style.display = '';
            document.getElementById(this.props.id+'mute'+newEffect.uiIdx).style.display = '';
        }

        document.getElementById(this.props.id+'pause'+newEffect.uiIdx).onclick = () => {
            if(newEffect.playing) {
                if(!newEffect.paused) {
                    newEffect.paused = true;
                    newEffect.playbackRate = newEffect.source.playbackRate.value;
                    newEffect.source.playbackRate.value = 0;
                    document.getElementById(this.props.id+'pause'+newEffect.uiIdx).innerHTML = "Play";
                } else {
                    newEffect.paused = false;
                    newEffect.source.playbackRate.value = newEffect.playbackRate;
                    document.getElementById(this.props.id+'pause'+newEffect.uiIdx).innerHTML = "Pause";
                }
            }
        }

        document.getElementById(this.props.id+'stop'+newEffect.uiIdx).onclick = () => {
            if(newEffect.playing === false) newEffect.source.start(window.audio.ctx.currentTime);
            newEffect.source.stop();
            
            newEffect.playing = false;
            newEffect.paused = false;
          
           
            newEffect.input.style.display = "";
            newEffect.controls.style.display = "none";

            document.getElementById(this.props.id+'play'+newEffect.uiIdx).style.display = '';
            document.getElementById(this.props.id+'pause'+newEffect.uiIdx).style.display = 'none';
            document.getElementById(this.props.id+'pause'+newEffect.uiIdx).innerHTML = "Pause";

            let thisidx=0;
            this.effects.forEach((effectStruct,j)=> {
                if(!effectStruct.id) {
                    if(effectStruct.sourceIdx === newEffect.sourceIdx) thisidx = j; 
                    else if(effectStruct.sourceIdx > newEffect.sourceIdx) {
                        effectStruct.sourceIdx--;
                        this.loadSoundControls(effectStruct);
                    }
                }
            });


        }

        document.getElementById(this.props.id+'mute'+newEffect.uiIdx).onclick = () => {
            if(window.audio.sourceGains[newEffect.sourceIdx].gain.value !== 0){
                newEffect.lastGain = window.audio.sourceGains[newEffect.sourceIdx].gain.value;
                window.audio.sourceGains[newEffect.sourceIdx].gain.setValueAtTime(0, window.audio.ctx.currentTime);
                newEffect.muted = true;
                
            } else {  newEffect.muted = false; window.audio.sourceGains[newEffect.sourceIdx].gain.setValueAtTime(newEffect.lastGain, window.audio.ctx.currentTime); }
        }
    };

    animate = () => {
        if(this.looping){
            this.effects.forEach((effectStruct) => {
                let option = effectStruct.feedbackOption;
                if(this.session.atlas.data.heg.length>0 && this.session.atlas.settings.deviceConnected === true) {
                    if(option === 'iHB') { //Heart Beat causing tone to fall off
                        if(this.session.atlas.data.heg[0].beat_detect.beats.length > 0) {
                            this.modifiers.iHB = 1/(0.001*(Date.now()-this.session.atlas.data.heg[0].beat_detect.beats[this.session.atlas.data.heg[0].beat_detect.beats.length-1].t)) 
                            
                            if(!effectStruct.muted && window.audio && effectStruct.playing){
                                effectStruct.source
                                window.audio.sourceGains[effectStruct.sourceIdx].gain.setValueAtTime( //make the sound fall off on a curve based on when a beat occurs
                                    Math.max(0,Math.min(modifiers.iHB,1)), 
                                    window.audio.ctx.currentTime
                                );
                            } 
                            this.modifiers.iHB = 1/(Date.now()-this.session.atlas.data.heg[0].beat_detect.beats[this.session.atlas.data.heg[0].beat_detect.beats.length-1].t) //heart beat gives a decreasing value starting at 1 which signifies when a heart beat occurred
                        }
                    } else if (option === 'iHR') { //Heart rate modifies play speed
                        if(this.session.atlas.data.heg[0].beat_detect.beats.length > 0) {
                            let hr_mod = 60/this.session.atlas.data.heg[0].beat_detect.beats[this.session.atlas.data.heg[0].beat_detect.beats.length-1].bpm;
                            if(!effectStruct.muted && window.audio && effectStruct.playing){
                                effectStruct.source.playbackRate.value = hr_mod;
                            }
                            this.modifiers.iHR = this.session.atlas.data.heg[0].beat_detect.beats[this.session.atlas.data.heg[0].beat_detect.beats.length-1].bpm;
                        }       
                    }
                    else if (option === 'iHEG') { //Raise HEG ratio compared to baseline
                        if(this.session.atlas.data.heg[0].ratio.length > 0) {
                            if(!effectStruct.hegbaseline) effectStruct.hegbaseline = this.session.atlas.data.heg[0].ratio[this.session.atlas.data.heg[0].ratio.length-1];
                            let hegscore = this.session.atlas.data.heg[0].ratio[this.session.atlas.data.heg[0].ratio.length-1]-effectStruct.hegbaseline;
                            if(!effectStruct.muted && window.audio && effectStruct.playing){
                                window.audio.sourceGains[effectStruct.sourceIdx].gain.setValueAtTime(
                                    Math.min(Math.max(0,hegscore),1), //
                                    window.audio.ctx.currentTime
                                );
                            }
                            this.modifiers.iHEG = hegscore; //starts at 0
                        }
                    } else if (option === 'iHRV') { //Maximize HRV, set the divider to set difficulty
                        if(this.session.atlas.data.heg[0].beat_detect.beats.length > 0) {
                            if(!effectStruct.muted && window.audio && effectStruct.playing){
                                window.audio.sourceGains[effectStruct.sourceIdx].gain.setValueAtTime(
                                    Math.max(0,Math.min(this.session.atlas.data.heg[0].beat_detect.beats[this.session.atlas.data.heg[0].beat_detect.beats.length-1].hrv/30,1)), //
                                    window.audio.ctx.currentTime
                                );
                            }
                            this.modifiers.iHRV = this.getData("iHRV");
                        }
                    } else if (option === 'iBRV') { //Minimize BRV, set the divider to set difficulty
                        if(this.session.atlas.data.heg[0].beat_detect.breaths.length > 0) {
                            if(!effectStruct.muted && window.audio && effectStruct.playing){
                                window.audio.sourceGains[effectStruct.sourceIdx].gain.setValueAtTime(
                                    Math.max(0,Math.min(1/this.session.atlas.data.heg[0].beat_detect.breaths[this.session.atlas.data.heg[0].beat_detect.breaths.length-1].brv,1)), //
                                    window.audio.ctx.currentTime
                                );
                            }
                            this.modifiers.iBRV = this.session.atlas.data.heg[0].beat_detect.breaths[this.session.atlas.data.heg[0].beat_detect.breaths.length-1].brv;
                        }
                    }
                }
                if(this.session.atlas.settings.eeg === true && this.session.atlas.settings.analyzing === true) { 
                    let channel = document.getElementById(this.props.id+'channel'+effectStruct.uiIdx).value;
                    if (option === 'iDelta') {
                        this.modifiers.iDelta = this.session.atlas.getLatestFFTData(channel)[0].mean.delta;
                        if(!effectStruct.muted && window.audio && effectStruct.playing){
                            window.audio.sourceGains[effectStruct.sourceIdx].gain.setValueAtTime(Math.max(0,Math.min(modifiers.iDelta/50,1)), window.audio.ctx.currentTime); //bandpowers should be normalized to microvolt values, so set these accordingly
                        }
                    } else if (option === 'iTheta') {
                        this.modifiers.iTheta = this.session.atlas.getLatestFFTData(channel)[0].mean.theta;
                        if(!effectStruct.muted && window.audio && effectStruct.playing){
                            window.audio.sourceGains[effectStruct.sourceIdx].gain.setValueAtTime(Math.max(0,Math.min(modifiers.iTheta/30,1)), window.audio.ctx.currentTime);
                        }
                    } else if (option === 'iAlpha1') {
                        this.modifiers.iAlpha1 = this.session.atlas.getLatestFFTData(channel)[0].mean.alpha1;
                        if(!effectStruct.muted && window.audio && effectStruct.playing){
                            window.audio.sourceGains[effectStruct.sourceIdx].gain.setValueAtTime(Math.max(0,Math.min(modifiers.iAlpha1/20,1)), window.audio.ctx.currentTime);
                        }
                    } else if (option === 'iAlpha2') {
                        this.modifiers.iAlpha2 = this.session.atlas.getLatestFFTData(channel)[0].mean.alpha2;
                        if(!effectStruct.muted && window.audio && effectStruct.playing){
                            window.audio.sourceGains[effectStruct.sourceIdx].gain.setValueAtTime(Math.max(0,Math.min(modifiers.iAlpha2/20,1)), window.audio.ctx.currentTime);
                        }
                    } else if (option === 'iBeta') {
                        this.modifiers.iBeta = this.session.atlas.getLatestFFTData(channel)[0].mean.beta;
                        if(!effectStruct.muted && window.audio  && effectStruct.playing){
                            window.audio.sourceGains[effectStruct.sourceIdx].gain.setValueAtTime(Math.max(0,Math.min(modifiers.iBeta/10,1)), window.audio.ctx.currentTime);
                        }
                    } else if (option === 'iGamma') {
                        this.modifiers.iGamma = this.session.atlas.getLatestFFTData(channel)[0].mean.lowgamma;
                        if(!effectStruct.muted && window.audio  && effectStruct.playing){
                            window.audio.sourceGains[effectStruct.sourceIdx].gain.setValueAtTime(Math.max(0,Math.min(modifiers.iGamma/5,1)), window.audio.ctx.currentTime);
                        }
                    } else if (option === 'i40Hz') {
                        this.modifiers.i40Hz = this.session.atlas.get40HzGamma(this.session.atlas.getEEGDataByChannel(channel))
                        if(!effectStruct.muted && window.audio  && effectStruct.playing){
                            window.audio.sourceGains[effectStruct.sourceIdx].gain.setValueAtTime(Math.max(0,Math.min(modifiers.i40Hz*.2,1)), window.audio.ctx.currentTime);
                        }
                    } else if (option === 'iThetaBeta') {
                        this.modifiers.iThetaBeta = this.session.atlas.getThetaBetaRatio(this.session.atlas.getEEGDataByChannel(channel))
                        if(!effectStruct.muted && window.audio  && effectStruct.playing){
                            window.audio.sourceGains[effectStruct.sourceIdx].gain.setValueAtTime(Math.max(0,Math.min(modifiers.iThetaBeta*.5,1)), window.audio.ctx.currentTime);
                        }
                    } else if (option === 'iAlpha1Alpha2') {
                        this.modifiers.iAlpha1Alpha2 = this.session.atlas.getAlphaRatio(this.session.atlas.getEEGDataByChannel(channel))
                        if(!effectStruct.muted && window.audio  && effectStruct.playing){
                            window.audio.sourceGains[effectStruct.sourceIdx].gain.setValueAtTime(Math.max(0,Math.min(modifiers.iAlpha1Alpha2*.5,1)), window.audio.ctx.currentTime);
                        }
                    } else if (option === 'iAlphaBeta') {
                        this.modifiers.iAlphaBeta = this.session.atlas.getAlphaBetaRatio(this.session.atlas.getEEGDataByChannel(channel))
                        if(!effectStruct.muted && window.audio  && effectStruct.playing){
                            window.audio.sourceGains[effectStruct.sourceIdx].gain.setValueAtTime(Math.max(0,Math.min(modifiers.iAlphaBeta*.5,1)), window.audio.ctx.currentTime);
                        }
                    } else if (option === 'iAlphaTheta') {
                        this.modifiers.iAlphaTheta = this.session.atlas.getAlphaThetaRatio(this.session.atlas.getEEGDataByChannel(channel))
                        if(!effectStruct.muted && window.audio  && effectStruct.playing){
                            window.audio.sourceGains[effectStruct.sourceIdx].gain.setValueAtTime(Math.max(0,Math.min(modifiers.iAlphaTheta*.5,1)), window.audio.ctx.currentTime);
                        }      
                    } else if (this.session.atlas.settings.analysis.eegcoherence === true && option === 'iFrontalAlpha1Coherence') {
                        this.modifiers.iFrontalAlpha1Coherence = this.session.atlas.getCoherenceScore(this.session.atlas.getFrontalCoherenceData(),'alpha1') // this.session.atlas.getLatestCoherenceData(0)[0].mean.alpha1;
                        if(!effectStruct.muted && window.audio  && effectStruct.playing){
                            window.audio.sourceGains[effectStruct.sourceIdx].gain.setValueAtTime(
                                Math.min(Math.max(0,this.modifiers.iFrontalAlpha1Coherence),1), 
                                window.audio.ctx.currentTime
                            );
                        }
                    } else if (option === 'iFFT') {
                        this.modifiers.iFFT = this.getData("iFFT");
                    } 
                }
                if(option === 'iAudio') {
                    if(!effectStruct.muted && window.audio && effectStruct.playing){
                        var array = new Uint8Array(window.audio.analyserNode.frequencyBinCount);
                        window.audio.analyserNode.getByteFrequencyData(array);
                        this.modifiers.iAudio = Array.from(array.slice(0,256));
                    } else {
                        this.modifiers.iAudio = new Array(256).fill(0);
                    }
                }
            });

            setTimeout(()=>{requestAnimationFrame(this.animate);},16);
        }
    }

    swapShader = () => {

        let newMaterial = new THREE.ShaderMaterial({
            vertexShader: this.currentShader.vertexShader,
            fragmentShader: this.currentShader.fragmentShader,
            side: THREE.DoubleSide,
            transparent: true,
        });

        
        let bciuniforms = {};
        this.currentShader.uniforms.forEach((u)=>{
            let pass = false;
            for(const prop in this.modifiers) {
                if(u === prop) {
                    bciuniforms[u]={value:this.modifiers[u]};
                    pass = true;
                    break;
                }
            }
            if(!pass) {
                let found = Object.keys(this.additionalUniforms).find((j) => {
                    if(u === j) {
                        return true;
                    }
                });
                if(found) {
                    if(u === 'iImage') {
                        this.three.renderer.domElement.ctx.clearRect(0,0,this.AppletHTML.node.clientWidth,this.AppletHTML.node.clientHeight);
                        bciuniforms[u]={type:'t', value: new THREE.Texture(this.three.renderer.domElement.toDataURL())}
                    } else if (u === 'iChannelResolution') {
                        bciuniforms[u] = {type:'v3v', value:this.additionalUniforms[u]};
                    } else if (u.includes('iChannel')) {
                        if(!this.additionalUniforms[u]) {
                            this.additionalUniforms[u] = new THREE.Texture(uvgrid);
                        }
                        bciuniforms[u] = {type:'t', value:this.additionalUniforms[u]};
                        if(!uniforms['iChannelResolution']) {
                            uniforms['iChannelResolution'] = {type:'v3v', value:this.additionalUniforms['iChannelResolution']};
                        }
                        let ch = parseInt(u[8]);
                        bciuniforms['iChannelResolution'].value[ch] = new THREE.Vector3(
                            bciuniforms[u].value.image.width,
                            bciuniforms[u].value.image.height
                        )
                    }
                    else bciuniforms[u]={value:this.additionalUniforms[u]};
                } //add arbitrary uniforms not listed anywhere
            }
        });
        newMaterial.uniforms = bciuniforms;
        
        this.updateMaterialUniforms(newMaterial,this.modifiers);
        this.generateGUI(this.currentShader.uniforms);

        this.three.planes.forEach(p => {
            p.material.dispose();
            p.material = newMaterial;          
        })

        // Update Shader Live Coding Console
        this.liveEditor.updateSettings({language: 'glsl', target: this.currentShader, key: 'fragmentShader'})
    }

    setShaderFromText = (text) => {

        let fragShader = text;

        // Dynamically Extract Uniforms
        let regex = new RegExp('uniform (.*) (.*);', 'g')
        let result = [...fragShader.matchAll(regex)]
        let alluniforms = []
        result.forEach(a => {
            alluniforms.push(a[2].replace(/(\[.+\])/g, ''))
        })
        let bciuniforms = [];
        let uniforms = {};
        alluniforms.forEach((u) => {
            let pass = false;
            for(const prop in this.modifiers) {
                if(u === prop) {
                    bciuniforms.push(u);
                    uniforms[u]={value:this.modifiers[u]};
                    pass = true;
                    break;
                }
            }
            if(bciuniforms.indexOf(u) < 0) {
                let found = Object.keys(this.additionalUniforms).find((k) => {
                    if(u === k) {
                        return true;
                    }
                });
                if(found) {
                    bciuniforms.push(u);
                    if(u === 'iImage') {
                        this.three.renderer.domElement.ctx.clearRect(0,0,this.AppletHTML.node.clientWidth,this.AppletHTML.node.clientHeight);
                        uniforms[u]={type:'t', value: new THREE.Texture(this.three.renderer.domElement.toDataURL())}
                    } else if (u === 'iChannelResolution') {
                        uniforms[u] = {type:'v3v', value:this.additionalUniforms[u]};
                    } else if (u.includes('iChannel')) {
                        if(!this.additionalUniforms[u]) {
                            this.additionalUniforms[u] = new THREE.Texture(uvgrid);
                        }
                        uniforms[u] = {type:'t', value:this.additionalUniforms[u]};
                        if(!uniforms['iChannelResolution']) {
                            uniforms['iChannelResolution'] = {type:'v3v', value:this.additionalUniforms['iChannelResolution']};
                        }
                        let ch = parseInt(u[8]);
                        uniforms['iChannelResolution'].value[ch] = new THREE.Vector3(
                            uniforms[u].value.image.width,
                            uniforms[u].value.image.height
                        )
                    }
                    else uniforms[u]={value:this.additionalUniforms[u]};
                } //add arbitrary uniforms not listed anywhere
            }
        });
        this.currentShader.uniforms = bciuniforms;
        // Create New Shader
        
        let newMaterial = new THREE.ShaderMaterial({
            vertexShader: this.currentShader.vertexShader,
            fragmentShader: fragShader,
            side: THREE.DoubleSide,
            transparent: true
        });
        try{
            newMaterial.uniforms = uniforms;
            
            this.updateMaterialUniforms(newMaterial,this.modifiers);
            this.generateGUI(this.currentShader.uniforms);

            this.three.planes.forEach(p => {
                p.material.dispose();
                p.material = newMaterial;          
            });

            this.setEffectOptions();
        } catch(er) {}
    }

    getData(u) {        
        if (u === 'iFFT'){
            let channel = this.session.atlas.getLatestFFTData()[0]
            if (channel.fft){
                let fft = eegmath.interpolateArray(channel.fft,256);
                if(fft) return  fft;
                else return new Array(256).fill(0);
            } else return new Array(256).fill(0);
        }
        else if (u === 'iHRV'){
            if (this.session.atlas.data.heg.length > 0) return  this.session.atlas.data.heg[0].beat_detect.beats[this.session.atlas.data.heg[0].beat_detect.beats.length-1].hrv; 
            else return 0;
        }
        // Defaults
        else if (u === 'iTime'){
            return  this.additionalUniforms.iTime; // Seconds
        }
        else if (u === 'iTimeDelta') {
            return this.additionalUniforms.iTimeDelta;
        }
        else if (u === 'iResolution'){
            if(this.currentView === 'halfsphere' || this.currentView === 'circle') {
                this.additionalUniforms.iResolution = new THREE.Vector2(this.three.meshHeight, this.three.meshHeight);
                return this.additionalUniforms.iResolution; //fixes aspect ratio on halfsphere and circle to be square
            } else if (this.currentView !== 'plane') {
                this.additionalUniforms.iResolution = new THREE.Vector2(Math.max(this.three.meshWidth,this.three.meshHeight), this.three.meshHeight); //fix for messed up aspect ratio on vrscreen and sphere
                return this.additionalUniforms.iResolution;
            } else {
                this.additionalUniforms.iResolution = new THREE.Vector2(this.three.meshWidth, this.three.meshHeight); //leave plane aspect alone
                return this.additionalUniforms.iResolution;
            }
        }
    }

    updateMaterialUniforms = (material,modifiers=this.modifiers) => {
        
        let uniformsToUpdate = this.currentShader.uniforms;

        for (let i=0; i<uniformsToUpdate.length; i++){
            let name = uniformsToUpdate[i];
            let value = material.uniforms[i];
            //console.log( name, material.uniforms[name])

            if (material.uniforms[name] == null) material.uniforms[name] = {value:0};

            if (name === 'iResolution') {
                material.uniforms[name].value = this.getData('iResolution');
            } else if (name === 'iTime') {
                material.uniforms[name].value = this.additionalUniforms.iTime;
            } else if (name === 'iImage') { 
                material.uniforms[name].value = new THREE.Texture(this.three.renderer.domElement.toDataURL());
            } else if (name === 'iMouse') {
                material.uniforms[name].value = new THREE.Vector4(...this.mousexyzw);
            } else if (name === 'iMouseInput') {
                material.uniforms[name].value = this.mouseclicked;
                this.mouseclicked = 0.0;
            } else if (name === 'iChannelTime') {
                material.uniforms[name].value = [this.additionalUniforms.iTime,this.additionalUniforms.iTime,this.additionalUniforms.iTime,this.additionalUniforms.iTime];
            } else if (name === 'iDate') {
                let date = new Date();
                this.additionalUniforms.iDate = new THREE.Vector4(date.getYear(),date.getMonth(),date.getDay(),date.getHours()*3600+date.getMinutes()*60+date.getSeconds());
                material.uniforms[name].value = this.additionalUniforms.iDate;
            } else if (material.uniforms[name] && modifiers[name]) {
                material.uniforms[name].value = modifiers[name];
            } 
        }
        
        return material;
    }
    


    /* 
    UI Stuff
    */

    // Clear Three.js Scene Completely
    clearThree(){
        for (let i = this.three.scene.children.length - 1; i >= 0; i--) {
            const object = this.three.scene.children[i];
            if (object.type === 'Mesh') {
                object.geometry.dispose();
                object.material.dispose();
            }
            this.three.scene.remove(object);
        }
        this.three.scene = null;
        this.three.renderer.domElement = null;
        this.three.renderer = null;
    }

    generateGUI(uniforms){
        let updateUniformsWithGUI = (key,value) => {
            this.three.planes.forEach(p => {
                if (p.material.uniforms[key] == null) p.material.uniforms[key] = {};
                p.material.uniforms[key].value = value;
            });
        }

        let folders = Object.keys(this.gui.__folders)
        if (!folders.includes('Uniforms')){
            this.gui.addFolder('Uniforms');
        }
        let paramsMenu = this.gui.__folders['Uniforms']

        this.guiControllers.forEach(c => {
            paramsMenu.remove(c)
        })
        this.guiControllers = [];        

        let keys = Object.keys(this.modifiers);
        let otherkeys = Object.keys(this.additionalUniforms);
        uniforms.forEach((name)=> {
            if(keys.indexOf(name) > -1){
                if(typeof this.modifiers[name] !== 'object'){
                    this.guiControllers.push(
                        paramsMenu.add(
                            this.modifiers, 
                            name, 
                            this.uniformSettings[name].min,
                            this.uniformSettings[name].max,
                            this.uniformSettings[name].step).onChange(
                                (val) => updateUniformsWithGUI(name,val)));
                }
            } else if (otherkeys.indexOf(name) < 0) {
                this.modifiers[name] = 0;
                this.guiControllers.push(
                    paramsMenu.add(
                        this.modifiers, 
                        name, 
                        0,
                        1000,
                        1
                        ).onChange(
                            (val) => updateUniformsWithGUI(name,val)));
            }
        });

    }


    updateBuzz(modifiers) {
        let node = this.graph.getNode(this.props.id, 'buzz')

        if (modifiers.iFFT){
            this.graph.runSafe(node, 'audioToMotors',{data: modifiers.iFFT, meta: {label: 'iFFT'}})
        }
        if (modifiers.iAudio & modifiers.iFFT.reduce((a,b) => a + b) == 0){
            this.graph.runSafe(node, 'audioToMotors',{data: modifiers.iAudio, meta: {label: 'iAudio'}})
        }

        if (modifiers.iFrontalAlpha1Coherence){
            this.graph.runSafe(node, 'fillLEDs',{data: modifiers.iFrontalAlpha1Coherence, meta: {label: 'iFrontalAlpha1Coherence'}})
        }
    }
} 
