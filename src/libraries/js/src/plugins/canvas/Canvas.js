export class Canvas{

    static id = String(Math.floor(Math.random()*1000000))
    
    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        
        this.props = {
            id: String(Math.floor(Math.random() * 1000000)),
            canvas: null,
            container: null,
            context: null,
            drawObjects: [],
            looping: false
        }

        this.props.container = document.createElement('div')
        this.props.container.id = this.props.id
        this.props.container.style = 'display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;'
        this.props.canvas = document.createElement('canvas')
        this.props.container.insertAdjacentElement('beforeend', this.props.canvas)
        this.props.container.style = `width: 100%; height: 100%;`
        this.props.container.onresize = this.responsive

        this.ports = {
            draw: {
                input: {type: Object},
                output: {type: null},
                onUpdate: (user) => {
                    if (user.data.function instanceof Function) this.props.drawObjects.push(user.data)
                }
            },
            element: {
                data: this.props.container,
                input: {type: null},
                output: {type: Element},
                onUpdate: () => {
                    this.ports.element.data = this.props.container
                    return {data: this.ports.element.data}
                }
            }
        }
    }

    init = () => {

        this.props.context = this.props.canvas.getContext("2d");

        // Set Default Port Output
        this.ports.element.data = this.props.container

        // Set Looping
        this.props.looping = true

        const animate = () => {

            if (this.props.looping){
                this._clearCanvas()

                // Manage Draw Objects
                for (let i = this.props.drawObjects.length - 1; i >= 0; i--){
                    let o = this.props.drawObjects[i]
                    if (o.active) o.function(this.props.context)
                    else this.props.drawObjects.splice(i,1)
                }
                setTimeout(animate, 1000/60)
            }
        }
        animate()
    }

    deinit = () => {
        this.props.looping = false
        this.props.container.remove()
    }

    responsive = () => {
        this.props.canvas.width = this.props.container.offsetWidth
        this.props.canvas.height = this.props.container.offsetHeight
    }

    _clearCanvas = () => {
        this.props.context.fillStyle = 'black';
        this.props.context.stokeStyle = 'white';
        this.props.context.fillRect(0, 0, this.props.canvas.width, this.props.canvas.height)
        this.props.context.strokeRect(0, 0, this.props.canvas.width, this.props.canvas.height)
    }
}