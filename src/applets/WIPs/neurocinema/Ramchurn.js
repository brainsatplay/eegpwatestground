
// import AND from './films/themoment/AND.mp4'
// import AND1 from './films/themoment/AND1.mp3'
// import AND2 from './films/themoment/AND2.mp3'
// import voxAND from './films/themoment/VOXand.mp3'

// import AST from './films/themoment/AST.mp4'
// import AST1 from './films/themoment/AST1.mp3'
// import AST2 from './films/themoment/AST2.mp3'
// import voxAST from './films/themoment/VOXast.mp3'

// import TEL from './films/themoment/TEL.mp4'
// import TEL1 from './films/themoment/TEL1.mp3'
// import TEL2 from './films/themoment/TEL2.mp3'
// import voxTEL from './films/themoment/VOXtel.mp3'

export class Ramchurn{

    static id = String(Math.floor(Math.random()*1000000))
    
    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        

        this.props = {
            currentScene: 0,
            selectedKey: 0,
            keys: ['primary','secondary'],
            videos: [],
            audio: {
                primary: [],
                secondary: [],
                vox: []
            },

            assets: {
                audio: [], 
                video: []
            },
            
            // The Moment (http://braincontrolledmovie.co.uk/)
            scenes: [
                {duration: 87.32 * 1000},
                {duration: 32.20 * 1000},
                {duration: 115.96 * 1000},
                {duration: 40.80 * 1000},
                {duration: 24.04 * 1000},
                {duration: 94.60 * 1000},
                {duration: 41.88 * 1000},
                {duration: 55.64 * 1000},
                {duration: 141.72 * 1000},
                {duration: 56.84 * 1000},
                {duration: 224.68 * 1000},
                {duration: 39.60 * 1000},
                {duration: 59.16 * 1000},
                {duration: 25.28 * 1000},
                {duration: 204.28 * 1000},
                {duration: 90.44 * 1000},
                {duration: 26.80 * 1000},
                {duration: 90.64 * 1000},
            ],

            slowThreshold: 105, // frames
            fps: 60
        }

        this.props.container = document.createElement('div')
        this.props.container.style = `width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; transition: .5s;`
        
        this.props.input = document.createElement('input')
        this.props.input.type = 'file'
        this.props.input.style.display = 'none'
        this.props.input.accept = 'video/*, audio/*'
        this.props.input.multiple = true

        this.props.input.oninput = () => {
            this.session.graph.runSafe(this,'load', {data: this.props.input.files})
        }

        this.props.buttons = []


        let load = document.createElement('div')
        load.style = `
            height: 100%; 
            flex-grow: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.5s;
        `

        load.innerHTML = '<button class="brainsatplay-default-button" style="width: 80%; flex-grow: 0;">Load Film</button>'
        load.onclick = () => {
            this.props.input.click()
        }
        this.props.container.insertAdjacentElement('beforeend', load)
        this.props.buttons.push(load)

        let design = document.createElement('div')
        design.style.cssText = load.style.cssText
        design.innerHTML = '<button class="brainsatplay-default-button disabled" style="width: 80%; flex-grow: 0;">Design Film</button>'
        this.props.container.insertAdjacentElement('beforeend', design)
        this.props.buttons.push(design)

