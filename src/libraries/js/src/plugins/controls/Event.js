// Generic Event Trigger. Uses Key Presses by Default.

export class Event{

    static id = String(Math.floor(Math.random()*1000000))

    constructor(label, session, params={}) {
        this.label = label
        this.session = session

        this.ports = {}

            // // Set type of control
            // type: {
            //     edit: false,
            //     default: 'event',
            //     options: ['event', 'p300', 'ssvep'],
            //     input: {type: null},
            //     output: {type: null},
            //     onUpdate: (user) => {
            //         this.ports.type.data = user.data
            //     }
            // },

            // // Pass commands to downstream element
            // command: {
            //     edit: false,
            //     input: {type: null},
            //     output: {type: 'boolean'},
            //     onUpdate: (user) => {
            //         return user
            //     }
            // },

            this.ports.keycode =  {
                data: 'Space',
                input: {type: 'string'},
                output: {type: null}
            }
            
            this.ports.default = {
                data: false,
                meta: {label: `${this.ports.keycode.data}`},
                input: {type: 'boolean'},
                output: {type: 'boolean'}
            }
    }

    init = () => {
        document.addEventListener('keydown',this.handleKeyDown)
        document.addEventListener('keyup',this.handleKeyUp)
    }

    deinit = () => {
        document.removeEventListener('keydown',this.handleKeyDown)
        document.removeEventListener('keyup',this.handleKeyUp)
    }

    handleKeyDown = (e) => {
        if (this.matchKey(e.code) && this.ports['default'].data != true){
            this.session.graph.runSafe(this,'default',{data: true})
        } 
    }
    
    handleKeyUp = (e) => {
        if (this.matchKey(e.code)){
                this.session.graph.runSafe(this,'default', {data: false})
        }
    }

    matchKey(keycode){
        let regex = new RegExp(`(?:^|\W)${this.ports.keycode.data}(?:$|\W)`,'i')
        return keycode.match(regex) || keycode.replace('Key', '').match(regex) || keycode.replace('Digit', '').match(regex)
    }
}