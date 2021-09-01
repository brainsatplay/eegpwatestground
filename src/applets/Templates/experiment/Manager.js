class Manager{

    static id = String(Math.floor(Math.random()*1000000))

    constructor(label, session) {

        // Generic Plugin Attributes
        this.label = label
        this.session = session

        // UI Identifier
        this.props = {
            id: String(Math.floor(Math.random() * 1000000)), 
            states: {},
            lastAtlas: null  ,
            prevState: null,
            container: document.createElement('div'),
            experiment: document.createElement('div'),
            cross: document.createElement('p'),
            start: document.createElement('div'),
            startButton: document.createElement('button'),
        }
        
        this.props.container.id = this.props.id
        this.props.experiment.style = this.props.start.style = 'width: 100%; text-align: center;'

        // Start Screen
        this.props.start.innerHTML = `<h2 style="margin: 0px">Alpha Power</h2>`
        this.props.start.innerHTML += `<i style='font-size: 80%'>Eyes Open vs. Eyes Closed</i><br/><br/>`

        this.props.startButton.innerHTML = 'Start Experiment'
        this.props.startButton.classList.add('brainsatplay-default-button')
        this.props.startButton.classList.toggle('disabled')
        this.props.startButton.onclick = () => {
            this.session.graph.runSafe(this,'start', {data: true})
        }

        this.props.start.insertAdjacentElement('beforeend', this.props.startButton )
        this.props.container.insertAdjacentElement('beforeend', this.props.start)


        // Experiment
        this.props.cross.style = `  
        display:inline-block;
        width:25px;
        height:25px;
        
        background:
        linear-gradient(#fff,#fff),
        linear-gradient(#fff,#fff),
        #000;
        background-position:center;
        background-size: 100% 2px,2px 100%; /*thickness = 2px, length = 50% (25px)*/
        background-repeat:no-repeat;
        `

        this.props.experiment.insertAdjacentElement('beforeend', this.props.cross)

        this.props.label = document.createElement('h3')
        this.props.bar = document.createElement('div')
        this.props.bar.style = 'background: transparent; height: 7px; width: 100%; position: absolute; bottom: 0; left: 0;'
        this.props.bar.innerHTML = `<div style="background: white; height: 100%; width: 100%;">`
        this.props.experiment.insertAdjacentElement('beforeend',this.props.label)
        this.props.experiment.insertAdjacentElement('beforeend',this.props.bar)

        this.props.experiment.style.display = 'none'
        this.props.container.insertAdjacentElement('beforeend', this.props.experiment)


        // Port Definition
        this.ports = {
            default: {
                input: {type: undefined},
                output: {type: null},
                onUpdate: (user) => {
                    if (this.props.lastAtlas == null) this.props.startButton.classList.toggle('disabled')
                    this.props.lastAtlas = user.data
                    // this.props.lastAtlas.eeg.forEach(o => {
                    //     console.log(o)
                    // })
                    // return [{data: null}] // Return Alpha
                }
            }, 

            schedule: {
                input: {type: 'string'},
                output: {type: null},
                onUpdate: (user) => {
                    this.props.label.innerHTML = user.meta.state
                    let statePercentage = user.meta.stateTimeElapsed / user.meta.stateDuration
                    // Fill a Progress Bar
                    let fillBar = this.props.bar.querySelector('div')
                    if (user.meta.state === 'ITI') fillBar.style.background = 'red'
                    else fillBar.style.background = '#00FF00'
            
                    if (statePercentage > 1) statePercentage = 1
                    fillBar.style.width = `${statePercentage*100}%`
                }
            },

            element: {
                edit: false,
                input: {type: null},
                output: {type: Element},
                data: this.props.container,
                onUpdate: () => {
                    this.ports.element.data = this.props.container
                    return {data: this.ports.element.data}
                }
            },

            state: {
                edit: false,
                input: {type: 'string'},
                output: {type: null},
                onUpdate: (user) => {

                    if (user.data != null){ 

                        console.error(user.data)
                        let state = (user.data != 'ITI') ? user.data : this.props.prevState
                        if (this.props.states[state] == null) this.props.states[state] = new Set()
                        if (this.props.lastAtlas) this.props.states[state].add(this.props.lastAtlas.eeg[0].fftCount)
                        this.props.prevState = state
                    }
                }
            },

            done: {
                edit: false,
                input: {type: undefined},
                output: {type: null},
                onUpdate: (user) => {

                    let alphaMeans = {}
                        Object.keys(this.props.states).forEach(key => {
                        
                        alphaMeans[key] = {}

                        if (this.props.lastAtlas){
                            this.props.lastAtlas.eeg.forEach(coord => {

                                const iterator = this.props.states[key].values()

                                let i1 = iterator.next().value
                                let i2 = iterator.next().value

                                let a1 = coord.means.alpha1.slice(i1, i2)
                                let a2 = coord.means.alpha2.slice(i1, i2)
                                console.log(i1, i2, a1, a2)
                                
                                let a = (this.session.atlas.mean(a1) + this.session.atlas.mean(a2)) / 2
                                alphaMeans[key][coord.tag] = a
                            })
                        }
                    })

                    console.log(this.props.lastAtlas)

                    console.log(alphaMeans)

                    this.props.start.style.display = 'flex'
                    this.props.start.innerHTML = ''
                    for (let condition in alphaMeans){
                        let div = document.createElement('div')
                        div.style.padding = '20px'
                        div.style.textAlign = 'left'

                        if (condition != ''){
                            div.innerHTML += `<i style="font-size: 80%">Alpha Power</i>`
                            div.innerHTML += `<h2 style="margin: 0px">${condition}</h2>`
                            for (let tag in alphaMeans[condition]){
                                div.innerHTML += `<p style="font-size: 80%">${tag}: ${alphaMeans[condition][tag].toFixed(4)}</p>`
                            }
                            this.props.start.insertAdjacentElement('beforeend', div)
                        }
                    }

                    this.props.experiment.style.display = 'none'
                }
            },

            start: {
                onUpdate: (user) =>{
                    console.log(user)
                    if (user.data){
                        this.props.start.style.display = 'none'
                        this.props.experiment.style.display = ''
                        return user
                    }
                }
            }
        }
    }

    init = () => {}

    deinit = () => {}
}

export {Manager}