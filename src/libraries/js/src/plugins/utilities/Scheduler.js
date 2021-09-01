export class Scheduler{
    
    static id = String(Math.floor(Math.random()*1000000))

    constructor(label, session, params={}) {
        this.label = label
        this.session = session

        this.ports = {
            default: {
                data: -1,
                meta: {label: this.label},
                input: {type:null},
                output: {type: 'string'},
                onUpdate: (user) => { 
                    if (this.props.currentTrial >= 0){
                        user.data = this.props.currentTrial
                        user.meta.label = this.label
                        user.meta.state = this.props.state;
                            if (user.meta.state != 'ITI'){
                                user.meta.stateTimeElapsed = Date.now() - this.props.taskData[this.props.currentTrial].tStart
                                user.meta.stateDuration = this.ports.duration.data*1000
                            } else {
                                user.meta.stateTimeElapsed = Date.now() - (this.props.taskData[this.props.currentTrial].tStart + this.ports.duration.data*1000)
                                user.meta.stateDuration = this.ports.interTrialInterval.data*1000
                            }
                            user.meta.trialCount = this.ports.trialCount.data
                        return user
                    }
                }
            }, 
            state: {
                input: {type:null},
                output: {type: 'string'},
                onUpdate: (user) => { 
                    user.data = this.props.state;
                    user.meta.label = this.label
                    return user
                }
            }, 
            done: {
                input: {type:null},
                output: {type: 'boolean'},
                onUpdate: (user) => { 
                    return {data:true, forceUpdate: true}
                }
            },
            update: {
                input: {type:'boolean'},
                output: {type: null},
                onUpdate: (user) => { 
                    let trigger = user.data
                    if (trigger && this.ports.mode.data === 'Manual') {
                        this._taskUpdate(false, true)
                    }
                }
            },
            reset: {
                input: {type:'boolean'},
                output: {type: null},
                onUpdate: (user) => { 
                    let trigger = user.data
                    if (trigger) {
                        if ('params' in user.meta){
                            for (let param in user.meta.params){
                                this.ports[param].data = user.meta.params[param]
                            }
                        }
                        this.init()
                    }
                }
            },

            // Old Params
            paradigm: {data: 'Task', options: ['Task'], input: {type: null}, output: {type: null}},
            mode: {data: 'Auto', options: ['Auto', 'Manual'], input: {type: null}, output: {type: null}},
            duration: {data: 2, input: {type: null}, output: {type: null}},
            trialCount: {data: 10, input: {type: null}, output: {type: null}},
            trialTypes: {data: new Set('1', '2', "3"), input: {type: null}, output: {type: null}, edit: false},
            progression: {data: null, input: {type: null}, output: {type: null}, edit: false},
            interTrialInterval: {data: 0, input: {type: null}, output: {type: null}},
            allowConsecutive: {data: true, input: {type: null}, output: {type: null}},
            start: {data: true, output: {type: null}, onUpdate: (user) => {
                if (user.data){
                    this.init(user.data)
                }
            }}
        }

        this.props = {
            taskData: [],
            currentTrial: null,
            iti: null,
            active: false,
            state: '',
        }
    }

    init = (trigger) => {
        if (this.ports.start.data || trigger){
            this.props.currentTrial = -1
            this.props.taskData = []
            this.props.iti = false
            this.props.active = true

            if (this.ports.progression.data == null) {
                this.ports.progression.data = []
                // Create Random Progression
                let prevChoice
                for (let i = 0; i < this.ports.trialCount.data; i++){
                    let options = new Set(this.ports.trialTypes.data)
                    if (!this.ports.allowConsecutive.data) options.delete(prevChoice)
                    let choice = Math.floor(options.size * Math.random())
                    let ind = 0
                    options.forEach((val) => {
                        if (ind === choice) {
                            this.ports.progression.data.push(val)
                            prevChoice = val
                        }
                        ind++
                    })
                }
            } else {
                this.ports.trialCount.data = this.ports.progression.data.length
            }

            // Start Task Loop
            if (this.ports.mode.data === 'Auto'){
                this._taskUpdate()
            } else {
                this._taskUpdate(false)
            }
        }
    }
    

    deinit = () => {
        this.props.active = false
    }

    _taskUpdate = (loop=true, forceUpdate=false) => {


        if (this.props.currentTrial > -1){
            let trialTimeElapsed = Date.now() - this.props.taskData[this.props.currentTrial].tStart

            // Main Trial Loop
            if (forceUpdate || (this.props.currentTrial < this.ports.trialCount.data && trialTimeElapsed > (this.ports.duration.data + this.ports.interTrialInterval.data)*1000)){  

                this._startNewTrial()

                // Stop on Last Trial
                if (this.props.currentTrial >= this.ports.trialCount.data){ // Stop Loop
                    this.props.state = ''
                    this.session.atlas.graph.runSafe(this,'state',{forceRun: true, forceUpdate: true})
                    this.session.atlas.graph.runSafe(this,'done',{forceRun: true, forceUpdate: true})
                }
            } 

            // Inter-trial Interval Loop
            else if (trialTimeElapsed > (this.ports.duration.data)*1000 && this.props.currentTrial < this.ports.trialCount.data - 1 && this.props.iti === false){
                this.props.state = 'ITI'
                this.props.iti = true
                this.session.atlas.graph.runSafe(this,'state',{forceRun: true, forceUpdate: true})
            }
        } else {
            this._startNewTrial()
        }

        this.session.atlas.graph.runSafe(this,'default', {forceRun: true, forceUpdate: true})
        if (this.props.active && loop && this.props.currentTrial != this.ports.trialCount.data) setTimeout(this._taskUpdate, 1000/60) // 60 Loops/Second
    }

    _startNewTrial(){
        this.props.currentTrial++ // Increment Trial Counter
        this.props.taskData.push({tStart: Date.now()}) // Add New Trial Array
        this.props.iti = false
        this.props.state = this.ports.progression.data[this.props.currentTrial]
        this.session.atlas.graph.runSafe(this,'state',{forceRun: true, forceUpdate: true})
    }
}