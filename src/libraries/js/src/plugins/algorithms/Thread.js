import { WorkerManager } from "../../Workers"

export class Thread{

    static id = String(Math.floor(Math.random()*1000000))
    
    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        

        this.props = {
            id: String(Math.floor(Math.random()*1000000)),
            workerPostTime: 0,
            workerWaiting: false,
            workerId: 0,
            messageBuffer: []
        }

        if (window.workers == null) window.workers = new WorkerManager()
		else console.log('Workers already created.')

        this.ports = {
            default: {
                input: {type: undefined},
                output: {type: undefined},
                onUpdate: (user) => {
                    if (user.meta.source != this.label){
                        this._postData(user.data)
                    } else {
                        return user
                    }
                }
            },
            function: {
                data: (data)=>{return data + 1},
                input: {type: Function},
                output: {type: null},
                onUpdate: () => {
                    this._postToWorker({foo:'addfunc', input:['myfunction', this.ports.function.data], origin:this.props.id})
                }
            }
        }
    }

    init = () => {
        if(!window.workers.workerResponses) { window.workers.workerResponses = []; } //placeholder till we can get webworkers working outside of the index.html
		this.props.workerId = window.workers.addWorker(); // add a worker for this DataAtlas analyzer instance
        window.workers.workerResponses.push(this._onMessage);
        this.session.graph.runSafe(this, 'function', {forceRun: true})
    }

    deinit = () => {
        window.workers.terminate(this.props.workerId);
    }

    _onMessage = (msg) => {
        if (msg.origin === this.props.id){
            this.session.graph.runSafe(this, 'default', {data: msg.output})
            this.props.workerWaiting = false;
        }
    }

    _postData = (data) => {
        let msg = {foo:'myfunction', input:data, origin:this.props.id}
        this._postToWorker(msg)
    }
    
    _postToWorker = (msg) => {
        if(this.props.workerWaiting === false){
            this.props.workerPostTime = Date.now()
            if (this.props.messageBuffer.length > 0) msg = this.props.messageBuffer.shift()
            window.workers.postToWorker(msg, this.props.workerId);
            this.props.workerWaiting = true;
        } else if (msg.foo === 'addfunc') this.props.messageBuffer.push(msg) // Add new functions to buffer
    }
}