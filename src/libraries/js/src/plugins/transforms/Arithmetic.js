export class Arithmetic{
    
    static id = String(Math.floor(Math.random()*1000000))

    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        

        this.props = {
            input: []
        }

        this.ports = {
            input: {
                edit: false,
                default: 0,
                input: {type: undefined},
                output: {type: null},
                onUpdate: (user) => {
                    this.props.input = user
                    this.session.graph.runSafe(this,'sum',{forceRun: true})
                    this.session.graph.runSafe(this,'mean',{forceRun: true})
                    this.session.graph.runSafe(this,'add',{forceRun: true})
                    this.session.graph.runSafe(this,'subtract',{forceRun: true})
                    this.session.graph.runSafe(this,'multiply',{forceRun: true})
                    this.session.graph.runSafe(this,'divide',{forceRun: true})
                }
            },

            add: {
                default: 0,
                input: {type: 'number'},
                output: {type: 'number'},
                onUpdate: (user) => {
                    if (user.data) this.ports.add.data = user.data
            
                    let inputCopy = this.session.graph.deeperCopy(this.props.input)
                    let wasArray = Array.isArray(inputCopy.data)
                    if (!wasArray) inputCopy.data = [inputCopy.data]
                    inputCopy.data = inputCopy.data.map(v => v += this._parseProperFormat(this.ports.add.data))
                    if (!wasArray) inputCopy.data = inputCopy.data[0]
                    return inputCopy
                }
            },
            subtract: {
                default: 0,
                input: {type: 'number'},
                output: {type: 'number'},
                onUpdate: (user) => {
                    if (user.data) this.ports.subtract.data = user.data
                    let inputCopy = this.session.graph.deeperCopy(this.props.input)
            
                        let wasArray = Array.isArray(inputCopy.data)
                        if (!wasArray) inputCopy.data = [inputCopy.data]
                        inputCopy.data = inputCopy.data.map(v => v -= this._parseProperFormat(this.ports.subtract.data))
                        if (!wasArray) inputCopy.data = inputCopy.data[0]
            
                    return inputCopy
                }
            },
            multiply: {
                default: 0,
                input: {type: 'number'},
                output: {type: 'number'},
                onUpdate: (user) => {
                    if (user.data) this.ports.multiply.data = user.data
                    let inputCopy = this.session.graph.deeperCopy(this.props.input)
                    let wasArray = Array.isArray(inputCopy.data)
                    if (!wasArray) inputCopy.data = [inputCopy.data]
                    inputCopy.data = inputCopy.data.map(v => v *= this._parseProperFormat(this.ports.multiply.data))
                    if (!wasArray) inputCopy.data = inputCopy.data[0]
                    return inputCopy
                }
            },
            divide: {
                default: 0,
                input: {type: 'number'},
                output: {type: 'number'},
                onUpdate: (user) => {
                    if (user.data) this.ports.divide.data = user.data
                    let inputCopy = this.session.graph.deeperCopy(this.props.input)
                        let wasArray = Array.isArray(inputCopy.data)
                        if (!wasArray) inputCopy.data = [inputCopy.data]
                        inputCopy.data = inputCopy.data.map(v => v /= this._parseProperFormat(this.ports.divide.data))
                        if (!wasArray) inputCopy.data = inputCopy.data[0]
                    return inputCopy
                }
            },
            mean: {
                edit: false,
                input: {type: null},
                output: {type: 'number'},
                onUpdate: () => {
                    let inputCopy = this.session.graph.deeperCopy(this.props.input)
                    if (Array.isArray(inputCopy.data)) {
                        inputCopy.data = inputCopy.data.reduce((a,b) => a + b)/ inputCopy.data.length
                        return inputCopy
                    }
                }
            },
            sum: {
                edit: false,
                input: {type: null},
                output: {type: 'number'},
                onUpdate: () => {
                    let inputCopy = this.session.graph.deeperCopy(this.props.input)
                    if (Array.isArray(inputCopy.data)) {
                        inputCopy.data = inputCopy.data.reduce((a,b) => a + b)
                        return inputCopy
                    }
                }
            }
        }
    }

    init = () => {}

    deinit = () => {}

    _parseProperFormat = (val) => {
        if (typeof val === 'boolean') val = val ? 1 : 0;
        else val = Number.parseFloat(val)
        return val
    }
}