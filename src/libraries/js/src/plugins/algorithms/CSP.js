import bci from 'bcijs/browser.js'
import {eegmath} from '../../utils/eegmath';

export class CSP{

    static id = String(Math.floor(Math.random()*1000000))
    static hidden = true

    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        
        
        this.props = {
            model: null,
            id: String(Math.floor(Math.random() * 1000000)),            
            bci: bci,
        }

        this.ports = {
            train: {
                input: {type: Object},
                output: {type: null},
                onUpdate: (user) => {
                    let data = user.data
                    let keys = Object.keys(data)
                    this.props.model = this.props.bci.cspLearn(data[keys[0]], data[keys[1]]);
                }
            },
            features: {
                input: {type: Array},
                output: {type: Array},
                onUpdate: (user) => {
                    return eegmath.transpose([this._computeFeatures(this.props.model, user.data)])
                }
            }
        }
    }

    init = () => {}

    deinit = () => {}

    _computeFeatures(cspParams, trial){
        let epochSize = 64; // About a fourth of a second per feature
    
        // Bandpass filter the trial
        let channels = this.props.bci.transpose(trial);
        
        // channels = channels.map(signal => this.props.filter.simulate(signal).slice(this.props.filterOrder));
        trial = this.props.bci.transpose(channels);

        // Apply CSP over each 64 sample window with a 50% overlap between windows
        let features = this.props.bci.windowApply(trial, epoch => {
            // Project the data with CSP and select the 16 most relevant signals
            let cspSignals = this.props.bci.cspProject(cspParams, epoch, 16);
            // Use the log of the variance of each signal as a feature vector
            return this.props.bci.features.logvar(cspSignals, 'columns');
        }, epochSize, epochSize / 2);
    
        // Concat the features from each trial
        return [].concat(...features);
    }
}