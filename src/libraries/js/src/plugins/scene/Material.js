import * as THREE from 'three'
import { StateManager } from '../../ui/StateManager'
import vertexShader from './shader/vertex.glsl'
import blankFragment from './shader/blankFragment.glsl'

export class Material{

    static id = String(Math.floor(Math.random()*1000000))
    
    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        

        this.props = {
            id: String(Math.floor(Math.random() * 1000000)),
            material: null,
            state: new StateManager(),
            lastRendered: Date.now(),
            uniforms: {},
            defaultColor: '#ffffff'
        }
        
        this.props.material = new THREE.MeshStandardMaterial({color: this.props.defaultColor});

        this.ports = {
            default: {
                edit: false,
                data: this.props.material,
                input: {type: null},
                output: {type: Object, name: 'Material'},
                onUpdate: () => {
                    switch(this.ports.type.data){
                        case 'MeshStandardMaterial':
                            this.props.material = new THREE.MeshStandardMaterial( {color: this.ports.color.data} );
                            break
                        case 'ShaderMaterial':

                            this._replaceUniformsWithThreeObjects(this.props.uniforms) // Conduct on original object

                            this.props.material = new THREE.ShaderMaterial({
                                vertexShader: this.ports.vertexShader.data,
                                fragmentShader: this.ports.fragmentShader.data,
                                uniforms: this.props.uniforms
                            });
                            break
                    }
            
                    this.props.material.side = THREE.DoubleSide
                    this.props.material.transparent = this.ports.transparent.data
                    this.props.material.wireframe = this.ports.wireframe.data
                    this.props.material.depthWrite = this.ports.depthWrite.data
                    this.props.material.alphaTest = this.ports.alphaTest.data
            
                    return {data: this.props.material}
                }
            },
            type: {
                data: 'MeshStandardMaterial', 
                options: [
                    'MeshStandardMaterial',
                    'ShaderMaterial'
                ],
                input: {type: 'string'}, 
                output: {type: null}
            },
            fragmentShader: {
                data: blankFragment,
                input: {type: 'GLSL'},
                output: {type: null},
                onUpdate: (user) => {
                    this.ports.fragmentShader.data = user.data
                    this._updateUniforms(user.meta.uniforms)
                    this._passShaderMaterial()
                }
            },
            vertexShader: {
                data: vertexShader,
                input: {type: 'GLSL'},
                output: {type: null},
                onUpdate: (user) => {
                        this.ports.vertexShader.data = user.data
                        this._updateUniforms(user.meta.uniforms)
                        this._passShaderMaterial()
                }
            },
            color: {data: this.props.defaultColor, input: {type: 'color'}, output: {type: null}},
            transparent: {data: false, input: {type: 'boolean'}, output: {type: null}},
            wireframe: {data: false, input: {type: 'boolean'}, output: {type: null}},
            depthWrite: {data: false, input: {type: 'boolean'}, output: {type: null}},
            alphaTest: {data: 0, min: 0, max: 1, step: 0.01, input: {type: 'number'}, output: {type: null}},
        }
    }

    init = () => {

        // Subscribe to Changes in Parameters
        this.props.state.addToState('params', this.ports, () => {
                this.props.lastRendered = Date.now()
                this.session.graph.runSafe(this,'default',{forceRun: true, forceUpdate: true})
        })
        
        this._passShaderMaterial()
    }

    deinit = () => {
        if (this.props.material){
            this.props.material.dispose()
        }
    }


    _updateUniforms = (uniforms) => {
        if (typeof uniforms === 'object'){
            this._filterMisformattedUniforms(uniforms) // Conduct on original object
            this.props.uniforms = Object.assign(this.props.uniforms, uniforms) // Deep copy to keep params and props separate
            this._replaceUniformsWithThreeObjects(this.props.uniforms)
        }
    }

    _filterMisformattedUniforms = (uniforms) => {
        for (let key in uniforms){
            // console.log(uniforms[key])
            // Remove Misformatted Uniforms
            if (typeof uniforms[key] !== 'object' || !('value' in uniforms[key])) delete uniforms[key]
        }
    }

    _replaceUniformsWithThreeObjects = (uniforms) => {
        for (let key in uniforms){
            let value = uniforms[key].value

            // Remove Misformatted Uniforms
            if (typeof uniforms[key] === 'object' && !('value' in uniforms[key])) delete uniforms[key]
           
            // Try Making Colors from Strings
            else if (typeof value === 'string') uniforms[key].value = new THREE.Color(value)
            
            // Make Vectors from Properly Formatted Objects
            else if (typeof value === 'object' && 'x' in value && 'y' in value) uniforms[key].value = new THREE.Vector2(value.x, value.y)
        }

    }

    _passShaderMaterial = () => {
        if (this.ports.vertexShader.data && this.ports.fragmentShader.data) {
            this.ports.type.data = 'ShaderMaterial'
            this.session.graph.runSafe(this,'default',{forceRun: true, forceUpdate: true})
        }
        else this.ports.type.data = 'MeshStandardMaterial'
    }

    _hexToRgb = (hex) => {
        let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [parseInt(result[1], 16),parseInt(result[2], 16),parseInt(result[3], 16)] : [0,0,0];
    }
}