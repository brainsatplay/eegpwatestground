export class Debug{

    static id = String(Math.floor(Math.random()*1000000))
    
    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        

        this.ports = {
            default: {
                data: undefined,
                input: {type: undefined},
                output: {type: null},
                onUpdate: (user) => {
                    console.log(user.username,user.data,user.meta,user)
                }
            }
        }
    }

    init = () => {}

    deinit = () => {}
}