import {Blink} from '../models/Blink'
import {LDA} from '../machinelearning/LDA'
import {createCards} from '../../ui/browserUtils';
import * as brainsatplay from '../../../brainsatplay'

export class Train{

    static id = String(Math.floor(Math.random()*1000000))
    static hidden = true
    
    constructor(label, session) {
        this.label = label
        this.session = session
        
        this.props = {
            id: String(Math.floor(Math.random() * 1000000)),            
            ui: {}
        }
        
        this.props.container = document.createElement('div')
        this.props.container.classList.add('training-prompt-container')

        this.ports = {
            applets: {data: []},
            trials: {data: 10, min: 1, max: 1000, step: 1},
            trialDuration: {data: 4000, min: 0, max: 60*60*1000, step: 1},
            interTrialIntervalMin: {data: 500, min: 0, max: 60*60*1000, step: 1},
            interTrialIntervalMax: {data: 500, min: 0, max: 60*60*1000, step: 1},

            mode: {
                input: {type: 'string'},
                output: {type: null},
                data: 'Motor Imagery',
                options: ['Motor Imagery', 'Other']
            },
            element: {
                data: this.props.container,
                input: {type: null},
                output: {type: Element}
            }
        }
    }

    init = () => {

        this.props.container.insertAdjacentHTML('beforeend', `
        <div id='${this.props.id}prompt' class="training-prompt">
            <div>
                <h2>${this.ports.mode.data}</h2>
                <p>Latest Performance: <span id="${this.props.id}performance"></spam></p>
            </div>
            <div>
                <button id='${this.props.id}start' class="brainsatplay-default-button disabled">Train Now</button>
            </div>
        </div>
        `)

        this.props.performance = this.props.container.querySelector(`[id='${this.props.id}performance']`)
        this.props.performance.innerHTML = '-'

        this.props.start = this.props.container.querySelector(`[id='${this.props.id}start']`)
        this.props.start.classList.toggle('disabled')

        // Create Training Overlay
        let trainingInfo = {id: this.props.id, class: null}
        if (this.ports.mode.data === 'Motor Imagery'){
            trainingInfo.class = LDA
        } else {
            trainingInfo.class = Blink
        }
        trainingInfo = this.session.graph.instantiateNode(trainingInfo,this.session)

        this.props.trainingOverlay = this._createTrainingIntro(trainingInfo)

        // Reveal Training Intro
        this.props.start.onclick = () => {
            this.props.trainingOverlay.classList.toggle('shown')
        }

        // this.session.graph.runSafe(this,'ui',{forceRun: true, forceUpdate: true})
    }

    deinit = () => {
        if (this.props.trainingOverlay) this.props.trainingOverlay.remove()
    }

    _createTrainingIntro = (info) => {
        // Create Overlay
        this.props.trainingOverlay = document.createElement('div')
        this.props.trainingOverlay.classList.add('training-overlay')
        document.body.insertAdjacentElement('beforeend', this.props.trainingOverlay)

        this.props.gameOverlay = document.createElement('div')
        this.props.gameOverlay.classList.add('training-overlay')
        this.props.gameOverlay.style.padding = 0
        document.body.insertAdjacentElement('beforeend', this.props.gameOverlay)

        // Get Compatible Models and Games
        let modelTypes = Object.keys(brainsatplay.plugins.machinelearning)
        
        this.props.trainingOverlay.insertAdjacentHTML('beforeend', `<h1>${this.ports.mode.data}</h1>`)  

        // Display Models
        let selectedModel
        let modelContainer = document.createElement('div')
        modelContainer.classList.add('training-model-container')
        this.props.trainingOverlay.insertAdjacentElement('beforeend', modelContainer)
        modelTypes.forEach((model, i) => {
            let label = model[0].toUpperCase() + model.slice(1)
            let button = document.createElement('button')
            button.classList.add('training-model-button')
            button.innerHTML = label
            button.onclick = () => {
                for (let child of modelContainer.children){
                    if (child === button) {
                        selectedModel = brainsatplay.plugins.machinelearning[model]
                        child.classList.add('selected')
                    }
                    else child.classList.remove('selected')
                }
            }
            modelContainer.insertAdjacentElement('beforeend', button)
            if (i === 0) button.click()
        })


        // Display Games
        let gameContainer = document.createElement('div')
        this.props.trainingOverlay.insertAdjacentElement('beforeend', gameContainer)
        gameContainer.classList.add('training-game-container')
        gameContainer.insertAdjacentHTML('beforebegin', '<h2>Choose your Training Game</h2><hr>')

        // Find Applets for Training
        let appletFilter = (settings) => {

            let foundBinding;
            if (settings.graph){
                settings.graph.nodes.forEach(n => {
                    if (n.class.name === 'Event') foundBinding = true
                })
            }
            if (foundBinding && settings.canTrain) return settings
        }

        let selectedSettings
        let clickCallback = (element, settings) => {
            for (let child of gameContainer.children){
                if (child === element) {
                    element.classList.add('selected')
                    selectedSettings = settings
                }
                else child.classList.remove('selected')
            }
        }

        let applets = createCards(this.ports.applets.data, appletFilter, clickCallback)

        applets.forEach((o,i) => {
            gameContainer.insertAdjacentElement('beforeend', o.element)
            if (i === 0) o.element.click()
        })


        // Add Buttons
        let buttonDiv = document.createElement('div')
        buttonDiv.classList.add(`training-buttons`)

        let backButton = document.createElement('button')
        backButton.classList.add(`brainsatplay-default-button`)
        backButton.innerHTML = 'Go Back'
        backButton.onclick = () => {
            this.props.trainingOverlay.classList.toggle('shown')
        }

        let continueToggle = document.createElement('button')
        continueToggle.classList.add(`brainsatplay-default-button`)
        continueToggle.innerHTML = 'Start Training'
        continueToggle.onclick = () => {
            // FIX: Integrate selectedModel
            this.props.trainingGame = this.session.initApp(selectedSettings, this.props.gameOverlay,this.session)
            this.props.trainingGame.init()
            this.props.gameOverlay.classList.toggle('shown')

            // Stop Training
            setTimeout(() => {
                this.props.trainingGame.deinit()
                this.props.gameOverlay.classList.toggle('shown')
            }, 5000)
        }

        buttonDiv.insertAdjacentElement('beforeend', backButton)
        buttonDiv.insertAdjacentElement('beforeend', continueToggle)
        this.props.trainingOverlay.insertAdjacentElement('beforeend', buttonDiv)

        // Show Directions
        
        return this.props.trainingOverlay
    }
}