import {SmoothieChartMaker} from '../../ui/eegvisuals'
import {uPlotMaker} from '../../ui/eegvisuals'
import uPlot from 'uplot'

export class TimeSeries{

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
        this.props.canvas.width = '100%'
        this.props.canvas.height = '100%'
        this.props.canvas.style.width = '100%'
        this.props.canvas.style.height = '100%'

        this.ports = {
            style: {
                data: 'Smoothie',
                options: [
                    'Smoothie',
                    // 'uPlot'
                ],
                input: {type: null},
                output: {type: null},
                onUpdate: () => {
                    switch (this.ports.style.data){
                        case 'Smoothie':
                            this.props.helper = new SmoothieChartMaker(1, this.props.canvas);
                            break
                        case 'uPlot':
                            this.props.helper = new uPlotMaker(this.props.canvas);
                            this.props.helper.uPlotData = [[],[]]

                            this.props.helper.makeuPlot(
                                [{label: 'time'}, {label: 'label'}], 
                                this.props.helper.uPlotData, 
                                this.props.canvas?.parentNode?.width, 
                                this.props.canvas?.parentNode?.height
                            );
                            break
                    }
                    this.props.helper.init();

                }
            },
            data: {
                edit: false,
                input: {type: 'number'},
                output: {type: null},
                onUpdate: (user) => {
                    let data = []
                    switch (this.ports.style.data){
                        case 'Smoothie':
                            data = [user.data]
                            this.props.helper.bulkAppend(data)
                            break
                        case 'uPlot':
                            data = [Date.now(), user.data]
                            data.forEach((val,i) => {this.props.helper.uPlotData.push(val)})
                            if (this.props.helper.plot) this.props.helper.plot.setData(this.props.helper.uPlotData);
                            break
                    }
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
        this.session.graph.runSafe(this,'style', {forceRun: true})
    }

    deinit = () => {
        this.props.canvas.remove()
        if (this.props.helper == null){
            this.props.helper.deInit();
            this.props.helper = null;
        }
    }

    responsive = () => {
    }
}