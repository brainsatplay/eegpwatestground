// import '../../../libraries/js/src/ui/plotly.min.js'

// import 'https://cdn.plot.ly/plotly-2.0.0.min.js'

//*** This code is copyright 2002-2016 by Gavin Kistner, !@phrogz.net
//*** It is covered under the license viewable at http://phrogz.net/JS/_ReuseLicense.txt
Date.prototype.customFormat = function(formatString){
    var YYYY,YY,MMMM,MMM,MM,M,DDDD,DDD,DD,D,hhhh,hhh,hh,h,mm,m,SS,S,ss,s,ampm,AMPM,dMod,th;
    YY = ((YYYY=this.getFullYear())+"").slice(-2);
    MM = (M=this.getMonth()+1)<10?('0'+M):M;
    MMM = (MMMM=["January","February","March","April","May","June","July","August","September","October","November","December"][M-1]).substring(0,3);
    DD = (D=this.getDate())<10?('0'+D):D;
    DDD = (DDDD=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][this.getDay()]).substring(0,3);
    th=(D>=10&&D<=20)?'th':((dMod=D%10)==1)?'st':(dMod==2)?'nd':(dMod==3)?'rd':'th';
    formatString = formatString.replace("#YYYY#",YYYY).replace("#YY#",YY).replace("#MMMM#",MMMM).replace("#MMM#",MMM).replace("#MM#",MM).replace("#M#",M).replace("#DDDD#",DDDD).replace("#DDD#",DDD).replace("#DD#",DD).replace("#D#",D).replace("#th#",th);
    h=(hhh=this.getHours());
    if (h==0) h=24;
    if (h>12) h-=12;
    hh = h<10?('0'+h):h;
    hhhh = hhh<10?('0'+hhh):hhh;
    AMPM=(ampm=hhh<12?'am':'pm').toUpperCase();
    mm=(m=this.getMinutes())<10?('0'+m):m;
    SS=(S=this.getSeconds())<10?('0'+S):S;
    ss=(s=this.getMilliseconds())<10?('0'+s):s;
    return formatString.replace("#hhhh#",hhhh).replace("#hhh#",hhh).replace("#hh#",hh).replace("#h#",h).replace("#mm#",mm).replace("#m#",m).replace("#SS#",SS).replace("#S#",S).replace("#ss#",ss).replace("#s#",s).replace("#ampm#",ampm).replace("#AMPM#",AMPM);
  };

class Plot{

    static id = String(Math.floor(Math.random()*1000000))
    static hidden = true

    constructor(label, session, params={}) {

        // Generic Plugin Attributes
        this.label = label
        this.session = session

        this.dependencies = ['https://cdn.plot.ly/plotly-2.0.0.min.js']

        // UI Identifier
        this.props = {
            id: String(Math.floor(Math.random()*1000000)),
            container: null,
            plotConfig: {responsive: true},
            plotLayout: {
                xaxis: {
                  autorange: true,
                  rangeselector: {buttons: [
                      {step: 'all'}
                    ]},
                  rangeslider: {},
                //   type: 'time',
                  rangemode: 'nonnegative'
                },
                yaxis: {
                  autorange: true,
                  type: 'linear'
                }
            },
            userData: []
        }

        // Port Definition
        this.ports = {
            default: {
                input: {type: Object},
                output: {type: null},
                onUpdate: () => {
                    console.log('updated')
                }
            },
            mode: {data: 'Channels', options: ['Channels','Trials']},
            data: {data: []},
            type: {data: 'line', options: ['line','bar']}
        }

        // if (this.ports.title.data !== false){
        //     this.props.plotLayout.title = this.ports.title.data ?? 'Your Data'
        //     this.props.plotLayout.margin = {
        //         l: 50,
        //         r: 50,
        //         b: 25,
        //         t: 75,
        //         pad: 4
        //     }
        // } else {
            this.props.plotLayout.margin = {
                l: 50,
                r: 50,
                b: 25,
                t: 25,
                pad: 4
            }
        // }

    }

    init = () => {


        let display = ("show" in this.states) ? 'none' : 'block'

        let HTMLtemplate = () => {
            return `
            <div id='${this.props.id}' style='display: ${display}; width: 100%; height: 100%; opacity: 0; transition: opacity 1s;'>
            </div>`
        }

        let setupHTML = () => {
            this.props.container = document.getElementById(`${this.props.id}`)
            Plotly.newPlot( this.props.container, [{
            x: [],
            y: [] }], 
            this.props.plotLayout, 
            this.props.plotConfig);

            // Animation Loop
            let prevState = this.ports.mode.data
            let animate = () => {
                if (this.ports.mode.data != prevState){
                    Plotly.purge(this.props.container)
                    this.session.graph.runSafe(this,'default',this.props.userData)
                    prevState = this.ports.mode.data
                }
                setTimeout(animate, 1000/2)
            }
            animate()
        }

        return {HTMLtemplate, setupHTML}
    }

    responsive = () => {
    }

