import {brainsatplay} from './js/brainsatplay'
import {uPlotApplet} from './js/applets/General/uPlotApplet'

let plotter = new uPlotApplet(
    document.body,
    new brainsatplay()
)


//Now add some ui elements like to connect to the device

plotter.bci.makeConnectOptions(documet.body,()=> { plotter.responsive(); });

//Init applet

plotter.init();


//That's all folks
