export class Peak{

    static id = String(Math.floor(Math.random()*1000000))
    
    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        

        this.props = {
            prevValue: null,
            prevSlope: 0,
            lastTime: Date.now(),
            looping: false,
            buffer: []
        }

        this.ports = {
            default: {
                data: false,
                input: {type: 'number'},
                output: {type: 'boolean'},
                onUpdate: (user) => {
                    let currentValue = user.data
                    if (this.props.prevValue == null) {
                        this.props.prevValue = currentValue
                        user.data = false
                    } else {
                        let slopeDirection = Math.sign(currentValue - this.props.prevValue)
                        if (this.props.prevSlope != slopeDirection){
                            if (this.props.prevSlope === 1) user.data = true // Only fire on movement away from 1
                            else user.data = false
                            this.props.prevSlope = slopeDirection
                        } else user.data = false
                        this.props.prevValue = currentValue
                    }
                    return user
                }
            }
        }
    }

    init = () => {}

    deinit = () => {}
}