    show = (user) => {
        let show = user.data
        if (show) this.props.container.style.display = 'flex'
        return {data: true, meta: {label: `${this.label}_show`, params: {mode: 'Manual', trialProgression: null, trialTypes: ['Blink Left', 'Blink Right', 'Blink Both']}}}
    }

    default = (user) => {
        this.props.userData = user
        let data = ('data' in user.data) ? user.data.data : user.data
        let query

        let restrictedStates = ['notes','times', 'noteTimes', 'noteIndices', 'fftTimes', 'fftFreqs']
        let states = (this.ports.data.data.length > 0) ? this.ports.data.data : Object.keys(data).filter(s => !restrictedStates.includes(s))

        let traces = []
        // Declare Points for Text
        // let trace2 = {
        //     x: [],
        //     y: [],
        //     mode: 'text',
        //     text: [],
        //     name: 'Trial Type',
        //     yref: 'paper',
        //     textfont: {
        //         color: 'black',
        //         size: 15,
        //         family: 'Montserrat'
        //     }
        // };
        let timeVariables = [data.noteTimes, data.times]

        timeVariables = timeVariables.map(arr => {
            return arr.map(t => {
                if (typeof t === 'number'){
                    var date = new Date(t); // create Date object
                    return date.customFormat( "#YYYY#-#MM#-#DD# #hh#:#mm#:#SS#.#ss#" ) //`${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}.${ss}`
                }
            })
        })
        data.noteTimes = timeVariables[0]
        data.times = timeVariables[1]

        let shapes = []

        let getTrialInfo = (data) => {
            let trials = []
            let done = false
            data.notes.forEach((n,i) => {
                if (n.includes('scheduler') && !done){

                    if (trials.length > 0 && (n.includes('ITI') || n.includes('Done'))){
                        trials[trials.length - 1].end.time = data.noteTimes[i]
                        trials[trials.length - 1].end.idx = data.noteIndices[i]
                        if (n.includes('Done')) done = true
                    } else if (!n.includes('ITI') && !n.includes('Done')){
                        trials.push({label: n.replace('scheduler ', ''), start: {
                            time: data.noteTimes[i],
                            idx: data.noteIndices[i]
                        }, end: {}})
                    }
                }
            })

            trials = trials.filter(t => Object.keys(t.end).length > 0) // Remove incomplete trials
            return trials
        }

        let trials = getTrialInfo(data)

        // Use EEG Channels or Trials
        if (this.ports.mode.data === 'Trials'){
            let s = states[0]
            let stateData = data[s]

            let extractTrialsFromData = (data, time, trialInfo) => {
                return trialInfo.map(o => {
                    return {label: o.label, data: data.slice(o.start.idx,o.end.idx+1), time: time.slice(o.start.idx,o.end.idx+1)}
                })
            }

            let timestamps = this._getTimestamps(data,s)
            trials = extractTrialsFromData(stateData, timestamps, trials)
        }

        if (this.ports.mode.data === 'Trials'){
            trials.forEach((trial,i) => {
                traces.push({
                    x: trial.time.map(t => t - trial.time[0]),
                    y: trial.data,
                    // xaxis: `x${i+1}`,
                    // yaxis: `y${i+1}`,
                    type: this.ports.type.data,
                    name: `Trial ${i} | ${trial.label}`
                })
            })
        } else {

            states.forEach((s,i) => {
                let dataset = data[s].data ?? data[s]
                let timestamps = this._getTimestamps(data,s)

                traces.push({
                    x: timestamps,
                    y: dataset,
                    // xaxis: `x${i+1}`,
                    // yaxis: `y${i+1}`,
                    type: this.ports.type.data,
                    name: s.replace(query,'')
                })
            })

            trials.forEach(event => {
                shapes.push({
                    type: 'rect',
                    xref: 'x',
                    yref: 'paper',
                    x0: event.start.time,
                    y0: 0,
                    x1: event.end.time,
                    y1: 1,
                    fillcolor: '#a3a3a3',
                    opacity: 0.2,
                    line: {
                        width: 0
                    }
                })
            })
        }

        let layoutConfig
        if (this.ports.mode.data === 'Trials'){
            // this.props.plotLayout.grid = {
            //     rows: trials.length,
            //     columns: 1,
            //     pattern: 'coupled',
            //     roworder: 'bottom to top'
            // }

        } else {
            layoutConfig = Object.assign(this.props.plotLayout, {shapes})
            // this.props.plotLayout.shapes = shapes
        }

        // traces.push(trace2)

        Plotly.react( this.props.container, traces, 
            layoutConfig, 
        this.props.plotConfig );

        this.props.container.style.opacity = 1

        return user
    }

    deinit = () => {}

    _getTimestamps  = (data, state) => {
        let timestamps = data[state].times ?? data.times
        let tStart = timestamps[0]
        if (typeof tStart === 'number') timestamps = timestamps.map(t => t - tStart)
        return timestamps
    }
}

export {Plot}