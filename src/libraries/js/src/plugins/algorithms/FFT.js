export class FFT{

    static id = String(Math.floor(Math.random()*1000000))
    
    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        

        this.ports = {
            default: {
                edit: false,
                input: {type: Array},
                output: {type: Array},
                onUpdate: (user) => {
                    let arr =user.data
            
                    // Pass to Worker
                    if (u.meta.label != this.label){
                        if (Array.isArray(arr)){
                            this._analysisFunction(arr)
                            user.meta.label = this.label
                        }else {
                            console.log('invalid type')
                        }
                    } 
                    
                    // Pass from Worker
                    else {
                        return user
                    }
                }
            }
        }

        this.props = {
            id: null,
            waiting: false,

        }
    }

    init = () => {
        this.props.id = window.workers.addWorker(); // add a worker for this DataAtlas analyzer instance
		window.workers.workerResponses.push(this._workerOnMessage);
    }

    deinit = () => {}

    _analysisFunction = (arr) => {
        if(this.props.waiting === false){
            window.workers.postToWorker({foo:'multidftbandpass', input:[[arr], 1, 0, 128, 1], origin:this.label}, this.props.id);
            this.waiting = true;
        }
    }


    _workerOnMessage = (res) => {
        this.waiting = false
        this.session.graph.runSafe(this,'default', {data:res.output[1][0], meta: {label: this.label}})
    }
}