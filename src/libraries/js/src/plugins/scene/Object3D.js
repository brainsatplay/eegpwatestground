import * as THREE from 'three'
import { StateManager } from '../../ui/StateManager'

export class Object3D{

    static id = String(Math.floor(Math.random()*1000000))
    
    constructor(label, session, params={}) {
        this.label = label
        this.session = session

        this.props = {
            id: String(Math.floor(Math.random() * 1000000)),
            geometry: null,
            material: null,
            mesh: null,
            state: new StateManager(),
            lastRendered: Date.now(),
            tStart: Date.now(),
            looping: false,
            scaleOffset: 0
        }

        this.ports = {
            add: {
                edit: false,
                data: this.props.mesh,
                input: {type: null},
                output: {type: Object, name: 'Mesh'},
                onUpdate: () => {
                    this._setObject()
                    this._updateProps()
                    return {data: this.props.mesh}
                }
            },
            material: {
                edit: false,
                input: {type: Object, name: 'Material'},
                output: {type: null},
                onUpdate: (user) => {
                    this.props.material = user.data
                    if (this.props.mesh){
                        this.props.mesh.material.dispose()
                        this.props.mesh.material = this.props.material
                    }
                }
            },
            geometry: {
                edit: false,
                input: {type: Object, name: 'Geometry'},
                output: {type: null},
                onUpdate: (user) => {
                    this.props.geometry = user.data
                    if (this.props.mesh){
                        this.props.mesh.geometry.dispose()
                        this.props.mesh.geometry = this.props.geometry
                    }
                }
            },
            scale: {
                input: {type: 'number'},
                output: {type: null},
                onUpdate: (user) => {
                    this.ports.scalex.data = this.ports.scaley.data = this.ports.scalez.data = Math.abs(Number.parseFloat(user.data))
                }
            },
            scaleOffset: {
                input: {type: 'number'},
                output: {type: null},
                onUpdate: (user) => {
                    this.props.scaleOffset = Number.parseFloat(user.data)
                    this._updateProps()
                }
            },
            dx: {
                input: {type: 'number'},
                output: {type: null},
                onUpdate: (user) => {
                    let desiredX = Number.parseFloat(this.ports.x.data) + Number.parseFloat(user.data)
                    if (desiredX > 0){
                        this.ports.x.data = desiredX
                    }
                }
            },
            dy: {
                input: {type: 'number'},
                output: {type: null},
                onUpdate: (user) => {
                    let desiredY =  Number.parseFloat(this.ports.y.data) + Number.parseFloat(user.data)
                    if (desiredY > 0){
                        this.ports.y.data = desiredY
                    }
                }
            },

            type: {data: 'Mesh', options: ['Mesh', 'Points']},
            scalex: {data: 1},
            scaley: {data: 1},
            scalez: {data: 1},
            x: {data: 0},
            y: {data: 1},
            z: {data: -2},
            rotatex: {data: 0, min: -2*Math.PI, max: 2*Math.PI, step: 0.1, onUpdate: () => {

            }},
            rotatey: {data: 0, min: -2*Math.PI, max: 2*Math.PI, step: 0.1},
            rotatez: {data: 0, min: -2*Math.PI, max: 2*Math.PI, step: 0.1},
            interactable: {data: false},
        }

        this._setObject()

        this.session.graph.runSafe(this,'add',{forceRun: true, forceUpdate: true})
        this.props.prevType = this.ports.type.data

        // Subscribe to Changes in Parameters
        this.props.state.addToState('params', this.ports, () => {
            this._updateProps()
            // Replace Mesh if Necessary
            if (this.props.prevType != this.ports.type.data) {
                this.session.graph.runSafe(this,'add',{forceRun: true, forceUpdate: true})
                this.props.prevType = this.ports.type.data
            }
        })
    }

    init = () => {

        this.props.looping = true

        let animate = () => {
            if (this.props.looping){
                let tElapsed = (Date.now() - this.props.tStart)/1000; 

                // Set Defaults
                if (this.props.mesh.material.uniforms){
                    if (this.props.mesh.material.uniforms.iTime == null) this.props.mesh.material.uniforms.iTime = {value: tElapsed}
                    if (this.props.mesh.material.uniforms.iResolution == null) this.props.mesh.material.uniforms.iResolution = {value: new THREE.Vector2(1,1)}

                    // Update Defaults
                    this.props.mesh.material.uniforms.iTime.value = tElapsed
                }

                this.props.mesh.interactable = this.ports.interactable.data

                setTimeout(() => {animate()},1000/60)
            }
        }
        animate()

    }

    deinit = () => {
        if (this.props.mesh){
            if (this.props.mesh.type === 'Mesh') {
                this.props.mesh.geometry.dispose();
                this.props.mesh.material.dispose();
            }
        }
        this.props.looping = false
    }

    _updateProps = () => {
        this.props.mesh.scale.set(this.ports.scalex.data + this.props.scaleOffset, this.ports.scaley.data + this.props.scaleOffset, this.ports.scalez.data + this.props.scaleOffset)
        this.props.mesh.position.set(this.ports.x.data, this.ports.y.data, this.ports.z.data)
        if (this.props.mesh.material?.uniforms?.iResolution != null) this.props.mesh.material.uniforms.iResolution.value = new THREE.Vector2(1,1);
        this.props.mesh.rotateX(this.ports.rotatex.data)
        this.props.mesh.rotateY(this.ports.rotatey.data)
        this.props.mesh.rotateZ(this.ports.rotatez.data)
        this.props.mesh.name = `${this.label}`
    }

    // Macros
    _setObject = () => {
        if (this.ports.type.data === 'Mesh'){
            this._createMesh()
        } else if (this.ports.type.data === 'Points'){
            this._createPoints()
        }
    }


    _createMesh = () => {
        if (this.props.material == null) this.props.material = new THREE.MeshPhongMaterial()
        if (this.props.geometry == null) this.props.geometry = new THREE.SphereGeometry()
        this.props.mesh = new THREE.Mesh( this.props.geometry, this.props.material )
    }

    _createPoints = () => {
        if (this.props.material == null) this.props.material = new THREE.PointsMaterial()
        if (this.props.geometry == null) this.props.geometry = new THREE.BufferGeometry()
        this.props.mesh = new THREE.Points( this.props.geometry, this.props.material )
    }
}