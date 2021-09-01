export class Circle{

    static id = String(Math.floor(Math.random()*1000000))
    
    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        

        this.props = {
            id: String(Math.floor(Math.random() * 1000000)),
            active: true
        }

        this.props.function = {function: this._circleFunction, active: this.props.active}

        this.ports = {
            draw: {
                data: this.props.function,
                input: {type: null},
                output: {type: Object},
                onUpdate: () => {
                    return {data: this.props.function}
                }
            },
            radius: {
                data: 0.5,
                min: 0,
                max: 2,
                step: 0.001,
                input: {type: 'number'},
                output: {type: null},
                onUpdate: (user) => {
                    this.ports.radius.data = user.data
                },
            },
            x: {
                data: 0.5,
                min: 0,
                max: 1,
                step: 0.001,
                input: {type: 'number'},
                output: {type: null},
                onUpdate: (user) => {
                    this.ports.x.data = Number.parseFloat(user.data)
                }
            },
            y: {
                data: 0.5,
                min: 0,
                max: 1,
                step: 0.001,
                input: {type: 'number'},
                output: {type: null},
                onUpdate: (user) => {
                    this.ports.y.data = Number.parseFloat(user.data)
                }
            },
            dx: {
                data: 0,
                input: {type: 'number'},
                output: {type: null},
                onUpdate: (user) => {
                    this.ports.x.data = Number.parseFloat(this.ports.x.data) + Number.parseFloat(user.data)
                }
            },
            dy: {
                data: 0,
                input: {type: 'number'},
                output: {type: null},
                onUpdate: (user) => {
                    this.ports.y.data = Number.parseFloat(this.ports.y.data) + Number.parseFloat(user.data)
                }
            },
            color: {
                data: '#ffffff',
                input: {type: 'color'},
                output: {type: null},
                onUpdate: (user) => {
                    this.ports.color.data = user.data
                }
            },
            radiusOffset: {
                data: 0.0,
                min: -1,
                max: 1,
                step: 0.001,
                input: {type: 'number'},
                output: {type: null},
                onUpdate: (user) => {
                    this.ports.radiusOffset.data = Number.parseFloat(user.data)
                }
            },
            offsetScale: {
                data: 1,
                input: {type: 'number'},
                output: {type: null},
                onUpdate: (user) => {
                    this.ports.offsetScale.data = user.data
                }
            }
        }

    }

    init = (app) => {}

    deinit = () => {
        this.props.function.active = false
    }

    _circleFunction = (ctx) => {
        let width = ctx.canvas.width;
        let height = ctx.canvas.height;

        let minDim = Math.min(width,height)
        let relRadiusBase = minDim/2

        ctx.beginPath();
        ctx.arc(
            width*this.ports.x.data, 
            height*this.ports.y.data, 
            Math.abs(relRadiusBase*Number.parseFloat(this.ports.radius.data) + relRadiusBase*Number.parseFloat(this.ports.radiusOffset.data)*Number.parseFloat(this.ports.offsetScale.data)),
            0, 
            Math.PI*2
            );
        ctx.fillStyle = this.ports.color.data;
        ctx.fill();
        ctx.closePath();
    }
}