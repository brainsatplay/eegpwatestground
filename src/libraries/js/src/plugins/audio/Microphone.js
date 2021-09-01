import {SoundJS} from '../../utils/Sound'
import {eegmath} from '../../utils/eegmath'


export class Microphone{
    
    static id = String(Math.floor(Math.random()*1000000))

    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        

        this.ports = {
            fft: {
                data: [],
                input: {type: null},
                output: {type: Array},
                onUpdate: () => {
                    let audioDat = [];

                    // Get Audio
                    if(window.audio){
                        var array = new Uint8Array(window.audio.analyserNode.frequencyBinCount); //2048 samples
                        window.audio.analyserNode.getByteFrequencyData(array);
                        audioDat = this._reduceArrByFactor(Array.from(array),4);
                    } else {
                        audioDat = new Array(256).fill(0);
                    }
                    return {data: audioDat, meta: {}}
                }
            }, 
        }

        this.props = {
            mic: null,
            looping: false,
            fxStruct: {},
        }
    }

    init = () => {
        if(!window.audio) window.audio = new SoundJS();
        if (window.audio.ctx===null) {return;};

        let fx = JSON.parse(JSON.stringify(this.props.fxStruct));

        fx.sourceIdx = window.audio.record(undefined,undefined,null,null,false,()=>{
            if(fx.sourceIdx !== undefined) {
                fx.source = window.audio.sourceList[window.audio.sourceList.length-1];
                fx.playing = true;
                fx.id = 'Micin';
                this.props.hostSoundsUpdated = false;
            }
        });

        this.props.mic = fx

        window.audio.gainNode.disconnect(window.audio.analyserNode);
        window.audio.analyserNode.disconnect(window.audio.out);
        window.audio.gainNode.connect(window.audio.out);

        this.props.looping = true
        let animate = () => {
            if (this.props.looping){
                this.session.graph.runSafe(this,'fft',{data: true})
                setTimeout(() => {animate()}, 1000/60)
            }
        }
        animate()

    }

    deinit = () => {
        this.props.mic.source.mediaStream.getTracks()[0].stop();
        window.audio.gainNode.disconnect(window.audio.out);
        window.audio.gainNode.connect(window.audio.analyserNode);
        window.audio.analyserNode.connect(window.audio.out);
        
        this.props.looping = false
    }

    _reduceArrByFactor(arr,factor=2) { //faster than interpolating
        let x = arr.filter((element, index) => {
            return index % factor === 0;
        });
        return x;
    }
}