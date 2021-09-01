import {Session} from './Session'
import {DOMFragment} from './ui/DOMFragment'
import './ui/styles/defaults.css'

export class Application{
    constructor(
        info={},
        parent=document.body,
        session=new Session(),
        settings=[]
        ){
            
        //-------Keep these------- 
        this._setCoreAttributes(info,parent,session,settings)
        this.AppletHTML = null;
        this.editor = null
        this.graph = null
        //------------------------

        this.container = document.createElement('div')
        this.props = { //Changes to this can be used to auto-update the HTML and track important UI values 
            id: null, //Keep random ID
            sessionId: null,
        };
    }

    init() {
        delete this.intro
        // Grab Style of Previous Top-Level Wrapper
        if (this.props.id == null) this.container.style = `height:100%; width:100%; max-height: 100vh; max-width: 100vw; position: relative; display: flex; overflow: scroll;`

        // Get New ID
        this.props.id = String(Math.floor(Math.random()*1000000))
        this.container.id = this.props.id

        // Register App in Session
        this.graph = this.session.registerApp(this)
        // this.info.graph = this.graph
        let setupHTML = () => {

            // Insert Intefaces and Add App Reference
            this.graph.nodes.forEach(node => {
                this.insertInterface(node)
                if (node.configure instanceof Function ) node.configure(this.settings)
            })

            // Create Device Manager (if required)
            if (this.info.connect){
                let parentNode = this.info.connect?.parentNode
                let toggleButton = this.info.connect?.toggle
                if (typeof toggleButton === 'string') toggleButton = this.parentNode.querySelector(`[id="${toggleButton}"]`)
                this.session.connectDevice(parentNode, toggleButton,this.info.connect?.filter,this.info.connect?.autosimulate,this.info.connect?.onconnect,this.info.connect?.ondisconnect)
            }
        }

        this.AppletHTML = new DOMFragment( // Fast HTML rendering container object
            this.container,       //Define the html template string or function with properties
            this.parentNode,    //Define where to append to (use the parentNode)
            this.props,         //Reference to the HTML render properties (optional)
            setupHTML,          //The setup functions for buttons and other onclick/onchange/etc functions which won't work inline in the template string
            undefined,          //Can have an onchange function fire when properties change
            "NEVER",             //Changes to props or the template string will automatically rerender the html template if "NEVER" is changed to "FRAMERATE" or another value, otherwise the UI manager handles resizing and reinits when new apps are added/destroyed,
            this._deinit,
            this.responsive
        )

        // Create App Intro Sequence
        this.session.createIntro(this, (sessionInfo) => {
            // this.tutorialManager.init();
            // setupHTML()

            // Multiplayer Configuration
            this.session.startApp(this.props.id, sessionInfo?.id ?? this.sessionId)
            
            if (!('editor' in this.info)){
                this.info.editor = {}
                this.info.editor.parentId = this.parentNode.id
                this.info.editor.show = false
                this.info.editor.create = true
            }

            if (!document.getElementById(this.info.editor.parentId)) this.info.editor.parentId = this.parentNode.id


            if (this.info.editor.create != false) this.editor = this.session.graph.edit(this, this.info.editor.parentId, (editor)=> {
                if (this.info.editor.show !== false) editor.toggleDisplay()
            })
        })
    }

        //Delete all event listeners and loops here and delete the HTML block
        _deinit = () => {
            this.session.removeApp(this.props.id)
        }

        deinit = (soft=false) => {            
            if (this.AppletHTML) {
                // Soft Deinit
                if (soft) {
                    this._deinit()
                    if (this.intro) this.intro.deleteNode()
                    this._removeAllFragments()
                }

                // Hard Deinit
                else {
                    this.AppletHTML.deleteNode();
                    this.AppletHTML = null
                }
            }
        }

        responsive = () => {}
        configure = () => {}

        updateGraph(){
            let copiedSettings = this._copySettingsFile({graph: this.graph})
            this.info.graph = copiedSettings.graph // Replace settings
        }

        replace = (info=this.info,parentNode=this.parentNode,session=this.session, settings=this.settings) => {
            this._setCoreAttributes(info, parentNode, session, settings)
            this.deinit(true)
            this.init()
        }

        reload = () => {

            // Soft Deinitialization
            this.updateGraph()
            this.deinit(true)

            // Reinitialize App
            this.init()
        }
    
        _runInternalFunctions(arr){
            arr.forEach(f => {
                if (f instanceof Function) f(this)
            })
        }

        insertInterface(n){

            let ui = n.ui
            if (ui){
                n.fragment = new DOMFragment( // Fast HTML rendering container object
                    ui.HTMLtemplate, //Define the html template string or function with properties
                    this.container,    //Define where to append to (use the parentNode)
                    this.props,         //Reference to the HTML render properties (optional)
                    ui.setupHTML,          //The setup functions for buttons and other onclick/onchange/etc functions which won't work inline in the template string
                    undefined,          //Can have an onchange function fire when properties change
                    "NEVER",             //Changes to props or the template string will automatically rerender the html template if "NEVER" is changed to "FRAMERATE" or another value, otherwise the UI manager handles resizing and reinits when new apps are added/destroyed
                    undefined, // deinit
                    ui.responsive // responsive
                )

                this.session.graph._resizeAllNodeFragments(this.props.id)
            }
        }

        _setCoreAttributes(info={}, parent=document.body, session=new Session(), settings=[]) {
            this.session = session; //Reference to the Session to access data and subscribe
            this.parentNode = parent;
            this.info = this._copySettingsFile(info)
            this.settings = settings
        }

        _removeAllFragments(){
            this.graph.nodes.forEach(n => {if ( n.fragment) {n.fragment.deleteNode()}})
        }

        _copySettingsFile(info){
            info = Object.assign({}, info)
            let keys = ['nodes','edges']
            info.graph = Object.assign({}, info.graph)
            keys.forEach(k => {
                if (info.graph[k]){
                    info.graph[k] = [...info.graph[k]]
                    info.graph[k].forEach(o => {
                        o = Object.assign({}, o)
                        for (let key in o){
                            if (o[key] === Object) o[key] = Object.assign({}, o[key])
                        }
                    })
                }
            })
            return info
        }
}