export class Number{

    static id = String(Math.floor(Math.random()*1000000))
    
    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        

        this.ports = {
            value: {
                data: 5,
                input: {type: 'number'},
                output: {type: 'number'},
                onUpdate: (user) => {
                    this.ports.value.data = user.data
                    return user
                }
            }
        }
    }

    init = () => {
        // this.session.graph.runSafe(this, 'default',{data: this.ports.default.data, forceUpdate: true})
    }

    deinit = () => {}
}