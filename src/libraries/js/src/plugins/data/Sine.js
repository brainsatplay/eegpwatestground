
export class Sine{

    static id = String(Math.floor(Math.random()*1000000))
    
    constructor(label, session, params={}) {
        this.label = label
        this.session = session

        this.ports = {
            default: {
                input: {type: null},
                output: {type: 'number'},
                onUpdate: () => {
                    let angularVelocity = 2*Math.PI*(Number.parseFloat(this.ports.frequency.data))
                    let t = Date.now()/1000
                    let phase = Number.parseFloat(this.ports.phase.data)
                    let value = this.ports.center.data + this.ports.scale.data*Number.parseFloat(this.ports.amplitude.data)*Math.sin(angularVelocity*t + phase)
                    return {data: value, meta: {label: this.label}}
                }
            },
            amplitude: {data: 1, min: 0, max: 1000, step: 0.1},
            frequency: {data: 1},
            phase: {data: 0, min: -2*Math.PI, max: 2*Math.PI, step: 0.01},
            rate: {data: 250, min: 0, max: 1000, step: .1},
            center: {data: 0, min: 0, max: 1000, step: .1},
            scale: {data: 1, min: 0, max: 10, step: .1}
        }

        this.props = {
            looping: false,
        }
    }

    init = () => {
        this.props.looping = true

        let animate = () => {
            if (this.props.looping){
                this.session.graph.runSafe(this,'default',{forceRun: true})
                setTimeout(animate,1000/Number.parseFloat(this.ports.rate.data))
            }
        }

        animate()
    }

    deinit = () => {
        this.props.looping = false
    }
}