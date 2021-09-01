import * as THREE from 'three'
import { StateManager } from '../../ui/StateManager'

export class Geometry{

    static id = String(Math.floor(Math.random()*1000000))
    
    constructor(label, session, params={}) {
        this.label = label
        this.session = session

        this.props = {
            id: String(Math.floor(Math.random() * 1000000)),
            geometry: null,
            state: new StateManager(),
            lastRendered: Date.now()
        }

        this.props.geometry = new THREE.SphereGeometry()

        this.ports = {
            default: {
                data: this.props.geometry,
                input: {type: null},
                output: {type: Object, name: 'Geometry'},
                onUpdate: () => {

                    switch(this.ports.type.data){
                        case 'SphereGeometry':
                            this.props.geometry = new THREE.SphereGeometry( this.ports.radius.data, this.ports.segments.data, this.ports.segments.data );
                            break
                        case 'PlaneGeometry':
                            this.props.geometry = new THREE.PlaneGeometry(this.ports.radius.data,this.ports.radius.data,this.ports.segments.data,this.ports.segments.data);
                            break
                        // case 'TetrahedronGeometry':
                        //     this.props.geometry = new THREE.TetrahedronGeometry(this.ports.radius,this.ports.segments);
                        //     break
                        case 'TorusGeometry':
                            this.props.geometry = new THREE.TorusGeometry(this.ports.radius.data);
                            break
                        case 'BoxGeometry':
                            this.props.geometry = new THREE.BoxGeometry(this.ports.radius.data,this.ports.radius.data,this.ports.radius.data);
                            break
                        case 'BufferGeometry':
                            this.props.geometry = new THREE.BufferGeometry();
                            const position = new Float32Array(this.ports.count.data*3)
                            position.forEach((e,i) => {position[i] = Math.random()})
                            const mass = new Float32Array(this.ports.count.data)
                            mass.forEach((e,i) => {mass[i] = Math.random()})
                            this.props.geometry.setAttribute('position', new THREE.BufferAttribute(position ,3))
                            this.props.geometry.setAttribute('mass', new THREE.BufferAttribute(mass ,1))
                            break
                    }
            
                    return {data: this.props.geometry}
                }
            },

            type: {data: 'SphereGeometry', options: [
                'SphereGeometry',
                'PlaneGeometry', 
                // 'TetrahedronGeometry', 
                'TorusGeometry', 
                'BoxGeometry',
                'BufferGeometry'
            ]},
            radius: {data: 1},
            segments: {data: 32, min: 0, max:100, step: 1},
            count: {data: 100, min: 0, max: 10000, step:1.0},
        }

        // Subscribe to Changes in Parameters
        this.session.graph.runSafe(this,'default',{forceRun: true, forceUpdate: true})

        this.props.state.addToState('params', this.ports, () => {
            this.props.lastRendered = Date.now()
            this.session.graph.runSafe(this,'default',{forceRun: true, forceUpdate: true})
        })
    }

    init = () => {

    }

    deinit = () => {
        if (this.props.geometry){
            this.props.geometry.dispose()
        }
    }
}