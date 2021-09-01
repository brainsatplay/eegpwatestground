import * as dragUtils from './dragUtils'
import {Node} from './Node'
import {Edge} from './Edge'

export class Graph{
    constructor(parentNode) {
        this.nodes = {}
        this.edges = []
        this.edgeStructures = []
        this.parentNode = parentNode
    }

    initEdges = (edges) => {
        return new Promise(resolve => {
            if (edges.length > 0){
                edges.forEach(async (e,i) => {
                    await this.addEdge(e)
                    if (i === edges.length - 1) {
                        resolve(this.edges)
                    }
                })
            } else {
                resolve(this.edges)
            }
        })
    }
    
    removeNode(nodeInfo){
        if (this.nodes[nodeInfo.id]){
            this.nodes[nodeInfo.id].element.remove()
            let edges = this.nodes[nodeInfo.id].edges
            for (let i = edges.length - 1; i >=0; i--) this.removeEdge(edges[i])
            delete this.nodes[nodeInfo.id]
        }
    }

    removeEdge(e){
        let types = ['source','target']

        // Remove from Nodes
        types.forEach(t => {
            let deactivate = true
            if (e[t]){
                e[t].edges.forEach((o,i) => {
                    if (o[`${t}Node`].isSameNode(e[`${t}Node`]) && o !== e) deactivate = false // Keep Active 
                    else if (o === e) e[t].edges.splice(i,1)
                })
                if (deactivate) e[`${t}Node`].classList.remove('active')
            }
        })

        // Remove from UI
        e.element.remove()

        // Remove from Graph
        this.edges.find((edge,i) => {
            if (edge == e) {
                this.edges.splice(i,1)
                return true
            }
        })
    }

    addEdge = async (e) => {
        return new Promise(async (resolve, reject) => {
            let edge = new Edge(e, this.nodes)
            let res = await edge.insert(this.parentNode)
            let found,compatible, sourceType, targetType
            if (res === true){
                found = this.edges.find(e => {
                    if (e.structure.source == edge.structure.source && e.structure.target == edge.structure.target) return true
                })

                // Check Edge Compatibility
                let sourcePort = edge.structure.source.split(':')[1] ?? 'default'
                let targetPort = edge.structure.target.split(':')[1] ?? 'default'
                let sP = edge.source.nodeInfo.instance.ports[sourcePort]
                let tP = edge.target.nodeInfo.instance.ports[targetPort]

                let coerceType = (t) => {
                    if (t === 'float') return 'number'
                    else if (t === 'int') return'number'
                    else return t
                }
                sourceType = coerceType(sP.output.type)
                targetType = coerceType(tP.input.type)

                let checkCompatibility = (source,target) => {
                    return source == target || (source === undefined || target === undefined) || (target instanceof Object && source instanceof target)
                }

                compatible = checkCompatibility(sourceType, targetType)
            }
        
        if (res === true && found == null && compatible){
                this.edges.push(edge)
                resolve({msg: 'OK', edge: edge})
            } else {
                this.removeEdge(edge)
                if (res != true) resolve({msg: 'edge is incomplete', edge: edge})
                else if (compatible == false) reject(`Source (${sourceType}) and Target (${targetType}) ports are not of compatible types`)
                else if (found == null) reject('edge already exists')
                else reject(res)
            }
        })
    }


    addNode(nodeInfo) {
        this.nodes[nodeInfo.id] = new Node(nodeInfo,this)
        return this.nodes[nodeInfo.id]
    }
}