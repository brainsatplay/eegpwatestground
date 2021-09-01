
import featureImg from './img/feature.png'
import * as brainsatplay from '../../../libraries/js/brainsatplay'
import {Blob} from './Blob'

export const settings = {
    "name": "Blob",
    "author": "Garrett Flynn",
    "devices": ["EEG","HEG"],
    "description": "Calm the blob!",
    "categories": ["train"],
    "image":  featureImg,
    "instructions":"Coming soon...",

    // Based on Neurofeedback Template
    graph: {
        nodes: [
            {id: 'eeg', class: brainsatplay.plugins.biosignals.EEG},
            {id: 'neurofeedback', class: brainsatplay.plugins.algorithms.Neurofeedback, params: {}},
            {id: 'blob', class: Blob, params: {}},
            {id: 'ui', class: brainsatplay.plugins.interfaces.UI, params: {
                html: `
                    <div id="content"></div>
                    <div id="selector"></div>
                `,
                style: `
                .brainsatplay-ui-container {
                    width: 100%;
                    height: 100%;
                    position: relative;
                }
        
                #content {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                #selector {
                    position: absolute;
                    top: 25px;
                    left: 25px;
                }
                `
                }
            },
          ],
    
          edges: [
            {
              source: 'eeg:atlas', 
              target: 'neurofeedback' //sends user obj
            },
            { 
              source: 'neurofeedback', 
              target: 'blob'           //changes blob noise
            },
            {
              source: 'blob:element', 
              target: 'ui:content'  //updates on UI
            },
            {
                source: 'neurofeedback:element', //updates the target of the protocol selector on state change
                target: 'ui:selector'
              },
          ]
    }
}