
export class Node {
    constructor(nodeInfo, graph) {
        this.graph = graph
        this.nodeInfo = nodeInfo
        this.parentNode = this.graph.parentNode ?? document.body
        this.latencyDisplays = {}
        this.element = this.createElement(this.nodeInfo)

        // Set Transform based on Settings
        if (this.nodeInfo.style) {
            let transform = this.nodeInfo.style.split('transform: ')[1].split(';')[0]
            this.element.style.transform = transform
        }

        this.edges = []
    }

    registerEdge(edge) {
        this.edges.push(edge)
    }

    updateEdge(edge) {
        let o = this.edges.find(o => o === edge)
        // Derive Queries

        let types = Object.keys(o.structure)
        let k1 = types.shift()
        let type = (o.structure[k1].split(':')[0].includes(this.nodeInfo.id)) ? k1 : null
        if (type == null) type = (k1 === 'source') ? 'target' : 'source'
        let className = (type === 'source') ? 'p1' : 'p2'

        // Grab Elements
        let portElement = o[`${type}Node`]
        portElement.classList.add('active') // Label Active Node

        let portDim = portElement.getBoundingClientRect()
        let svgP = o.svgPoint(o.svg, portDim.left + portDim.width / 2, portDim.top + portDim.height / 2)

        // Update Edge Anchor
        o.updateElement(
            o.node[className],
            {
                cx: svgP.x,
                cy: svgP.y
            }
        );

        // Grab Other Side of Edge
        let otherType = (type == 'source') ? 'target' : 'source'
        let otherElement = o[`${otherType}Node`]
        let svgO
        if (otherElement) {
            let otherDim = otherElement.getBoundingClientRect()
            svgO = o.svgPoint(o.svg, otherDim.left + otherDim.width / 2, otherDim.top + otherDim.height / 2)
        } else {
            svgO = svgP
        }
        // Update Control Points
        let sP = (type == 'source') ? svgP : svgO
        let tP = (type == 'source') ? svgO : svgP

        o.updateControlPoints(sP, tP)
        o.drawCurve();
    }

    updateAllEdges = () => {
        this.edges.forEach(o => {
            this.updateEdge(o)
        })
    }

    removePort(port) {
        // let node = this.nodeInfo.instance
        let input = this[`inputPorts`].querySelector(`.port-${port}`)
        input.parentNode.remove()
        let output = this[`outputPorts`].querySelector(`.port-${port}`)
        output.parentNode.remove()
        let label = this.portLabels.querySelector(`[name="${port}"]`)
        label.remove()
        this.resize()
    }

    addPort(port) {
        let node = this.nodeInfo.instance
        let portTypes = ['target', 'source']
        portTypes.forEach(s => {

            let inorout = (s == 'target') ? 'input' : 'output'
            let nodeType

            let portInfo = node.ports[port][inorout]
            nodeType = portInfo?.type
            if (nodeType instanceof Object) nodeType = portInfo.name ?? nodeType?.name
            let portWrapper = document.createElement('div')
            portWrapper.classList.add(`node-port-wrapper`)
            let portElement = document.createElement('div')
            portElement.classList.add(`node-port`)
            portElement.classList.add(`port-${port}`)
            portElement.classList.add(`type-${nodeType}`)
            portElement.setAttribute('data-node', this.nodeInfo.id)
            portElement.setAttribute('data-port', port)

            let existingLabel = this.portLabels.querySelector(`[name="${port}"]`)
            if (!existingLabel) {
                this.portLabels.innerHTML += `
                    <div class="node-label" name="${port}">
                        <span>${port}</span>
                    </div>
                `
                this.latencyDisplays[port] = document.createElement('div')
                this.latencyDisplays[port].setAttribute('name', port)
                this.latencyDisplays[port].classList.add('latency-display')
                this.portLabels.querySelector(`[name="${port}"]`).insertAdjacentElement('afterend', this.latencyDisplays[port])    
            }

            portWrapper.insertAdjacentElement('beforeend', portElement)
            this[`${inorout}Ports`].insertAdjacentElement('beforeend', portWrapper)
        })
        this.resize()
    }

    createElement(nodeInfo) {
        let node = nodeInfo.instance
        this.nodeDiv = document.createElement(`div`)
        this.nodeDiv.classList.add("brainsatplay-default-node-div")

        let element = document.createElement(`div`)
        element.classList.add("brainsatplay-display-node")

        this.portManager = document.createElement(`div`)
        this.portManager.classList.add("brainsatplay-port-manager")

        // Add Port Label Container
        this.portLabels = document.createElement(`div`)
        this.portLabels.classList.add(`node-label-container`)

        // Add Port Containers
        this[`inputPorts`] = document.createElement('div')
        this[`inputPorts`].classList.add(`node-port-container`)
        this[`inputPorts`].classList.add(`target-ports`)
        this[`outputPorts`] = document.createElement('div')
        this[`outputPorts`].classList.add(`node-port-container`)
        this[`outputPorts`].classList.add(`source-ports`)

        this.portManager.insertAdjacentElement('beforeend', this[`inputPorts`])
        this.portManager.insertAdjacentElement('beforeend', this[`outputPorts`])
        this.portManager.insertAdjacentElement('beforeend', this.portLabels)

        for (let port in node.ports) {
            this.addPort(port)
        }

        let nodeText = document.createElement('div')
        nodeText.classList.add('node-text')
        nodeText.innerHTML = `
            <h3>${node.constructor.name}</h3>
            <p>${node.label}<p>
        `

        element.insertAdjacentElement('beforeend', nodeText)

        element.insertAdjacentElement('beforeend', this.portManager)
        this.nodeDiv.insertAdjacentElement('beforeend', element)
        this.parentNode.insertAdjacentElement('beforeend', this.nodeDiv)

        this.resize()

        return this.nodeDiv
    }

    resize(){
        let portContainers = this.nodeDiv.getElementsByClassName(`node-port-container`)

        let minWidth = 100
        let minHeight = 0
        for (let container of portContainers) {
            minHeight = Math.max(minHeight, container.clientHeight)
        }
        minWidth = Math.max(minWidth, this.portLabels.offsetWidth)

        if (this.portManager.offsetWidth < minWidth) this.portManager.style.width = `${minWidth}px`
        if (this.portManager.offsetHeight < minHeight) this.portManager.style.height = `${minHeight}px`
    }
}