// import * as oscHelper from 'osc'

export class OSC{

    static id = String(Math.floor(Math.random()*1000000))
    static hidden = true

    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        


        // console.log(oscHelper)
        this.ports = {
            // default: {
            //     input: {type: undefined},
            //     output: {type: null},
            //     onUpdate: (userData) => {
            //         userData.forEach((u,i) => {
            //             console.log(u.username,u.data,u.meta,u)
            //         })
            //     }
            // }
        }
    }

    init = () => {
        
    }

    deinit = () => {}
}