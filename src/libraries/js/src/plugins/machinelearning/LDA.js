import bci from 'bcijs/browser.js'
import {eegmath} from '../../utils/eegmath';

export class LDA{

    static id = String(Math.floor(Math.random()*1000000))
    static hidden = true

    constructor(label, session, params={}) {
        this.label = label
        this.session = session

        this.ports = {
            threshold: {data: 0.1, min: 0, max: 1, step: 0.01},

            train: {
                input: {type: undefined},
                output: {type: 'number'},
                onUpdate: (user) => {
                    let trialsAggregated = this._preprocess(user)
        
                        let types = Object.keys(trialsAggregated)

                        // Project it with CSP
                        let data1 = trialsAggregated[types[0]].data
                        let length1 = data1[0].length
                        let data2 = trialsAggregated[types[1]].data
                        let length2 = data2[0].length
                        let maxLength = Math.min(length1,length2)
                        let bothData = [data1,data2]
                        bothData.forEach(d => {
                            d = d.forEach(a => {
                                if (a.length > maxLength){
                                    a.splice(maxLength) // Remove extra data
                                }
                            })
                        })

                        data1 = eegmath.transpose(data1)
                        data2 = eegmath.transpose(data2)

                        // Split Training and Test Set
                        let partitions1 = this.props.bci.partition(data1, 0.75, 0.25)
                        let partitions2 = this.props.bci.partition(data2, 0.75, 0.25)

                        this.props.models.csp = this.props.bci.cspLearn(partitions1[0], partitions2[0]);
                
                        // Compute training data features
                        let featuresData1Training = eegmath.transpose([this._computeTrialFeatures(this.props.models.csp, partitions1[0])]);
                        let featuresData2Training = eegmath.transpose([this._computeTrialFeatures(this.props.models.csp, partitions2[0])]);
                
                        // Learn an LDA classifier
                        this.props.models.lda = this.props.bci.ldaLearn(featuresData1Training, featuresData2Training);
                        this.session.graph.runSafe(this,'test', {data: [partitions1[1], partitions2[1]]})
                    return user
                }
            },
            test: {
                input: {type: Array},
                output: {type: 'number'},

                // Pass correctly-formatted test data (from train...)
                onUpdate: (user) => {
                    // Compute testing data features
                    let featuresFeetTesting = eegmath.transpose([this._computeTrialFeatures(this.props.models.csp, user.data[0])]);
                    let featuresRightTesting = eegmath.transpose([this._computeTrialFeatures(this.props.models.csp, user.data[1])]);
            
                    // Classify testing data
            
                    let feetPredictions = featuresFeetTesting.map(this._classify).filter(value => value != -1);
                    let rightPredictions = featuresRightTesting.map(this._classify).filter(value => value != -1);
            
                    // Evaluate the classifer
                    let feetActual = new Array(feetPredictions.length).fill(0);
                    let rightActual = new Array(rightPredictions.length).fill(1);
            
                    let predictions = feetPredictions.concat(rightPredictions);
                    let actual = feetActual.concat(rightActual);
            
                    let confusionMatrix = this.props.bci.confusionMatrix(predictions, actual);
            
                    let bac = this.props.bci.balancedAccuracy(confusionMatrix);
            
                    console.log('confusion matrix');
                    console.log(this.props.bci.toTable(confusionMatrix));
                    console.log('balanced accuracy');
                    console.log(bac);
                    return {data: bac}
                }
            },
            predict: {
                input: {type: Array},
                output: {type: 'int'},
                onUpdate: (user) => {
                    if (this.props.models.csp){
                        let features = eegmath.transpose([this._computeTrialFeatures(this.props.models.csp, user.data)]);
                        let predictions = features.map(this._classify).filter(value => value != -1);
                        user.data = eegmath.mode(predictions)
                    } else console.error('model not trained')
                }

            }
        }

        this.props = {
            id: String(Math.floor(Math.random() * 1000000)),            
            bci: bci,
            models: {
                csp: null,
                lda: null
            }
        }
    }

    init = () => {}

    deinit = () => {}

    _classify = (feature) => {
        let projection = this.props.bci.ldaProject(this.props.models.lda, feature);
        // Filter out values between -0.5 and 0.5 as unknown classes
        if(projection < this.ports.threshold.data) return 0;
        if(projection > this.ports.threshold.data) return 1;
        return -1;
    }

    _computeTrialFeatures(cspParams, trial){
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

    _preprocess = (user) => {
        let trialsAggregated = {}

        // Get Trials for Each User

            // Get Trial Information
            let getTrialInfo = (data) => {
                let trials = []
                let done = false
                data.notes.forEach((n,i) => {
                    if (n.includes('scheduler') && !done){
                        if (trials.length > 0 && (n.includes('ITI') || n.includes('Done'))){
                            trials[trials.length - 1].end.time = data.noteTimes[i] - data.times[0], // Subtract beginning time
                            trials[trials.length - 1].end.idx = data.noteIndices[i]
                            if (n.includes('Done')) done = true
                        } else if (!n.includes('ITI') && !n.includes('Done')){
                            trials.push({label: n.replace('scheduler ', ''), start: {
                                time: data.noteTimes[i] - data.times[0], // Subtract beginning time
                                idx: data.noteIndices[i]
                            }, end: {}})
                        }
                    }
                })
                return trials
            }

            let trials = getTrialInfo(user.data.data)

            // Aggregate Trial Label + All Channel Data Together
            let extractTrialsFromData = (data, time, trialInfo) => {
                return trialInfo.map(o => {
                    return {label: o.label, data: data.slice(o.start.idx,o.end.idx+1), time: time.slice(o.start.idx,o.end.idx+1)}
                })
            }

            for (let key in user.data.data){
                if (key.includes('_signal')){
                    let trialData = extractTrialsFromData(user.data.data[key], user.data.data.times, trials)
                    trialData.forEach((o,i) => {
                        if (o.label != ''){ // Remove empty labels
                            if (trialsAggregated[o.label] == null) trialsAggregated[o.label] = {data: [], time: [], dataLabels: []}
                            let channelIdx = trialsAggregated[o.label].dataLabels.indexOf(key)
                            if (channelIdx == -1) {
                                trialsAggregated[o.label].data.push([])
                                trialsAggregated[o.label].dataLabels.push(key)
                                channelIdx = trialsAggregated[o.label].data.length - 1
                            }
                            trialsAggregated[o.label].data[channelIdx].push(...o.data)
                            if (channelIdx == 0) trialsAggregated[o.label].time.push(...o.time)
                        }
                    })
                }
            }
        return trialsAggregated
    }
}