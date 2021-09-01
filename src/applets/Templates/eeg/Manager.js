class Manager{

    static id = String(Math.floor(Math.random()*1000000))

    constructor(label, session) {

        // Generic Plugin Attributes
        this.label = label
        this.session = session

        // UI Identifier
        this.props = {
            id: String(Math.floor(Math.random()*1000000)),
            state: null
        }

        // Port Definition
        this.ports = {
            // default: {
            //     output: {type: null}
            // },
            data: {
                input: {type: undefined},
                output: {type: null},
                onUpdate: (user) => {
                    console.log(user.data)
                    user.data.eeg.forEach(o => {
                        console.log(o)
                    })
                }
            }, 
            // color: {
            //     output: {type: null}
            // }
        }
    }

    init = () => {

    }

    // default = (input) => {
    //     return input
    // }

    // // Write UI using Graph Ports
    // readout = (userData) => {

    //     let labelDiv = document.getElementById(`${this.props.id}-label`)
    //     labelDiv.innerHTML = userData[0].meta.label
    //     let outputDiv = document.getElementById(`${this.props.id}-readout`)
    //     let coherenceReadouts = outputDiv.querySelectorAll(`.readout`)

    //     let nameRegistry = new Set(userData.map(u => u.username))

    //     for (let readout of coherenceReadouts){
    //         if (Array.isArray(userData)){
    //             let username = readout.id.replace(`${this.props.id}-`,'')
    //             let found = userData.find(u => u.username === username)
    //             if (found) {
    //                 nameRegistry.delete(found.username)
    //                 readout.innerHTML = `${found.username}: ${found.data}`
    //             } else {
    //                 readout.remove()
    //             }
    //         }
    //     }

    //     nameRegistry.forEach(name => {
    //         let u = userData.find(u => u.username === name)
    //         let value = u.data
    //         if (typeof value === "number") value = value.toFixed(2)
    //         outputDiv.innerHTML += `<p id="${this.props.id}-${u.username}" class="readout" >${u.username}: ${u.data}</p>`
    //     })

    //     return userData
    // }

    // color = (userData) => {

    //     let coherenceReadouts = document.getElementById(`${this.props.id}-readout`).querySelectorAll(`.readout`)
    //     if (Array.isArray(userData)){
    //         userData.forEach(u =>{
    //         for (let readout of coherenceReadouts){
    //             if (readout.id.replace(`${this.props.id}-`,'') === u.username){
    //                 readout.style = (u.data ? "color: red;" : "")
    //             }
    //         }
    //     })

    //     return userData
    // }
    // }
    

    deinit = () => {}
}

export {Manager}