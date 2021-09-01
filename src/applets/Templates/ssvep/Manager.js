import {SSVEP} from '../../../libraries/js/src/utils/ssvep/SSVEP'

class Manager{

    static id = String(Math.floor(Math.random()*1000000))

    constructor(label, session) {

        // Generic Plugin Attributes
        this.label = label
        this.session = session

        this.analysis = ['eegfft']

        // UI Identifier
        this.props = {
            id: String(Math.floor(Math.random() * 1000000)),            
        }
        this.props.container = document.createElement('div')
        this.props.container.id = this.props.id

        this.props.grid = document.createElement('div')
        this.props.grid.style = 'width: min(80vw,80vh); height: min(80vw,80vh); padding: 50px; display:grid;'
        this.props.container.insertAdjacentElement('beforeend',this.props.grid)


        this.props.n = 4
        this.props.objects = null; 
        this.props.SSVEPManager = new SSVEP(this.session)
        this.props.freqRange = [4,16]

        // Port Definition
        this.ports = {
            default: {
                input: {type: undefined},
                output: {type: null},
                onUpdate: (user) => {
                    let data = user.data
                    console.log(data)
                    data.eeg.forEach(o => {
                        console.log(o)
                    })
                    // return [{data: null}] // Return Alpha
                }
            }, 

            schedule: {
                input: {type: 'string'},
                output: {type: null},
                onUpdate: (user) => {
                    let labelDiv = document.getElementById(`${this.props.id}-label`)
                    labelDiv.innerHTML = user.meta.state
                    let barDiv = document.getElementById(`${this.props.id}-bar`)
                    let statePercentage = user.meta.stateTimeElapsed / user.meta.stateDuration
                    // Fill a Progress Bar
                    let fillBar = barDiv.querySelector('div')
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
            }
        }
    }

    init = () => {

        this.props.SSVEPManager.init().then((response) => {

            this.props.objects = Array.from({length: this.props.n}, (e,i) => {return {element: null, 
                // f: 1 + (i)*((this.props.SSVEPManager.refreshRate/2)/(this.props.n+2))
                f: this.props.freqRange[0] + i*(this.props.freqRange[1] - this.props.freqRange[0])/(this.props.n-1)
            }})
            
            let gridLength = Math.ceil(Math.sqrt(this.props.objects.length))
            this.props.grid.style.gridTemplateRows = `repeat(${gridLength},1fr)`
            this.props.grid.style.gridTemplateColumns = `repeat(${gridLength},1fr)`


            let objectStyle = `
                background: white;
                box-sizing: border-box;
                margin: 25%;
                border-radius: 50%;
            `

            this.props.objects.forEach((o,i) => {
                let newElement = document.createElement('div')
                newElement.id = i
                newElement.style = objectStyle
                this.props.grid.appendChild(newElement)
                o.element = newElement
            })
            this.props.SSVEPManager.addObjects(this.props.objects)
            this.props.SSVEPManager.start()
        })
    }

    deinit = () => {
        this.props.SSVEPManager.stop()

    }
}

export {Manager}