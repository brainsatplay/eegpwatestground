export class ERP{

    static id = String(Math.floor(Math.random()*1000000))
    static hidden = true

    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        

        this.ports = {
            default: {
                input: {type: undefined},
                output: {type: null},
                onUpdate: (user) => {
                    
                }
            }
        }
    }

    init = () => {}

    deinit = () => {}
}