export class Enumerate{

    static id = String(Math.floor(Math.random()*1000000))
    
    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        

        this.ports = {
            default: {
                input: {type: Object},
                output: {type: null},
                onUpdate: (user) => {
                        if (user.data != null){
                            // Objects
                            let keys = Object.keys(user.data)
                            keys.forEach(k => {
                                if (this.ports[k] == null){
                                    let portInfo = {
                                        data: user.data[k],
                                        input: {type: null},
                                        output: this.session.graph.getTypeDict(user.data[k]),
                                        onUpdate: (user) => {
                                            return user
                                        }
                                    }
                                    this.session.graph.addPort(this,k,portInfo)
                                }
                                this.session.graph.runSafe(this,k, {data: user.data[k]})
                            })
                        }
                }
            }
        }
    }

    init = () => {}

    deinit = () => {}
}