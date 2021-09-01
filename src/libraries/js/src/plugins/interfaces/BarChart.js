import {eegBarChart} from '../../ui/eegvisuals'

export class BarChart{

    static id = String(Math.floor(Math.random()*1000000))
    
    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        

        this.props = {
            id: String(Math.floor(Math.random() * 1000000)),
            canvas: document.createElement('canvas'),
            helper: null,
            looping: false
        }

        this.props.canvas.onresize = this.responsive

        this.ports = {
            data: {
                edit: false,
                input: {type: Object},
                output: {type: null},
                onUpdate: (user) => {
                    if (Array.isArray(user.data)) if (user.data.length > 15) this.props.helper.showvalues = false
                    this.props.helper.setData(user.data)
                    this.props.helper.draw();
                }
            },
            element: {
                data: this.props.canvas,
                input: {type: null},
                output: {type: Element}
            }
        }
    }

    init = () => {
        this.props.helper = new eegBarChart(this.props.canvas);
        this.props.helper.init();
    }

    deinit = () => {
        this.props.canvas.remove()
        this.props.helper.deInit();
        this.props.helper = null;
    }

    responsive = () => {

        // Resize to parent
        if (this.props.helper){
            this.props.helper.canvas.width = this.props.helper.canvas.parentNode.clientWidth;
            this.props.helper.canvas.height = this.props.helper.canvas.parentNode.clientHeight;
            this.props.helper.canvas.style.width = this.props.helper.canvas.parentNode.clientWidth;
            this.props.helper.canvas.style.height = this.props.helper.canvas.parentNode.clientHeight;
            // this.props.helper.init();
            this.props.helper.draw();
        }
    }
}