
import * as brainsatplay from '../../../libraries/js/brainsatplay'
import {Manager} from './Manager'

export const settings = {
    name: "ERP Template",
    devices: ["EEG"],
    author: "Garrett Flynn",
    description: "Recognize event-related potentials on the browser",
    categories: ["learn"],
    instructions:"Coming soon...",
    display: {
      production: false,
      development: true
    },

    // intro: {
    //   title:false
    // },

    // App Logic
    graph:
    {
      nodes: [
        {id: 'eeg', class: brainsatplay.plugins.biosignals.EEG},
        {id: 'manager', class: Manager, params: {}},
      ],

      edges: [
        {
          source: 'eeg:atlas', 
          target: 'manager:data'
        },
      ]
    },
}