        this.ports = {

            // Start Film
            start: {
                input: {type: 'boolean'},
                output: {type: null},
                onUpdate: (user) => {
                    if (user.data === true){
                        this.props.looping = true
                        this.props.container.style.opacity = '0'
                        this.setScene(this.props.currentScene)
                        this.animate()
                    }
                }
            },

            // Load Files
            load: {
                input: {type: 'file', multiple: true, accept: "video/mp4, audio/mpeg"},
                output: {type: null},
                onUpdate: (user) => {
                    let files = Array.from(user.data)
                    files.forEach(f => {
                        if (f.type === 'audio/mpeg'){
                            if (f.name.toLowerCase().includes('vox')){
                                this.props.audio.vox.push(f)
                            } else if (f.name.includes('1')){
                                this.props.audio.primary.push(f)
                            } else if (f.name.includes('2')){
                                this.props.audio.secondary.push(f)
                            }
                            this.props.assets.audio.push(f)
                        } else if (f.type === 'video/mp4') {
                            this.props.assets.video.push(f)
                        }
                    })

                    this.props.buttons.forEach(el => el.style.opacity = '0')
                    this.props.container.innerHTML = ''

                    let loaderContainer = document.createElement('div')
                    loaderContainer.style = `
                    display: flex;
                    flex-direction: column;
                    align-content: center;
                    align-items: center;`

                    let loadingAnimation = document.createElement('div')
                    loadingAnimation.classList.add('loading-animation')
                    let loadingMessage = document.createElement('p')
                    loadingMessage.innerHTML = `Loading ${this.props.assets.audio.length + this.props.assets.video.length} files. Please wait...`

                    loaderContainer.insertAdjacentElement('beforeend', loadingAnimation)
                    loaderContainer.insertAdjacentElement('beforeend', loadingMessage)
                    this.props.container.insertAdjacentElement('beforeend', loaderContainer)                    

                    this.props.assets.audio = this.shuffle(this.props.assets.audio) // Shuffle videos
                    this.props.assets.video = this.shuffle(this.props.assets.video) // Shuffle videos
                    this.session.graph.runSafe(this, 'setAudio', {data: this.props.assets.audio}) // Preload audio in mixer
                }
            },

            // Send Audio and Video Out
            controlVideo: {
                input: {type: null},
                output: {type: 'file'},
                // default: [],
                onUpdate: (user) => {
                    // Get Combination
                    let combination = user.data
                    let arr = []
                    this.props.keys.forEach(key => {
                        if (combination[key]?.video) arr.push(combination[key].video)
                    })
                    return {data: arr}
                }
            },
            setAudio: {
                input: {type: null},
                output: {type: 'file'},
                // default: [],
                onUpdate: (user) => {
                    return {data: user.data}
                }
            },
            controlAudio: {
                input: {type: null},
                output: {type: Array},
                // default: [],
                onUpdate: (user) => {
                    let combination =user.data
                    let arr = []
                    this.props.keys.forEach(key => {
                        if (combination[key]?.audio) arr.push(combination[key].audio)
                        if (combination[key]?.vox) arr.push(combination[key].vox)
                    })

                    return {data: arr}
                }
            },

            cut: {
                input: {type: 'boolean'},
                output: {type: 'boolean'},
                onUpdate: (user) => {
                    this.logCut(this.props.scenes[this.props.currentScene])
                    this.props.selectedKey = (this.props.selectedKey + 1) % 2
                    return user
                }
            },

            element: {
                data: this.props.container,
                input: {type: null},
                output: {type: Element}
            }
        }
    }

    init = () => {}

    deinit = () => {
        this.props.looping = false
    }

    animate = () => {
        if (this.props.looping){

            let currentScene = this.props.scenes[this.props.currentScene]
            let timeElapsed = Date.now() - currentScene.date.getTime()
            if (timeElapsed >= currentScene.duration){
                this.props.currentScene++
                this.setScene(this.props.currentScene)
            }
            setTimeout(this.animate, 1000/60)
        }
    }

    setScene = (i) => {
        this.props.scenes.push({})

        // Write to CSV
        this.props.scenes[i].data = []
        this.props.scenes[i].sceneNumber = null
        this.props.scenes[i].combination = this.getNewCombination(this.props.scenes[i-1])
        this.props.scenes[i].cuts = []
        this.props.scenes[i].averageDuration = null
        this.props.scenes[i].durationOnPrimary = 0
        this.props.scenes[i].durationOnSecondary = 0
        this.props.scenes[i].ratio = 0
        this.props.scenes[i].totalCuts = 0
        this.props.scenes[i].screeningNumber = 0
        this.props.scenes[i].date = new Date()

        // Internal Tracking
        this.props.scenes[i].totalVideoFrames = 0
        this.props.scenes[i].lastCut = null
        this.props.scenes[i].cutSlow = null

        this.session.graph.runSafe(this, 'controlVideo', {data: this.props.scenes[i].combination, meta: {replace: true}})
        this.session.graph.runSafe(this, 'controlAudio', {data: this.props.scenes[i].combination})
    }

    endScene = (scene) => {
        this.logCut(scene)
        scene.totalCuts = scene.cuts.length
        scene.totalVideoFrames = (scene.duration * this.props.fps*1000)

        scene.ratio = scene.durationOnPrimary / scene.durationOnSecondary
        scene.cutSlow = scene.totalVideoFrames / scene.totalCuts > this.props.slowThreshold // 1 for slow; 0 for fast
        if (isNaN(scene.cutSlow)) scene.cutSlow = true
    }

     // Ramchurn Utilities

     logCut = (currentScene) => {
        if (Object.keys(currentScene).length > 1){
            let currentTime = Date.now()
            currentScene.cuts.push(Date.now())

            let key = this.props.keys[this.props.selectedKey]
            let duration = currentTime - currentScene.lastCut
            currentScene[`durationOn${key[0].toUpperCase() + key.slice(1)}`] += duration

            if (currentScene.averageDuration == null) currentScene.averageDuration = duration
            else currentScene.averageDuration = (currentScene.averageDuration + duration) / 2

            currentScene.lastCut = currentTime
        }
    }

    createFilePackage(videoFile, mode){
        if (videoFile){
            let name = videoFile.name.replace('.mp4','').toLowerCase()

            let o = {}
            o.video = videoFile
            o.audio = this.props.audio[mode].find(f => f.name.toLowerCase().includes(name))
            o.vox = this.props.audio.vox.find(f => f.name.toLowerCase().includes(name))
            return o
        }
    }

    getNewCombination = (prevScene) => {

        let combination = {
            primary: {},
            secondary: {}
        }
        
        // Only Choose New Sources
        let choices = this.props.assets.video
        if (prevScene) {
            let currentSources = [prevScene.combination.primary.video, prevScene.combination.secondary.video]
            choices = choices.filter(f => !currentSources.includes(f))
            let randomChoice = Math.floor(Math.random() * choices.length)

            this.endScene(prevScene)
            
            if (choices.length == 0) {
                console.log('No Choices')
                combimation = prevScene.combination
            } else {

                // Secondary Dominant
                if (prevScene.ratio < .75) {
                    if (cutSlow) {
                        console.log('Swap Primary and Secondary')
                        combination.primary = prevScene.combination.secondary
                        combination.secondary = prevScene.combination.primary
                    }
                    else {
                        console.log('New Secondary, previous Secondary to Primary')
                        combination.primary = this.createFilePackage(prevScene.combination.secondary.video, 'primary')
                        combination.secondary = this.createFilePackage(choices[randomChoice], 'secondary')
                    }
                }

                // Primary Dominant
                else if (prevScene.ratio > 1.5) {
                    if (prevScene.cutSlow) {
                        console.log('New Secondary')
                        combination.primary = prevScene.combination.primary 
                        combination.secondary = this.createFilePackage(choices[randomChoice], 'secondary')
                    } else {
                        console.log('Same')
                        combimation = prevScene.combination
                    }
                }

                // Equal
                else {
                    if (prevScene.cutSlow) { // New Primary
                        console.log('New Primary')
                        combination.primary = this.createFilePackage(choices[randomChoice], 'primary')
                        combination.secondary = prevScene.combination.secondary
                    }
                    else {
                        console.log('New Primary, previous Primary to Secondary')
                        combination.primary = this.createFilePackage(choices[randomChoice], 'primary')
                        combination.secondary = this.createFilePackage(prevScene.combination.primary.video, 'secondary')
                    }
                }
            }
        } else {
            console.log('First Combination')
            combination.primary = this.createFilePackage(choices[0], 'primary')
            combination.secondary = this.createFilePackage(choices[1], 'secondary')
        }
        return combination
        // this.changeFocus(0)
    }

    shuffle(array) {
        var currentIndex = array.length, randomIndex;

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {

            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            // And swap it with the current element.
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]];
        }

        return array;
    }
}