export class Index{

    static id = String(Math.floor(Math.random()*1000000))
    
    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        

        this.ports = {
            default: {
                edit: false,
                input: {type: Array},
                output: {type: undefined},
                onUpdate: (user) => {
                    let idx;
                    if (user.data){
                        if (this.ports.method.data == 'first') idx = 0
                        if (this.ports.method.data == 'last') idx = user.data.length - 1
                        return {data: user.data[idx]}
                    }
                }
            },
            method: {
                data: 'first',
                input: {type: 'string'},
                output: {type: null},
                options: ['first','last'],
                onUpdate: (user) => {
                    if (this.ports.method.options.includes(user.data)) this.ports.method.data = user.data
                }
            }
        }
    }

    init = () => {}

    deinit = () => {}
}