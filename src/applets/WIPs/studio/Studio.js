import {settings} from '../../templates/blank/settings.js'

class Studio{

    static id = String(Math.floor(Math.random()*1000000))

    constructor(label, session) {

        // Generic Plugin Attributes
        this.label = label
        this.session = session

        // UI Identifier
        this.props = {
            id: String(Math.floor(Math.random()*1000000)),
            container: null,
            projects:null,
            app:null
        }

        // Port Definition
        this.ports = {
            default: {},
            readout: {}, 
            color: {}
        }
    }

    init = () => {
        // Simply define the HTML template
        let HTMLtemplate = () => {return `
            <div id='brainsatplay-studio' style='height:100%; width:100%;'>
            </div>`
        }


        let setupHTML = async () => {
           this.props.container = document.getElementById('brainsatplay-studio')
           this._createApp(settings)
        }

        return {HTMLtemplate, setupHTML}
    }

    default = (input) => {
        return input
    }

    deinit = () => {
        if (this.props.app) this.props.app.deinit()
    }

    _createApp(settings){

        let settingsCopy = Object.assign({}, settings)
        if (settingsCopy.name === 'Blank Project') settingsCopy.name = 'My Project'
        settingsCopy.editor = {
            parentId: this.props.container.id,
            show: true,
            style: `
            position: block;
            z-index: 9;
            `,
        }
        this.props.app = this.session.initApp(settingsCopy, this.props.container,this.session,['edit'])
        this.props.app.init()
    }
}

export {Studio}