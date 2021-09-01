
import './Build/webbuild.wasm'
import './Build/webbuild.data'

import * as webconfig from './Build/buildconfig'
import * as webbuild from './Build/webbuild.loader'

export class Unity{

    static id = String(Math.floor(Math.random()*1000000))
    
    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        

        this.props = {
            id: String(Math.floor(Math.random()*1000000)),
            instance: null
        }
        this.props.canvas = document.createElement('canvas')
        this.props.canvas.style = `width: 100%; height: 100%;`

        this.ports = {
            element: {
                data: this.props.canvas,
                input: {type: undefined},
                output: {type: Element},
            },
            webbuild: {
                data: webbuild,
                input: {type: null},
                output: {type: null},
            },
            commands: {
                data: [],
                input: {type: Array},
                output: {type: null},
            },
        }
    }

    init = () => {

        let onError = () => { };
        
        //Add whatever else you need to initialize
        if (this.ports.webbuild.data){
            this.ports.webbuild.data.createUnityInstance(this.props.canvas, webconfig.config, () =>
            { }).then((unityInstance) =>
            {
                this.props.instance = unityInstance;

                // let animate = () => {
                //     // Get Frontal Alpha Coherence
                //     let coherence = this.session.atlas.getCoherenceScore(this.session.atlas.getFrontalCoherenceData(), 'alpha1');
                //     this.props.instance.SendMessage('System', 'UpdateData', coherence);
        
                //     // Continue update
                //     setTimeout(this.animation = window.requestAnimationFrame(animate), 1000 / 60); // Limit framerate to 60fps
                // }

            }).catch(onError);
        }

        this.ports.commands.data.forEach(o => {
            this.session.graph.addPort(this, o.function, {
                input: {type: o.type},
                output: {type: null},
                onUpdate: (user) => {
                    // userData.forEach((u,i) => {
                        let data = user.data
                        console.log(data)
                        if (this.props.instance) this.props.instance.SendMessage(o.object, o.function, data);
                    // })
                }
            })
        })
        
    }

    deinit = () => {
        this.props.instance.Quit()
    }
}