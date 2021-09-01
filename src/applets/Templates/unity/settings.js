import * as brainsatplay from '../../../libraries/js/brainsatplay'
import {Unity} from './unityUtils/Unity'


// MUST IMPORT ALL THE FILES FROM BUILD AND TEMPLATEDATA
// import * as webbuild from './webbuild.loader' // Loader may be univeral

export const settings = {
    name: "Unity Template",
    devices: ["EEG", "HEG"],
    author: "Juris Zebneckis",
    description: "",
    categories: ["WIP"],
    instructions:"",
    display: {
      production: false,
      development: true
    },
    
    // App Logic
    graph:
    {
      nodes: [
        {id:'eeg', class: brainsatplay.plugins.biosignals.EEG},
        {id:'neurofeedback', class: brainsatplay.plugins.algorithms.Neurofeedback},
        {
          id:'unity', 
          class: Unity, 
          params:{
              commands: [{
                object: 'System',
                function: 'updateData',
                type: 'number'
              }, {
                object: 'System',
                function: 'updateBlink', // or just blink
                type: 'boolean'
              }]
          }
        },
        {
          id:'ui', 
          class: brainsatplay.plugins.interfaces.UI
        }
    ],

      edges: [
        {
          source: 'eeg:atlas',
          target: 'neurofeedback',
        },
        {
          source: 'neurofeedback',
          target: 'unity:updateData',
        },
        {
          source: 'unity:element',
          target: 'ui:content',
        }
      ]
    },
}