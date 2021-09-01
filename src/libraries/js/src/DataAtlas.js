//relies on eegworker (see implementation in public/index.html)
//Joshua Brewster, Garrett Flynn GPL (copyleft)

import { StateManager } from "./ui/StateManager";

import { WorkerManager } from "./Workers"
import { GraphManager } from "./GraphManager"

import { Blink } from "./plugins/models/Blink"
import {DOMFragment} from './ui/DOMFragment'

//-------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------

export class DataAtlas {
	/**
     * @constructor
	 * @alias DataAtlas
     * @description Class for organizing data and automating analysis protocols.
     */

    constructor(
		name="atlas",
		initialData={eegshared:{eegChannelTags:[{ch: 0, tag: 'FP1', analyze:true},{ch: 1, tag: 'FP2', analyze:true}],sps:512}},
		config='10_20', //'muse','big'
	) {
        this.name = name;
		this.config = config; 

		if (window.workers == null){
			window.workers = new WorkerManager()
		} else {
			console.log('Workers already created.')
		}

		this.props = {
			id: this._getRandomId()
		}
		

		// Add Blink Detection
		this.graph = new GraphManager({atlas: this})
		let app = {
			props: {
				id: this.props.id
			},
			info: {
				name: 'BlinkDetection', 
				graph: {
					nodes: [
						{id: 'blink', class: Blink},
					],
				}
			}
		}
		this.liveGraph = this.graph.init(app)
		this.graph.start(this.props.id)

		this.liveGraph.nodes.forEach(n => {
			let ui = n.ui
            if (ui){
                n.fragment = new DOMFragment( // Fast HTML rendering container object
                    ui.HTMLtemplate, //Define the html template string or function with properties
                    undefined,    //Define where to append to (use the parentNode)
                    undefined,         //Reference to the HTML render properties (optional)
                    ui.setupHTML,          //The setup functions for buttons and other onclick/onchange/etc functions which won't work inline in the template string
                    undefined,          //Can have an onchange function fire when properties change
                    "NEVER",             //Changes to props or the template string will automatically rerender the html template if "NEVER" is changed to "FRAMERATE" or another value, otherwise the UI manager handles resizing and reinits when new apps are added/destroyed
                    undefined, // deinit
                    ui.responsive // responsive
                )
            }
		})

		let analysisDict = {
			eegcoherence: false,
			eegfft: false
		}

		this.state = new StateManager({
			deviceConnected: false,
			// analyzing: false,
			analysis: analysisDict, // {eegfft: true}
			runAnalysisLoop:true,
			heg:false,
			eeg:false,
			coherence:false,
			eyetracker:false,
			accelerometer:false,
			hrv:false,
			fnirs:false,
			ecg:false,
			spo2:false,
			emg:false
		})
		this.settings = this.state.data;
		//to subscribe use let sub = this.state.subscribe('deviceConnected',(status) => {});

        this.data = {
			eegshared:{
				eegChannelTags:[], 
				sps:1, 
				startTime:0,
				frequencies:[], 
				bandFreqs:{scp:[[],[]], delta:[[],[]], theta:[[],[]], alpha1:[[],[]], alpha2:[[],[]], beta:[[],[]], lowgamma:[[],[]], highgamma:[[],[]]}
			},
			eeg:[],
			coherence:[],
			heg:[],
			fnirs:[],
			accelerometer:[],
			hrv:[],
			spo2:[],
			emg:[],
			ecg:[],
			eyetracker:[],
			other:{notes:[],games:{}},
			states: {} // Dynamically assigned discrete and continuous events (in Event Router)
		};

        Object.assign(this.data,initialData);

		this.rolloverLimit = 2001*6*5; //Max samples allowed in arrays before rollover kicks in (5min of data for FreeEEG32, 10min for Muse, etc)

		// Enforce uppercase
		if(!Array.isArray(this.data.eegshared.eegChannelTags)) {
			let slice;
			if (typeof this.data.eegshared.eegChannelTags === "string") slice = parseInt(this.data.eegshared.eegChannelTags) 
			else slice = this.data.eegshared.eegChannelTags
			this.data.eegshared.eegChannelTags = ["FP1","FP2","FZ","F3","F4","F7","F8","CZ","C3","C4","T3","T4","T5","T6","PZ","P3","P4","O1","O2"].slice(0,slice)
			this.data.eegshared.eegChannelTags = this.data.eegshared.eegChannelTags.map((t,i) => {
				return {ch:i,tag:t,analyze: true}
			})
		}

		// Create EEG Map
        if(config === '10_20') {
			this.settings.eeg = true;
			this.data.eeg = this.gen10_20Atlas(this.data.eegshared.eegChannelTags);
        }
		else if (config.includes('muse')) {
			this.settings.eeg = true;
			let aux = config.includes('_Aux')
			this.data.eeg = this.genMuseAtlas(aux);
		}
		else if (config === 'big') {
			this.settings.eeg = true;
			this.data.eeg = this.gen10_20Atlas();
		}
		else if (config === 'hegduino') {
			this.addHEGCoord(this.data.heg.length,0,60,60);
			this.settings.heg = true;
		}
		else if (config === 'eyetracker') {
			this.settings.eyetracker = true;
			this.addEyeTracker(this.data.eyetracker.length);
		}

		if (this.settings.eeg){
			this.data.coherence = this.genCoherenceMap(this.data.eegshared.eegChannelTags);
		}

		if(this.data.eegshared.eegChannelTags) { //add structs for non-specified channels
			this.data.eegshared.eegChannelTags.forEach((row,i) => {
				if( this.getEEGDataByTag(row.tag) === undefined ) {
					this.addEEGCoord(row.ch);
				}
			});
		}

		if(this.data.eegshared.sps) {
			this.data.eegshared.frequencies = this.bandpassWindow(0,128,this.data.eegshared.sps*0.5);
			this.data.eegshared.bandFreqs = this.getBandFreqs(this.data.eegshared.frequencies);
			//console.log(this.data.eegshared.bandFreqs)
		}
		
		this.analyzerOpts = []; //'eegfft','eegcoherence','bcijs_bandpower','bcijs_pca','heg_pulse'
		this.analyzerFuncs = [];
		this.workerPostTime = 0;
		this.workerWaiting = false;
		this.workerId = 0;

		this.addDefaultAnalyzerFuncs();

		if(!window.workers.workerResponses) { window.workers.workerResponses = []; } //placeholder till we can get webworkers working outside of the index.html
		this.workerId = window.workers.addWorker(); // add a worker for this DataAtlas analyzer instance
		window.workers.workerResponses.push(this.workeronmessage);
		//this.analyzer();
    }

	deinit = () => {
		this.settings.runAnalysisLoop = false;
		window.workers.terminate(this.workerId);
		this.graph.remove(this.props.id)
	}

	_getRandomId = () => {
		return String(Math.floor(Math.random()*1000000))
	}

    genEEGCoordinateStruct(tag,x=0,y=0,z=0){
        let bands = {scp:[],delta:[],theta:[],alpha1:[],alpha2:[],beta:[],lowgamma:[],highgamma:[]} 
        let struct = {
            tag:tag, 
            position:{x:x,y:y,z:z}, 
            count:0,
            times:[], 
            raw:[], 
            filtered:[], 
			fftCount:0,
			fftTimes:[], //Separate timing for ffts on workers
            ffts:[], 
            slices:JSON.parse(JSON.stringify(bands)), 
            means:JSON.parse(JSON.stringify(bands)),
			lastReadFFT:0, // counter value when this struct was last read from (using get functions)
			lastRead:0
		};
        return struct;
    }
    
    addEEGCoord(tag,x=999,y=999,z=999){
		this.data.eeg.push(this.genEEGCoordinateStruct(tag,x,y,z));
	}

	genMuseAtlas(aux=false) { //Muse coordinates (estimated)

		let eegmap = [];

		let c = [[-21.5,70.2,-0.1],[28.4,69.1,-0.4],[-54.8,33.9,-3.5],
		[56.6,30.8,-4.1]]; //FP1, FP2, F7, F8

		function mid(arr1,arr2) { //midpoint
			let midpoint = [];
			arr1.forEach((el,i) => {
				midpoint.push(0.5*(el+arr2[i]));
			});
			return midpoint;
		}

		let tags = ['AF7','AF8','TP9','TP10'];
		if (aux) tags.push('AUX')
		let coords = [
			mid(c[0],c[2]), //estimated
			mid(c[1],c[3]), //estimated
			[-80.2,-31.3,-10.7], //estimated
			[81.9,-34.2,-8.2], //estimated
			[NaN,NaN,NaN]
		];

		tags.forEach((tag,i) => {
            eegmap.push(this.genEEGCoordinateStruct(tag,coords[i][0],coords[i][1],coords[i][2]));
        });

        return eegmap;
	}

	gen10_20Atlas(channelDicts) {

		const eegCoordinates = {

			FP1: [-21.2, 66.9, 12.1],
			FPZ: [1.4, 65.1, 11.3],
			FP2: [24.3, 66.3, 12.5],
			AF7: [-41.7, 52.8, 11.3],
			AF3: [-32.7, 48.4, 32.8],
			AFZ: [1.8, 54.8, 37.9],
			AF4: [35.1, 50.1, 31.1],
			AF8: [43.9, 52.7, 9.3],
			F5: [-51.4, 26.7, 24.7],
			F3: [-39.7, 25.3, 44.7],
			F1: [-22.1, 26.8, 54.9],
			FZ: [0.0, 26.8, 60.6],
			F2: [23.6, 28.2, 55.6],
			F4: [41.9, 27.5, 43.9],
			F6: [52.9, 28.7, 25.2],
			F7: [-52.1, 28.6, 3.8],
			F8: [53.2, 28.4, 3.1],
			FC5: [-59.1, 3.0, 26.1],
			FC3: [-45.5, 2.4, 51.3],
			FC1: [-24.7, 0.3, 66.4],
			FCZ: [1.0, 1.0, 72.8],
			FC2: [26.1, 3.2, 66.0],
			FC4: [47.5, 4.6, 49.7,],
			FC6: [60.5, 4.9, 25.5],
			FT9: [-53.8, -2.1, -29.1],
			FT7: [-59.2, 3.4, -2.1],
			FT8: [60.2, 4.7, -2.8],
			FT10: [55.0, -3.6, -31.0],
			T7: [-65.8, -17.8, -2.9],
			T5: [-61.5, -65.3, 1.1],
			T3: [-70.2, -21.3, -10.7],
			T4: [71.9,-25.2,-8.2],
			T6: [59.3, -67.6,  3.8],
			T8: [67.4, -18.5, -3.4],
			C5: [-63.6, -18.9, 25.8],
			C3: [-49.1, -20.7, 53.2],
			C1: [-25.1, -22.5, 70.1],
			CZ: [0.8, -21.9, 77.4],
			C2: [26.7, -20.9, 69.5],
			C4: [50.3, -18.8, 53.0],
			C6: [65.2, -18.0, 26.4],
			CP5: [-61.8, -46.2, 22.5],
			CP3: [-46.9, -47.7, 49.7],
			CP1: [-24.0, -49.1, 66.1],
			CPZ: [0.7, -47.9, 72.6],
			CP2: [25.8, -47.1, 66.0],
			CP4: [49.5, -45.5, 50.7],
			CP6: [62.9, -44.6, 24.4],
			TP9: [-73.6, -46.7, -4.0], // estimated
			TP7: [-63.6, -44.7, -4.0],
			TP8: [64.6, -45.4, -3.7],		
			TP10: [74.6, -47.4, -3.7], // estimated
			P9: [-50.8, -51.3, -37.7],
			P7: [-55.9, -64.8, 0.0],
			P5: [-52.7, -67.1, 19.9],
			P3: [-41.4, -67.8, 42.4],
			P1: [-21.6, -71.3, 52.6],
			PZ: [0.7, -69.3, 56.9],
			P2: [24.4, -69.9, 53.5],
			P4: [44.2, -65.8, 42.7],
			P6: [54.4, -65.3, 20.2],
			P8: [56.4, -64.4, 0.1],
			P10: [51.0, -53.9, -36.5],
			PO7: [-44.0, -81.7, 1.6],
			PO3: [-33.3, -84.3, 26.5],
			POZ: [0.0, -87.9, 33.5],
			PO4: [35.2, -82.6, 26.1],
			PO8: [43.3, -82.0, 0.7],
			O1: [-25.8, -93.3, 7.7],
			OZ: [0.3, -97.1, 8.7],
			O2: [25.0, -95.2, 6.2]
		}

		let eegmap = [];
		if (channelDicts == null){
			for(const prop in eegCoordinates) eegmap.push(this.genEEGCoordinateStruct(prop,eegCoordinates[prop][0],eegCoordinates[prop][1],eegCoordinates[prop][2]));
		} else {
			if (Array.isArray(channelDicts)){
				channelDicts.forEach(channelDict => {
					let tag = channelDict.tag
					if(eegCoordinates[tag]) eegmap.push(this.genEEGCoordinateStruct(tag,eegCoordinates[tag][0],eegCoordinates[tag][1],eegCoordinates[tag][2]))
					else eegmap.push(this.genEEGCoordinateStruct(tag,NaN,NaN,NaN))
				});
			}
		}
		return eegmap;
	}

	genCoherenceStruct(tag0,tag1,coord0,coord1) {
		var bandFreqs = {scp: [], delta: [], theta: [], alpha1: [], alpha2: [], beta: [], lowgamma: [], highgamma: []};
		
		return {
			tag: tag0+"::"+tag1,
			x0: coord0?.x,
			y0: coord0?.y,
			z0: coord0?.z,
			x1: coord1?.x,
			y1: coord1?.y,
			z1: coord1?.z,
			fftCount: 0,
			fftTimes:[],
			ffts:[],
			slices: JSON.parse(JSON.stringify(bandFreqs)),
			means: JSON.parse(JSON.stringify(bandFreqs)),  // counter value when this struct was last read from (for using get functions)
			lastRead:0
		}
	}

    genCoherenceMap(channelTags = this.data.eegshared.eegChannelTags, taggedOnly = true) {
		var cmap = [];
		var l = 1, k = 0;

		for( var i = 0; i < (channelTags.length*(channelTags.length + 1)/2)-channelTags.length; i++){
			if(taggedOnly === false || (taggedOnly === true && ((channelTags[k].tag !== null && channelTags[k+l].tag !== null)&&(channelTags[k].tag !== 'other' && channelTags[k+l].tag !== 'other')&&(channelTags[k].analyze === true && channelTags[k+l].analyze === true)))) {
				var coord0 = this.getEEGDataByTag(channelTags[k].tag);
				var coord1 = this.getEEGDataByTag(channelTags[k+l].tag);

				cmap.push(this.genCoherenceStruct(channelTags[k].tag,channelTags[k+l].tag,coord0.position,coord1.position))
			}
			l++;
			if (l + k === channelTags.length) {
				k++;
				l = 1;
			}
		}
		//console.log(cmap,channelTags);
		return cmap;
	}

	
	genHEGStruct(tag,x,y,z) {
		return {tag:tag,position:{x:x,y:y,z:z},count:0, times:[],red:[],ir:[],ambient:[],ratio:[],temp:[],beat_detect:{beats:[],breaths:[],rir:[],rir2:[],drir_dt:[],localmins:[],localmaxs:[],val_dists:[],peak_dists:[],localmins2:[],localmaxs2:[],val_dists2:[],peak_dists2:[]},lastRead:0, startTime:0}
	}

	addHEGCoord(tag="heg1",x,y,z) {
		this.data.heg.push(this.genHEGStruct(tag,x,y,z));
	}

	genFNIRSStruct(tag,x,y,z) {
		return {tag:tag,position:{x:x,y:y,z:z},count:0, times:[],red:[],ir:[],ir2:[],ambient:[],lastRead:0}
	}

	addFNIRSCoord(tag="banana1",x,y,z) {
		this.data.fnirs.push(this.genHEGStruct(tag,x,y,z));
	}

	genAccelerometerStruct(tag,x,y,z) {
		return {tag:tag,position:{x:x,y:y,z:z},count:0, times:[],Ax:[],Ay:[],Az:[],Gx:[],Gy:[],Gz:[],lastRead:0, startTime:0};
	}

	addAccelerometerCoord(tag="accel1",x,y,z){
		this.data.accelerometer.push(this.genAccelerometerStruct(tag,x,y,z));
	}

	genHRVStruct(tag){
		return {tag:tag, count:0, times:[], raw:[], filtered:[], bpm:[], hrv:[],lastRead:0, startTime:0};
	}

	addHRV(tag="hrv1") {
		this.data.hrv.push(genHRVStruct(tag));
	}

	genEyeTrackerStruct(tag) {
		return {tag:tag, count:0, times:[], x:[], y:[], smax:[], smay:[], lastRead:0, startTime:0};
	}

	addEyeTracker(tag="eyes") {
		this.data.eyetracker.push(this.genEyeTrackerStruct(tag));
	}

	//also do ecg,emg

	//Makes a note to be saved. Will automatically get the latest timestamp for attached devices if there is one, or just Date.now();
	makeNote(text='event',timestamp=undefined) {
		if(Array.isArray('text')) text = [...text.join('|')];
		let prevNoteIdx = this.data.other.notes.length-1
		if(timestamp === undefined) {
			if (this.settings.deviceConnected){
				if(this.settings.eeg) {
					let row = this.getEEGDataByChannel(this.data.eegshared.eegChannelTags[0].ch);
					timestamp = row.times[row.times.length-1]
					if(this.data.other.notes.length != 0 && this.data.other.notes[prevNoteIdx].timestamp === timestamp) {this.data.other.notes[prevNoteIdx].note = this.data.other.notes[prevNoteIdx].note + "|" + text}
					else this.data.other.notes.push({time:timestamp, note:text});
				}
				else if(this.settings.heg) {
					timestamp = this.data.heg[0].times[prevNoteIdx];
					this.data.other.notes.push({time:timestamp, note:text});
					if(this.data.other.notes.length != 0 && this.data.other.notes[prevNoteIdx].timestamp === timestamp) {this.data.other.notes[prevNoteIdx].note = this.data.other.notes[prevNoteIdx].note + "|" + text}
					else this.data.other.notes.push({time:timestamp, note:text});
				}
			}
			else {
				let timestamp = Date.now();
				if(this.data.other.notes.length != 0 && this.data.other.notes[prevNoteIdx].timestamp === timestamp) {this.data.other.notes[prevNoteIdx].note = this.data.other.notes[prevNoteIdx].note + "|" + text}
				else this.data.other.notes.push({time:Date.now(), note:text});
			}
		}
		else {
			if(this.data.other.notes.length != 0 && this.data.other.notes[prevNoteIdx].timestamp === timestamp) {this.data.other.notes[prevNoteIdx].note = this.data.other.notes[prevNoteIdx].note + "|" + text}
			else this.data.other.notes.push({time:timestamp, note:text});
		}
	}

	getDeviceDataByTag = (device='eeg',tag='FP1') => { //put eegshared for device to get shared info
		var found = undefined;
		if(typeof tag === 'number' && device === 'eeg') {
			let r = this.data[device+"shared"][device+"ChannelTags"].find((o,i) => {
				if(o.ch === tag && o.tag !== null) {
					tag = o.tag; //you can search for eeg data by channel number as well
					return true;
				}
			});
			//console.log(tag)
		}
		if(device.indexOf("shared") < 0) {
			let atlasCoord = this.data[device].find((o, i) => {
				if(o.tag === tag){
					found = o;
					return true;
				}
			});
			return found; //return shared data structs	
		}
		else if (tag === null || tag === 'all') {
			return this.data[device]; //return all device data structs	
		}
		else if (typeof tag === 'string' || typeof tag === 'number') {
			let r = this.data[device].find((o,i) => {
				if(o.tag === tag) {
					found = o; 	
					return true;
				}
			});
			return found;  //return tagged data struct
		}
		else {
			return found; //return undefined	
		}
	}

	//Slice of latest HEG data if it exists. Undefined or full of empty arrays if not.
	getLatestHEGData = (tag=0) => {
		let found = this.data.heg.find((o)=>{
			if(o.tag === tag) {
				return true;
			}
		});
		if(found && found.count > 0) {
			let latest = { 
				tag:tag,
				count:found.count, 
				times:found.times[found.count-1], 
				red:found.red[found.count-1], 
				ir: found.ir[found.count-1], 
				ambient:found.ambient[found.count-1],
				ratio:found.ratio[found.count-1],
				temp:found.temp[found.count-1],
				beat_detect:{}  
			};

			if(found.beat_detect.drir_dt.length > 0) {
				latest.beat_detect.rir = found.beat_detect.rir[found.beat_detect.rir.length-1];
				latest.beat_detect.rir2 = found.beat_detect.rir2[found.beat_detect.rir2.length-1];
				latest.beat_detect.drir_dt = found.beat_detect.drir_dt[found.beat_detect.drir_dt.length-1];
			}
			if(found.beat_detect.beats.length > 0) {
				latest.beat_detect.beats = found.beat_detect.beats[found.beat_detect.beats.length-1];
				latest.beat_detect.localmins = found.beat_detect.localmins[found.beat_detect.localmins.length-1];
				latest.beat_detect.localmaxs = found.beat_detect.localmaxs[found.beat_detect.localmaxs.length-1];
				latest.beat_detect.peak_dists = found.beat_detect.peak_dists[found.beat_detect.peak_dists.length-1];
				latest.beat_detect.val_dists = found.beat_detect.val_dists[found.beat_detect.val_dists.length-1];
			}
			if(found.beat_detect.breaths.length > 0) {
				latest.beat_detect.breaths = found.beat_detect.breaths[found.beat_detect.breaths.length-1];
				latest.beat_detect.localmins2 = found.beat_detect.localmins2[found.beat_detect.localmins2.length-1];
				latest.beat_detect.localmaxs2 = found.beat_detect.localmaxs2[found.beat_detect.localmaxs2.length-1];
				latest.beat_detect.peak_dists2 = found.beat_detect.peak_dists2[found.beat_detect.peak_dists2.length-1];
				latest.beat_detect.val_dists2 = found.beat_detect.val_dists2[found.beat_detect.val_dists2.length-1];
			}
			return latest;
		} else if(found && found.count === 0) {
			return found;
		} else return undefined;
	}


	getEEGDataByChannel = (ch=0, data=this.data) => {
		let found = undefined;
		if(typeof ch === 'string') ch = parseInt(ch);
		let search = data.eegshared.eegChannelTags.find((o,i) => {
			if(o.ch === ch) {
				if(o.tag === null || o.tag === 'other') {
					found = this.getEEGDataByTag(o.ch);
				}
				else { 
					found = this.getEEGDataByTag(o.tag);
				}
				if(found !== false) return true;
			}
		});
		return found;
	}

    //Return the object corresponding to the atlas tag
	getEEGDataByTag = (tag="FP1", data=this.data) => {
		const regex = new RegExp(tag, 'i');
		let atlasCoord = data.eeg.find((o, i) => {
			if(regex.test(o.tag) || o.ch === parseInt(tag)){
				return o;
			}
		});
		return atlasCoord;
	}


    //Return the object corresponding to the atlas tag
	getCoherenceByTag = (tag="FP1::FZ") => {
		var found = undefined;
		let atlasCoord = this.data.coherence.find((o, i) => {
			if(o.tag === tag){
				found = o;
				return true;
			}
		});
		return found;
	}


    //Return an array of Array(3)s for each coordinate. Useful e.g. for graphics
	getCoordPositions(device='eeg') {
		var coords = [];
		for(var i = 0; i< this.data[device].length; i++) {
			coords.push([this.data[device][i].position.x,this.data[device][i].position.y,this.data[device][i].position.z]);
		}
		return coords;
	}

    //Get the latest data pushed to tagged channels
	getLatestFFTData = (tag=undefined) => {
		let dat = [];
		this.data.eegshared.eegChannelTags.forEach((r, i) => {
			if(tag) {
				if(tag === r.tag || parseInt(tag) === r.ch) {
					if(r.analyze === true) {
						let row = this.getEEGDataByTag(r.tag);
						if(row.fftCount === 0) {
							dat.push({
								tag:row.tag,
								fftCount:row.fftCount
							});
						}
						else {
							let lastIndex = row.fftCount - 1;
							dat.push({
								tag:row.tag,
								fftCount:row.fftCount,
								time: row.fftTimes[lastIndex],
								fft: row.ffts[lastIndex],
								slice:{scp:row.slices.scp[lastIndex], delta:row.slices.delta[lastIndex], theta:row.slices.theta[lastIndex], alpha1:row.slices.alpha1[lastIndex], alpha2:row.slices.alpha2[lastIndex], beta:row.slices.beta[lastIndex], lowgamma:row.slices.lowgamma[lastIndex], highgamma:row.slices.highgamma[lastIndex]},
								mean:{scp:row.means.scp[lastIndex],delta:row.means.delta[lastIndex], theta:row.means.theta[lastIndex], alpha1: row.means.alpha1[lastIndex], alpha2: row.means.alpha2[lastIndex], beta: row.means.beta[lastIndex], lowgamma:row.means.lowgamma[lastIndex], highgamma: row.means.highgamma[lastIndex]}
							});
						}
					}
				}
			}
			else if(r.analyze === true) {
				let row = this.getEEGDataByTag(r.tag);
				if(row.fftCount === 0) {
					dat.push({
						tag:row.tag,
						fftCount:row.fftCount
					});
				}
				else {
					//console.log(row);
					let lastIndex = row.fftCount - 1;
					dat.push({
						tag:row.tag,
						fftCount:row.fftCount,
						time: row.fftTimes[lastIndex],
						fft: row.ffts[lastIndex],
						slice:{scp:row.slices.scp[lastIndex], delta:row.slices.delta[lastIndex], theta:row.slices.theta[lastIndex], alpha1:row.slices.alpha1[lastIndex], alpha2:row.slices.alpha2[lastIndex], beta:row.slices.beta[lastIndex], lowgamma:row.slices.lowgamma[lastIndex], highgamma:row.slices.highgamma[lastIndex]},
						mean:{scp:row.means.scp[lastIndex], delta:row.means.delta[lastIndex], theta:row.means.theta[lastIndex], alpha1: row.means.alpha1[lastIndex], alpha2: row.means.alpha2[lastIndex], beta: row.means.beta[lastIndex], lowgamma:row.means.lowgamma[lastIndex], highgamma: row.means.highgamma[lastIndex]}
					});
				}
			}
		});
		return dat;
	}

	getLatestCoherenceData = (tag=undefined) => {
		let dat = [];
		this.data.coherence.forEach((row,i) => {
			if(tag) {
				if(row.tag === tag) {
					let lastIndex = row.fftCount - 1;
					dat.push({
						tag:row.tag,
						fftCount:row.fftCount,
						time: row.times[lastIndex],
						fft: row.ffts[lastIndex],
						slice:{scp:row.slices.scp[lastIndex], delta:row.slices.delta[lastIndex], theta:row.slices.theta[lastIndex], alpha1:row.slices.alpha1[lastIndex], alpha2:row.slices.alpha2[lastIndex], beta:row.slices.beta[lastIndex], gamma:row.slices.gamma[lastIndex]},
						mean:{scp:row.means.scp[lastIndex], delta:row.means.delta[lastIndex], theta:row.means.theta[lastIndex], alpha1: row.means.alpha1[lastIndex], alpha2: row.means.alpha2[lastIndex], beta: row.means.beta[lastIndex], gamma: row.means.gamma[lastIndex]}
					});
				}
			} else {
				let lastIndex = row.fftCount - 1;
				dat.push({
					tag:row.tag,
					fftCount:row.fftCount,
					time: row.times[lastIndex],
					fft: row.ffts[lastIndex],
					slice:{scp:row.slices.scp[lastIndex], delta:row.slices.delta[lastIndex], theta:row.slices.theta[lastIndex], alpha1:row.slices.alpha1[lastIndex], alpha2:row.slices.alpha2[lastIndex], beta:row.slices.beta[lastIndex], gamma:row.slices.gamma[lastIndex]},
					mean:{scp:row.means.scp[lastIndex], delta:row.means.delta[lastIndex], theta:row.means.theta[lastIndex], alpha1: row.means.alpha1[lastIndex], alpha2: row.means.alpha2[lastIndex], beta: row.means.beta[lastIndex], gamma: row.means.gamma[lastIndex]}
				});
			}
		});
		return dat;
	}

	//return data object for FP1 to FP2 (AF7 to AF8 on Muse)
	getFrontalData = (atlas_data) => {
		let frontalData = [];
		// if(this.settings.eeg) {
			let regex = new RegExp('([F]|[F][A-Za-z]|[A-Za-z][F])([0-9]|[0-9][0-9])','i')
			let frontalTags = atlas_data.eegshared.eegChannelTags.filter(({tag}) => tag.match(regex))
			frontalTags.forEach((o) => {
				frontalData.push(this.getEEGDataByTag(o.tag, atlas_data))
			})
        // }
		return frontalData;
	}


	//return coherence object for FP1 to FP2 (AF7 to AF8 on Muse)
	getFrontalCoherenceData = () => {
		let coherenceData = []
		if(this.settings.analysis.eegcoherence) {
			let regex = new RegExp('([F]|[F][A-Za-z]|[A-Za-z][F])([0-9]|[0-9][0-9])','i')
			let frontalTags = this.data.eegshared.eegChannelTags.filter(({tag}) => tag.match(regex))
			frontalTags.forEach((o,i) => {
				for (let j = i+1; j < frontalTags.length; j++) 	{	
				coherenceData.push(this.getCoherenceByTag(`${o.tag}::${frontalTags[j].tag}`))
				}
			})
		}
		return coherenceData;
	}

	//C3_C4 coherence data (cranial nervs)
	getCNCoherenceData = () => {
		let coh_ref_ch = undefined;
		if(this.settings.analysis.eegcoherence) {
            coh_ref_ch = this.getCoherenceByTag('C3_C4');
            if(coh_ref_ch === undefined) { coh_ref_ch = this.getCoherenceByTag('C4_C3'); }
        }
		return coh_ref_ch;
	}

	//Get raw/bandpower data for cranial nerves
	getCNData = () => {
		let cns_data = undefined;
		if(this.settings.eeg) {
			let c3 = this.getEEGDataByTag('C3');
			let c4 = this.getEEGDataByTag('C4');
			if(c3 && c4) {
				cns_data = [c3,c4];
			}
		}
		return cns_data;
	}

	//get the average of an array
	mean(arr){
		if (arr.length > 0){
			var sum = arr.reduce((prev,curr)=> curr += prev);
		return sum / arr.length;
		} else {
			return 0
		}
	}

	mode(arr){
		return arr.sort((a,b) =>
			  arr.filter(v => v===a).length
			- arr.filter(v => v===b).length
		).pop();
	}

	//Report moving average of frontal coherence
	getCoherenceScore = (coh_data,band='alpha1') => {
		let scores = []
		if (!Array.isArray(coh_data)) coh_data = [coh_data]
		coh_data.forEach(data => {
			if(data.fftCount > 0) {
				let ct = data.fftCount;
				let avg = Math.min(20,ct)
				let slice = data.means[band].slice(ct-avg);
				// let score = coh_data.means.alpha1[ct-1] - this.mean(slice);
				scores.push(this.mean(slice));
			}
		})
		return this.mean(scores)
	}

	//Get alpha2/alpha1 ratio from bandpower averages
	getAlphaRatio = (eeg_data) => {
		if(eeg_data.fftCount > 0) {
			let ratio = eeg_data.means.alpha2[eeg_data.fftCount-1] / eeg_data.means.alpha1[eeg_data.fftCount-1];
			return ratio;
		}
		else return 0;
	}

	//Calculate the latest theta/beta ratio from bandpower averages
	getThetaBetaRatio = (eeg_data) => {
		if(eeg_data.fftCount > 0) {
			let ratio = eeg_data.means.theta[eeg_data.fftCount-1] / eeg_data.means.beta[eeg_data.fftCount-1]; // takes last fft average for each band
			return ratio;
		} else return 0;
	}

	//Calculate the latest alpha/beta ratio from bandpower averages
	getAlphaBetaRatio = (eeg_data) => {
		if(eeg_data.fftCount > 0) {
			let ratio = ((eeg_data.means.alpha1[eeg_data.fftCount-1]+eeg_data.means.alpha2[eeg_data.fftCount-1])*.5) / eeg_data.means.beta[eeg_data.fftCount-1];
			return ratio;
		}
		else return 0;
	}

	//Calculate the latest alpha/theta ratio from bandpower averages
	getAlphaThetaRatio = (eeg_data) => {
		if(eeg_data.fftCount > 0) {
			let ratio = ((eeg_data.means.alpha1[eeg_data.fftCount-1]+eeg_data.means.alpha2[eeg_data.fftCount-1])*.5) / eeg_data.means.theta[eeg_data.fftCount-1];
			return ratio;
		}
		else return 0;
	}

	//Get highest peak near 40Hz (38-42Hz)
	get40HzGamma = (eeg_data) => {
		if(eeg_data.fftCount > 0) {
			let lowgamma = eeg_data.slices.lowgamma[eeg_data.fftCount-1];
			let centered = [];
			lowgamma.forEach((val,i) => {
				if(this.data.eegshared.bandFreqs.lowgamma[0][i] > 38 && this.data.eegshared.bandFreqs.lowgamma[0][i] < 42) {
					centered.push(val);
				}
			});

			return Math.max(...centered);
		}
		else return 0;
	}

	//Calculate a score for the change in bandpower for low gamma (32-45Hz)
	getLowGammaScore = (eeg_data) => {
		if(eeg_data.fftCount > 0) {
			let ct = eeg_data.fftCount;
			let avg = 20; if(ct < avg) { avg = ct; }
			let slice = eeg_data.means.lowgamma.slice(ct-avg);
			let score = eeg_data.means.lowgamma[ct-1] - this.mean(slice);
			return score;
		}
		else return 0;
	}

	getHEGRatioScore = (heg_ch) => {
		if(heg_ch.count > 0) {
			let ct = heg_ch.count;
			let avg = 40; if(ct < avg) { avg = ct; }
			let slice = heg_ch.ratio.slice(ct-avg);
			let score = heg_ch.ratio[ct-1] - this.mean(slice);
			return score;
		}
		else return 0;
	}

	// Check whether the user is blinking
	getBlink = (params = {}) => {
		let node = this.graph.getNode(this.props.id, 'blink')
		this.graph.updateParams(node, params)
		let blink = this.graph.runSafe(node,'default', {data: this.data, forceUpdate: true})
		return blink.data
	}

	isExtrema(arr,critical='peak') { //Checks if the middle point of the (odd-numbered) array is a local extrema. options: 'peak','valley','tangent'. Even numbered arrays are popped
        let ref = [...arr];
		if(ref.length%2 === 0) ref.pop();
        if(arr.length > 1) { 
            let pass = true;
            ref.forEach((val,i) => {
                if(critical === 'peak') { //search first derivative
                    if(i < Math.floor(ref.length*.5) && val >= ref[Math.floor(ref.length*.5)] ) {
                        pass = false;
                    } else if (i > Math.floor(ref.length*.5) && val >= ref[Math.floor(ref.length*.5)]) {
                        pass = false;
                    }
                } else if (critical === 'valley') { //search first derivative
                    if(i < Math.floor(ref.length*.5) && val <= ref[Math.floor(ref.length*.5)] ) {
                        pass = false;
                    } else if (i > Math.floor(ref.length*.5) && val <= ref[Math.floor(ref.length*.5)]) {
                        pass = false;
                    }
                } else { //look for tangents (best with 2nd derivative usually)
                    if((i < Math.floor(ref.length*.5) && val <= ref[Math.floor(ref.length*.5)] )) {
                        pass = false;
                    } else if ((i > Math.floor(ref.length*.5) && val <= ref[Math.floor(ref.length*.5)])) {
                        pass = false;
                    }
                } //|| (i < ref.length*.5 && val <= 0 ) || (i > ref.length*.5 && val > 0)
            });
            if(critical !== 'peak' && critical !== 'valley' && pass === false) {
                pass = true;
                ref.forEach((val,i) => { 
                    if((i <  Math.floor(ref.length*.5) && val >= ref[Math.floor(ref.length*.5)] )) {
                        pass = false;
                    } else if ((i >  Math.floor(ref.length*.5) && val >= ref[Math.floor(ref.length*.5)])) {
                        pass = false;
                    }
                });
            }
            return pass;
        }
    }

    isCriticalPoint(arr,critical='peak') { //Checks if the middle point of the (odd-numbered) array is a critical point. options: 'peak','valley','tangent'. Even numbered arrays are popped
        let ref = [...arr];
		if(ref.length%2 === 0) ref.pop();
        if(arr.length > 1) { 
            let pass = true;
            ref.forEach((val,i) => {
                if(critical === 'peak') { //search first derivative
                    if(i < ref.length*.5 && val <= 0 ) {
                        pass = false;
                    } else if (i > ref.length*.5 && val > 0) {
                        pass = false;
                    }
                } else if (critical === 'valley') { //search first derivative
                    if(i < ref.length*.5 && val >= 0 ) {
                        pass = false;
                    } else if (i > ref.length*.5 && val < 0) {
                        pass = false;
                    }
                } else { //look for tangents (best with 2nd derivative usually)
                    if((i < ref.length*.5 && val >= 0 )) {
                        pass = false;
                    } else if ((i > ref.length*.5 && val < 0)) {
                        pass = false;
                    }
                }
            });
            if(critical !== 'peak' && critical !== 'valley' && pass === false) {
                pass = true;
                ref.forEach((val,i) => { 
                    if((i < ref.length*.5 && val <= 0 )) {
                        pass = false;
                    } else if ((i > ref.length*.5 && val > 0)) {
                        pass = false;
                    }
                });
            }
            return pass;
        }
    }


	
	//Simple beat detection. 
	//For pulse it applies a 1/4th second moving average and finds zero-crosses on the first derivative of R+IR. Data should be filtered with an IIR/Biquad filter with crystal clear pulse waves
	//For breathing detection it applies a 3 second moving average and peak finding should work. Run every new sample
	beatDetection = (hegstruct, sps) => {

		//beat detect smoothing window and midpoint
        let window = Math.floor(sps/4);
        let pw = window; if(pw%2 === 0) {pw+=1} //make sure the peak window is an odd number
        let mid = Math.round(pw*.5);
        //breathing detect smoothing window and midpoint
        let window2 = Math.floor(sps*3);
        let pw2 = window2; if(pw2%2 === 0) {pw2+=1} 
        let mid2 = Math.round(pw2*.5);

		let bt = hegstruct.beat_detect;
		bt.rir.push(hegstruct.red[hegstruct.count-1]+hegstruct.ir[hegstruct.count-1]);
		if(bt.rir.length > pw) {
			bt.rir[bt.rir.length-1] = this.mean(bt.rir.slice(bt.rir.length-pw));
		} else {
			bt.rir[bt.rir.length-1] = this.mean(bt.rir);
		}
		if(bt.rir.length > pw2) {
			bt.rir2.push(this.mean(bt.rir.slice(bt.rir.length-pw2))); //filter with SMA
		} else {
			bt.rir2.push(this.mean(bt.rir));
		}
		if(hegstruct.count > 1) {
			bt.drir_dt.push((bt.rir[hegstruct.count-1]-bt.rir[hegstruct.count-2])/(hegstruct.times[hegstruct.count-1]-hegstruct.times[hegstruct.count-2]));
			if(bt.drir_dt.length>pw) {
				bt.drir_dt[bt.drir_dt.length-1] = this.mean(bt.drir_dt.slice(bt.drir_dt.length-pw)); //filter with SMA
				//Find local maxima and local minima.

				let l1=bt.localmins.length, l2=bt.localmaxs.length;
				if(this.isExtrema(bt.rir.slice(bt.rir.length-pw),'valley')) {
					//if(this.isCriticalPoint(bt.drir_dt.slice(bt.drir_dt.length-pw),'valley')) {
					bt.localmins.push({idx:hegstruct.count-mid, val:bt.rir[hegstruct.count-mid], t:hegstruct.times[hegstruct.count-mid] });
				}
				else if(this.isExtrema(bt.rir.slice(bt.rir.length-pw),'peak')) {//else if(this.isCriticalPoint(bt.drir_dt.slice(bt.drir_dt.length-pw),'peak')) {
					bt.localmaxs.push({idx:hegstruct.count-mid, val:bt.rir[hegstruct.count-mid], t:hegstruct.times[hegstruct.count-mid] });
				}

				if(bt.localmins.length > 1 && bt.localmaxs.length > 1) {
					
					//Shouldn't be more than 2 extra samples on the end if we have the correct number of beats.
					if(bt.localmins.length > bt.localmaxs.length+2) { while(bt.localmins.length > bt.localmaxs.length+2) { bt.localmins.splice(bt.localmins.length-2,1); } } //Keep the last detected max or min if excess detected
					else if (bt.localmaxs.length > bt.localmins.length+2) { while(bt.localmaxs.length > bt.localmins.length+2) {bt.localmaxs.splice(bt.localmins.length-2,1); } }
					
					if(l1 < bt.localmins.length)
						bt.val_dists.push({dt:(bt.localmins[bt.localmins.length-1].t-bt.localmins[bt.localmins.length-2].t),t:bt.localmins[bt.localmins.length-1].t, y0:bt.localmins[bt.localmins.length-2].val, y1:bt.localmins[bt.localmins.length-1].val});
					if(l2 < bt.localmaxs.length)
						bt.peak_dists.push({dt:(bt.localmaxs[bt.localmaxs.length-1].t-bt.localmaxs[bt.localmaxs.length-2].t),t:bt.localmaxs[bt.localmaxs.length-1].t, y0:bt.localmaxs[bt.localmaxs.length-2].val, y1:bt.localmaxs[bt.localmaxs.length-1].val});
						//Found a peak and valley to average together (for accuracy)
					if(bt.peak_dists.length > 1 && bt.val_dists.length > 1) {
						//Make sure you are using the leading valley
						//console.log(bt.peak_dists[bt.peak_dists.length-1].dt,bt.val_dists[bt.val_dists.length-1].dt,bt.peak_dists[bt.peak_dists.length-2].dt,bt.val_dists[bt.val_dists.length-2].dt)
						if(bt.val_dists[bt.val_dists.length-1].t > bt.peak_dists[bt.peak_dists.length-1].t) {
							if(bt.beats.length < 1) {
								bt.beats.push({t:bt.peak_dists[bt.peak_dists.length-1].t, hrv:0, bpm:60/(0.0005*(bt.peak_dists[bt.peak_dists.length-1].dt + bt.val_dists[bt.val_dists.length-1].dt)), height0:bt.peak_dists[bt.peak_dists.length-1].y0-bt.val_dists[bt.val_dists.length-1].y0,height1:bt.peak_dists[bt.peak_dists.length-1].y1-bt.val_dists[bt.val_dists.length-1].y1});
							} else if(bt.beats[bt.beats.length-1].t !== bt.peak_dists[bt.peak_dists.length-1].t) {
								let bpm = 60/(0.0005*(bt.peak_dists[bt.peak_dists.length-1].dt + bt.val_dists[bt.val_dists.length-1].dt));
								bt.beats.push({t:bt.peak_dists[bt.peak_dists.length-1].t, hrv:Math.abs(bpm-bt.beats[bt.beats.length-1].bpm), bpm:bpm, height0:bt.peak_dists[bt.peak_dists.length-1].y0-bt.val_dists[bt.val_dists.length-1].y0,height1:bt.peak_dists[bt.peak_dists.length-1].y1-bt.val_dists[bt.val_dists.length-1].y1});
							}
						} else {
							if(bt.beats.length < 2) {
								bt.beats.push({t:bt.peak_dists[bt.peak_dists.length-2].t, hrv:0, bpm:60/(0.0005*(bt.peak_dists[bt.peak_dists.length-1].dt + bt.val_dists[bt.val_dists.length-1].dt)), height0:bt.peak_dists[bt.peak_dists.length-2].y0-bt.val_dists[bt.val_dists.length-2].y0,height1:bt.peak_dists[bt.peak_dists.length-2].y1-bt.val_dists[bt.val_dists.length-2].y1});
							} else if(bt.beats[bt.beats.length-1].t !== bt.peak_dists[bt.peak_dists.length-2].t) {
								let bpm = 60/(0.0005*(bt.peak_dists[bt.peak_dists.length-1].dt + bt.val_dists[bt.val_dists.length-1].dt));
								bt.beats.push({t:bt.peak_dists[bt.peak_dists.length-2].t, hrv:Math.abs(bpm-bt.beats[bt.beats.length-2].bpm) , bpm:bpm, height0:bt.peak_dists[bt.peak_dists.length-2].y0-bt.val_dists[bt.val_dists.length-2].y0,height1:bt.peak_dists[bt.peak_dists.length-2].y1-bt.val_dists[bt.val_dists.length-2].y1});
							}
						}
					}
				}
			}
			if(bt.rir2.length>pw2) {
				//Find local maxima and local minima.
				
				let l3=bt.localmins2.length, l4=bt.localmaxs2.length;
				if(this.isExtrema(bt.rir2.slice(bt.rir2.length-pw2),'valley')) {
					bt.localmins2.push({idx:hegstruct.count-mid2, val:bt.rir[hegstruct.count-mid2], t:hegstruct.times[hegstruct.count-mid2] });
				}
				else if(this.isExtrema(bt.rir2.slice(bt.rir2.length-pw2),'peak')) {
					bt.localmaxs2.push({idx:hegstruct.count-mid2, val:bt.rir[hegstruct.count-mid2], t:hegstruct.times[hegstruct.count-mid2] });
				}

				if(bt.localmins2.length > 1 && bt.localmaxs2.length > 1) {
					
					//Shouldn't be more than 2 extra samples on the end if we have the correct number of beats.
					if(bt.localmins2.length > bt.localmaxs2.length+2) { while(bt.localmins2.length > bt.localmaxs2.length+2) { bt.localmins2.splice(bt.localmins2.length-2,1); } } //Keep the last detected max or min if excess detected
					else if (bt.localmaxs2.length > bt.localmins2.length+2) { while(bt.localmaxs2.length > bt.localmins2.length+2) {bt.localmaxs2.splice(bt.localmins2.length-2,1); } }
					
					if(l3 < bt.localmins2.length)
						bt.val_dists2.push({dt:(bt.localmins2[bt.localmins2.length-1].t-bt.localmins2[bt.localmins2.length-2].t),t:bt.localmins2[bt.localmins2.length-1].t, y0:bt.localmins2[bt.localmins2.length-2].val, y1:bt.localmins2[bt.localmins2.length-1].val});
					if(l4 < bt.localmaxs2.length)
						bt.peak_dists2.push({dt:(bt.localmaxs2[bt.localmaxs2.length-1].t-bt.localmaxs2[bt.localmaxs2.length-2].t),t:bt.localmaxs2[bt.localmaxs2.length-1].t, y0:bt.localmaxs2[bt.localmaxs2.length-2].val, y1:bt.localmaxs2[bt.localmaxs2.length-1].val});
			
					//Found a peak and valley to average together (for accuracy)
					if(bt.peak_dists2.length > 1 && bt.val_dists2.length > 1) {
						//Make sure you are using the leading valley
						if(bt.val_dists2[bt.val_dists2.length-1].t > bt.peak_dists2[bt.peak_dists2.length-1].t) {
							if(bt.breaths.length === 0) { 
								bt.breaths.push({t:bt.peak_dists2[bt.peak_dists2.length-1].t,bpm:2000*60/(bt.peak_dists2[bt.peak_dists2.length-1].dt + bt.val_dists2[bt.val_dists2.length-1].dt), brv:0, height0:bt.peak_dists2[bt.peak_dists2.length-1].y0-bt.val_dists2[bt.val_dists2.length-1].y0,height0:bt.peak_dists2[bt.peak_dists2.length-1].y1-bt.val_dists2[bt.val_dists2.length-1].y1});
							} else if(bt.breaths[bt.breaths.length-1].t !== bt.peak_dists2[bt.peak_dists2.length-1].t) {
								let bpm = 2000*60/(bt.peak_dists2[bt.peak_dists2.length-1].dt + bt.val_dists2[bt.val_dists2.length-1].dt);
								bt.breaths.push({t:bt.peak_dists2[bt.peak_dists2.length-1].t,bpm:bpm, brv:Math.abs(bpm-bt.breaths[bt.breaths.length-1].bpm), height0:bt.peak_dists2[bt.peak_dists2.length-1].y0-bt.val_dists2[bt.val_dists2.length-1].y0,height0:bt.peak_dists2[bt.peak_dists2.length-1].y1-bt.val_dists2[bt.val_dists2.length-1].y1});
							}
						} else {
							if(bt.breaths.length === 0) {
								bt.breaths.push({t:bt.peak_dists2[bt.peak_dists2.length-2].t,bpm:2000*60/(bt.peak_dists2[bt.peak_dists2.length-2].dt + bt.val_dists2[bt.val_dists2.length-2].dt), brv:0, height0:bt.peak_dists2[bt.peak_dists2.length-2].y0-bt.val_dists2[bt.val_dists2.length-2].y0,height0:bt.peak_dists2[bt.peak_dists2.length-2].y1-bt.val_dists2[bt.val_dists2.length-2].y1});
							} else if(bt.breaths[bt.breaths.length-1].t !== bt.peak_dists2[bt.peak_dists2.length-2].t) {
								let bpm = 2000*60/(bt.peak_dists2[bt.peak_dists2.length-2].dt + bt.val_dists2[bt.val_dists2.length-2].dt);
								bt.breaths.push({t:bt.peak_dists2[bt.peak_dists2.length-2].t,bpm:bpm, brv:Math.abs(bpm-bt.breaths[bt.breaths.length-1].bpm), height0:bt.peak_dists2[bt.peak_dists2.length-2].y0-bt.val_dists2[bt.val_dists2.length-2].y0,height0:bt.peak_dists2[bt.peak_dists2.length-2].y1-bt.val_dists2[bt.val_dists2.length-2].y1});
							}
						}
					}
					
				}
			}
		}
	}


    setDefaultTags() {
		return [
			{ch: 0, tag: null},{ch: 1, tag: null},{ch: 2, tag: null},{ch: 3, tag: null},
			{ch: 4, tag: null},{ch: 5, tag: null},{ch: 6, tag: null},{ch: 7, tag: null},
			{ch: 8, tag: null},{ch: 9, tag: null},{ch: 10, tag: null},{ch: 11, tag: null},
			{ch: 12, tag: null},{ch: 13, tag: null},{ch: 14, tag: null},{ch: 15, tag: null},
			{ch: 16, tag: null},{ch: 17, tag: null},{ch: 18, tag: null},{ch: 19, tag: null},
			{ch: 20, tag: null},{ch: 21, tag: null},{ch: 22, tag: null},{ch: 23, tag: null},
			{ch: 24, tag: null},{ch: 25, tag: null},{ch: 26, tag: null},{ch: 27, tag: null},
			{ch: 28, tag: null},{ch: 29, tag: null},{ch: 30, tag: null},{ch: 31, tag: null}
		];
	}

    getBandFreqs(frequencies) {//Returns an object with the frequencies and indices associated with the bandpass window (for processing the FFT results)
		var scpFreqs = [[],[]], deltaFreqs = [[],[]], thetaFreqs = [[],[]], alpha1Freqs = [[],[]], alpha2Freqs = [[],[]], betaFreqs = [[],[]], lowgammaFreqs = [[],[]], highgammaFreqs = [[],[]]; //x axis values and indices for named EEG frequency bands
		frequencies.forEach((item,idx) => {
			if((item >= 0.1) && (item <= 1)){
				scpFreqs[0].push(item); scpFreqs[1].push(idx);
			}
			else if((item >= 1) && (item <= 4)){
				deltaFreqs[0].push(item); deltaFreqs[1].push(idx);
			}
			else if((item > 4) && (item <= 8)) {
				thetaFreqs[0].push(item); thetaFreqs[1].push(idx);
			}
			else if((item > 8) && (item <= 10)){
				alpha1Freqs[0].push(item); alpha1Freqs[1].push(idx);
			}
			else if((item > 10) && (item <= 12)){
				alpha2Freqs[0].push(item); alpha2Freqs[1].push(idx);
			}
			else if((item > 12) && (item <= 30)){
				betaFreqs[0].push(item); betaFreqs[1].push(idx);
			}
			else if((item > 30) && (item <= 45)) {
				lowgammaFreqs[0].push(item); lowgammaFreqs[1].push(idx);
			}
			else if(item > 45) {
				highgammaFreqs[0].push(item); highgammaFreqs[1].push(idx);
			}
		});
		return {scp: scpFreqs, delta: deltaFreqs, theta: thetaFreqs, alpha1: alpha1Freqs, alpha2: alpha2Freqs, beta: betaFreqs, lowgamma: lowgammaFreqs, highgamma: highgammaFreqs}
	}

    mapFFTData = (fft, lastPostTime, tag) => {
		let atlasCoord = this.data.eeg.find((o, i) => {
			if(o.tag === tag){
				o.fftCount++;
				o.fftTimes.push(lastPostTime);
				o.ffts.push(fft);
				if(this.data.eegshared.bandFreqs.scp[1].length > 0){
					var scp = fft.slice( this.data.eegshared.bandFreqs.scp[1][0], this.data.eegshared.bandFreqs.scp[1][this.data.eegshared.bandFreqs.scp[1].length-1]+1);
					o.slices.scp.push(scp);
					o.means.scp.push(this.mean(scp));
				}
				if(this.data.eegshared.bandFreqs.scp[1].length > 0){
					var delta = fft.slice( this.data.eegshared.bandFreqs.delta[1][0], this.data.eegshared.bandFreqs.delta[1][this.data.eegshared.bandFreqs.delta[1].length-1]+1);
					o.slices.delta.push(delta);
					o.means.delta.push(this.mean(delta));
				}
				if(this.data.eegshared.bandFreqs.theta[1].length > 0){
					var theta = fft.slice( this.data.eegshared.bandFreqs.theta[1][0], this.data.eegshared.bandFreqs.theta[1][this.data.eegshared.bandFreqs.theta[1].length-1]+1);
					o.slices.theta.push(theta);
					o.means.theta.push(this.mean(theta));
				}
				if(this.data.eegshared.bandFreqs.alpha1[1].length > 0){
					var alpha1 = fft.slice( this.data.eegshared.bandFreqs.alpha1[1][0], this.data.eegshared.bandFreqs.alpha1[1][this.data.eegshared.bandFreqs.alpha1[1].length-1]+1);
					o.slices.alpha1.push(alpha1);
					o.means.alpha1.push(this.mean(alpha1));
				}
				if(this.data.eegshared.bandFreqs.alpha2[1].length > 0){
					var alpha2 = fft.slice( this.data.eegshared.bandFreqs.alpha2[1][0], this.data.eegshared.bandFreqs.alpha2[1][this.data.eegshared.bandFreqs.alpha2[1].length-1]+1);
					o.slices.alpha2.push(alpha2);
					o.means.alpha2.push(this.mean(alpha2));
				}
				if(this.data.eegshared.bandFreqs.beta[1].length > 0){
					var beta  = fft.slice( this.data.eegshared.bandFreqs.beta[1][0],  this.data.eegshared.bandFreqs.beta[1][this.data.eegshared.bandFreqs.beta[1].length-1]+1);
					o.slices.beta.push(beta);
					o.means.beta.push(this.mean(beta));
				}
				if(this.data.eegshared.bandFreqs.lowgamma[1].length > 0){
					var lowgamma = fft.slice( this.data.eegshared.bandFreqs.lowgamma[1][0], this.data.eegshared.bandFreqs.lowgamma[1][this.data.eegshared.bandFreqs.lowgamma[1].length-1]+1);
					o.slices.lowgamma.push(lowgamma);
					o.means.lowgamma.push(this.mean(lowgamma));
				}
				if(this.data.eegshared.bandFreqs.highgamma[1].length > 0){
					var highgamma = fft.slice( this.data.eegshared.bandFreqs.highgamma[1][0], this.data.eegshared.bandFreqs.highgamma[1][this.data.eegshared.bandFreqs.highgamma[1].length-1]+1);
					o.slices.highgamma.push(highgamma);
					o.means.highgamma.push(this.mean(highgamma));
				}
				//console.timeEnd("slicing bands");
				return true;
			}
		});
	}

    mapCoherenceData = (data, lastPostTime) => { //Expects data in correct order
	  data.forEach((row,i) => {
		  this.data.coherence[i].fftCount++;
		  this.data.coherence[i].ffts.push(row);
		  this.data.coherence[i].fftTimes.push(lastPostTime);

		if(this.data.eegshared.bandFreqs.scp[1].length > 0){
		  var scp = row.slice( this.data.eegshared.bandFreqs.scp[1][0], this.data.eegshared.bandFreqs.scp[1][this.data.eegshared.bandFreqs.scp[1].length-1]+1);
		  this.data.coherence[i].slices.scp.push(scp);
		  this.data.coherence[i].means.scp.push(this.mean(scp));
		}
		if(this.data.eegshared.bandFreqs.delta[1].length > 0){
		  var delta = row.slice( this.data.eegshared.bandFreqs.delta[1][0], this.data.eegshared.bandFreqs.delta[1][this.data.eegshared.bandFreqs.delta[1].length-1]+1);
		  this.data.coherence[i].slices.delta.push(delta);
		  this.data.coherence[i].means.delta.push(this.mean(delta));
		}
		if(this.data.eegshared.bandFreqs.theta[1].length > 0){
		  var theta = row.slice( this.data.eegshared.bandFreqs.theta[1][0], this.data.eegshared.bandFreqs.theta[1][this.data.eegshared.bandFreqs.theta[1].length-1]+1);
		  this.data.coherence[i].slices.theta.push(theta);
		  this.data.coherence[i].means.theta.push(this.mean(theta));
		}
		if(this.data.eegshared.bandFreqs.alpha1[1].length > 0){
		  var alpha1 = row.slice( this.data.eegshared.bandFreqs.alpha1[1][0], this.data.eegshared.bandFreqs.alpha1[1][this.data.eegshared.bandFreqs.alpha1[1].length-1]+1);
		  this.data.coherence[i].slices.alpha1.push(alpha1);
		  this.data.coherence[i].means.alpha1.push(this.mean(alpha1));
		}
		if(this.data.eegshared.bandFreqs.alpha2[1].length > 0){
		  var alpha2 = row.slice( this.data.eegshared.bandFreqs.alpha2[1][0], this.data.eegshared.bandFreqs.alpha2[1][this.data.eegshared.bandFreqs.alpha2[1].length-1]+1);
		  this.data.coherence[i].slices.alpha2.push(alpha2);
		  this.data.coherence[i].means.alpha2.push(this.mean(alpha2));
		}
		if(this.data.eegshared.bandFreqs.beta[1].length > 0){
		  var beta = row.slice( this.data.eegshared.bandFreqs.beta[1][0],  this.data.eegshared.bandFreqs.beta[1][this.data.eegshared.bandFreqs.beta[1].length-1]+1);
		  this.data.coherence[i].slices.beta.push(beta);
		  this.data.coherence[i].means.beta.push(this.mean(beta));
		}
		if(this.data.eegshared.bandFreqs.lowgamma[1].length > 0){
		  var lowgamma = row.slice( this.data.eegshared.bandFreqs.lowgamma[1][0], this.data.eegshared.bandFreqs.lowgamma[1][this.data.eegshared.bandFreqs.lowgamma[1].length-1]+1);
		  this.data.coherence[i].slices.lowgamma.push(lowgamma);
		  this.data.coherence[i].means.lowgamma.push(this.mean(lowgamma));
		}
		if(this.data.eegshared.bandFreqs.highgamma[1].length > 0){
		  var highgamma = row.slice( this.data.eegshared.bandFreqs.highgamma[1][0], this.data.eegshared.bandFreqs.highgamma[1][this.data.eegshared.bandFreqs.highgamma[1].length-1]+1);
		  this.data.coherence[i].slices.highgamma.push(highgamma);
		  this.data.coherence[i].means.highgamma.push(this.mean(highgamma));
		}
	  });
	}
    
    //Returns the x axis (frequencies) for the bandpass filter amplitudes. The window gets stretched or squeezed between the chosen frequencies based on the sample rate in my implementation.
	bandpassWindow(freqStart,freqEnd,nSteps) {

		let diff = (freqEnd - freqStart)/nSteps;
		let fftwindow = [];
		let i = 0;
		while(i < freqEnd) {
			fftwindow.push(i);
			i += diff;
		}
		return fftwindow;
	}

	bufferEEGSignals = (seconds=1) => { //Buffers 1 second of all tagged eeg signals (unless null or 'other'). Data buffered in order of objects in the eeg array
		let nSamples = Math.floor(this.data.eegshared.sps * seconds);
		let buffer = [];
		let syncTime = null;
		for(var i = 0; i < this.data.eegshared.eegChannelTags.length; i++){
			if(this.data.eegshared.eegChannelTags[i].analyze === true && this.data.eegshared.eegChannelTags[i].tag !== null && this.data.eegshared.eegChannelTags[i].tag !== 'other') {
				let dat = this.getEEGDataByTag(this.data.eegshared.eegChannelTags[i].tag);
				//console.log(dat)
				if(dat !== undefined) {
					//console.log(dat);
					if(dat.filtered.length > 0) {buffer.push(dat.filtered.slice(dat.filtered.length-nSamples));}
					else if (dat.raw.length > 0) {buffer.push(dat.raw.slice(dat.raw.length-nSamples));}
					if(syncTime === null) {
						syncTime = dat.times[dat.times.length-1];
					}
				}
			}
		}
		// if(this.settings.analyzing === true) { 
			this.workerPostTime = syncTime; 
		// }
		return buffer;
	}
	
	toISOLocal(d) {
		var z  = n =>  ('0' + n).slice(-2);
		var zz = n => ('00' + n).slice(-3);
		var off = d.getTimezoneOffset();
		var sign = off < 0? '+' : '-';
		off = Math.abs(off);
	  
		return d.getFullYear() + '-' //https://stackoverflow.com/questions/49330139/date-toisostring-but-local-time-instead-of-utc
			   + z(d.getMonth()+1) + '-' +
			   z(d.getDate()) + 'T' +
			   z(d.getHours()) + ':'  + 
			   z(d.getMinutes()) + ':' +
			   z(d.getSeconds()) + '.' +
			   zz(d.getMilliseconds()) + 
			   "(UTC" + sign + z(off/60|0) + ':00)'
	}

	readyDataForWriting = (from=0,to='end',getFFTs=true) => {
		let eeg = this.readyEEGDataForWriting(from,to,getFFTs)
		let heg = this.readyHEGDataForWriting(from,to)
		let datasets = [eeg,heg]
		let toSend
		datasets.forEach(arr => {
			if (arr[1] != '') toSend = arr
		})

		// If No Data, Return Notes Only
		if (toSend) return toSend
		else return this.readyNotesForWriting()
	}

	readyNotesForWriting = () => {
		let header = ["TimeStamps","UnixTime","Notes"];
		let data = []
		this.data.other.notes.forEach((n,i) => {
			let line = []
			if (n.time != null){
				line.push(this.toISOLocal(new Date(n.time)),n.time, n.note)
				data.push(line.join(","))
			}
		})
		return [header.join(",")+"\n",data.join("\n")];
	}

	readyEEGDataForWriting = (from=0,to='end',getFFTs=true) => {
		 
		let header = ["TimeStamps","UnixTime","Notes"];
		let data = [];
		let mapidx = 0;
		let noteidx = 0;
		let datums = [];
		let fft_ref_ch = null;
		let ffts_appended = false;
		this.data.eegshared.eegChannelTags.forEach((row,j) => {
			if(fft_ref_ch === null && row.tag !== 'other' && row.analyze === true) fft_ref_ch = this.getEEGDataByChannel(row.ch)
			datums.push(this.getEEGDataByChannel(row.ch));
		});

		if(datums.length > 0) {
			if(to === 'end') { to = datums[0].count; }
			if(datums[0].count < from && from > this.atlas.rolloverLimit-2000) { from = this.atlas.rolloverLimit - 2000; }
			if(from!==0) { 
				while (fft_ref_ch.fftTimes[mapidx] < datums[0].times[from]) {
					mapidx++;
				}
			}
			for(let i = from; i<to; i++){
				let line=[];
				line.push(this.toISOLocal(new Date(datums[0].times[i])),datums[0].times[i]);
				//first get the raw/filtered
				if(this.data.other.notes.length > 0) {
					if(i > 0) {
						while(this.data.other.notes.length-1 > noteidx && this.data.other.notes[noteidx].time < datums[0].times[i]) {
							noteidx++;
						}
					}
					if(this.data.other.notes[noteidx] && this.data.other.notes[noteidx].time <= datums[0].times[i]) {
						//if(line.length !== header.length) line = new Array(header.length-line.length-1).fill(''); //resize line to correct size if not long enough
						line.push(this.data.other.notes[noteidx].note); 
						noteidx++;
					} else {
						line.push('');
					}
				} else { line.push(''); }
				datums.forEach((row,j) => {
					if(i === 0) { header.push(row.tag); }
					if(row.filtered.length > i) {
						line.push(row.filtered[i].toFixed(0));
					} else if (row.raw.length > i) {
						line.push(row.raw[i].toFixed(0));
					}
				});
				if(getFFTs) {
					//then get the fft/coherence data
					if(fft_ref_ch.fftCount >= mapidx && fft_ref_ch.fftTimes[mapidx] === datums[0].times[i]) {
						datums.forEach((row,j) => {
							if(mapidx === 0) {
								let found = this.data.eegshared.eegChannelTags.find((o,k) => {
									if((row.tag === o.ch || row.tag === o.tag) && (o.analyze === false || o.tag === 'other')) {
										return true;
									}
								});
								if(!found){ //don't add headers for rows not being analyzed
									let bpfreqs = [...this.data.eegshared.frequencies].map((x,k) => x = x.toFixed(3));
									header.push(row.tag+"; FFT Hz:",bpfreqs.join(","));
									ffts_appended = true;
								}
							}
							if(datums[0].times[i] === row.fftTimes[mapidx]) {
								line.push(['',...[...row.ffts[mapidx]].map((x,k) => x = x.toFixed(3))]);
							}
						});
						if(this.settings.analysis.eegcoherence) {
							this.data.coherence.forEach((row,j) => {
								if(mapidx===0) {
									let bpfreqs = [...this.data.eegshared.frequencies].map((x,k) => x = x.toFixed(3));
									header.push(row.tag+"; FFT Hz:",bpfreqs.join(","));
								}
								if(datums[0].fftTimes[mapidx] === row.fftTimes[mapidx]) {
									try{
										line.push(['',...[...row.ffts[mapidx]].map((x,k) => x = x.toFixed(3))]);
									}
									catch(err) { console.log(err, mapidx, row); }
								}
							});
						}
						mapidx++;	
					}
				}

				data.push(line.join(","));
			}
			return [header.join(",")+"\n",data.join("\n")];	
		}
		else return undefined;
	}

	readyHEGDataForWriting = (from=0,to='end',hegIdx=0) => {
		let header = ["TimeStamps","UnixTime","Red","IR","Ratio","Ambient","Temp","BPM","HRV","BrPM","BRV"];
		let data = [];
		let row = this.data.heg[hegIdx];
		let noteidx = 0;
		let beatidx = 0;
		let breathidx = 0;
		if(to === 'end') {
			if (row) to = row.times.length;
			else to = 0
		}
		for(let i = from; i < to; i++) {
			let t = row.times[i];
			let amb = row.ambient[i]; if(!amb) amb = 0;
			let dataToPush = [this.toISOLocal(new Date(t)),t,row.red[i],row.ir[i],row.ratio[i],amb,row.temp[i]];
			if(t === row.beat_detect.beats[beatidx]?.t) { 
				dataToPush.push(row.beat_detect.beats[beatidx]?.bpm,row.beat_detect.beats[beatidx].hrv); 
				beatidx++;
			} else {dataToPush.push('','')}
			if(t === row.beat_detect.breaths[breathidx]?.t) { 
				dataToPush.push(row.beat_detect.breaths[breathidx].bpm,row.beat_detect.breaths[breathidx].brv); 
				breathidx++; 
			} else {dataToPush.push('','')}

			if(this.data.other.notes.length > 0) {
				if(i === 0) {
					header.push('Notes');
				} else {
					while(this.data.other.notes[noteidx].time < t) {
						noteidx++;
					}
				}
				if(this.data.other.notes[noteidx].time <= t) {
					dataToPush.push(this.data.other.notes[noteidx].note); 
					nodeidx++;
				}
			}

			data.push(dataToPush.join(','));
			
		};
		return [header.join(',')+"\n",data.join('\n')];
	}

	regenAtlasses(freqStart,freqEnd,sps=512) {
		this.data.eeg = this.noteAtlas10_20(); //reset atlas

		let bandPassWindow = this.bandPassWindow(freqStart,freqEnd,sps);

		this.data.eegshared.frequencies = bandPassWindow;//Push the x-axis values for each frame captured as they may change - should make this lighter
		this.data.eegshared.bandFreqs = this.getBandFreqs(bandPassWindow); //Update bands accessed by the atlas for averaging

		this.coherenceMap = this.genCoherenceMap();
	}

	workeronmessage = (msg) => {
		//console.log(msg);
		if(msg.origin === this.name) {
			if(msg.foo === "multidftbandpass" || msg.foo === "multidft") { 
				//parse data into atlas
				var ffts = [...msg.output[1]];
				let fftIdx = 0;
				this.data.eegshared.eegChannelTags.forEach((row,i) => {
					if(row.tag !== null && row.tag !== 'other' && row.analyze === true) {
						this.mapFFTData(ffts[fftIdx],this.workerPostTime,row.tag);
						fftIdx++;
						//console.log(o);
					}
				});
				
				this.checkRollover('eeg');
			}
			else if(msg.foo === "coherence"){ 
				var ffts = [...msg.output[1]];
				var coher = [...msg.output[2]];
				let fftIdx = 0;
				this.data.eegshared.eegChannelTags.forEach((row,i) => {
					if(row.tag !== null && row.tag !== 'other' && row.analyze === true) {
						this.mapFFTData(ffts[fftIdx],this.workerPostTime,row.tag);
						fftIdx++;
						//console.log(o);
					}
				});
				//coherence
				this.mapCoherenceData(coher,this.workerPostTime);
				
				this.checkRollover('eeg');
			}
			this.workerWaiting = false;
		}
	}

	addDefaultAnalyzerFuncs() {
		this.analyzerOpts.push('eegfft','eegcoherence');

		let fftFunc = () => {
			if(this.workerWaiting === false){
				let buf = this.bufferEEGSignals(1);
                if(buf.length > 0) {
                    if(buf[0].length >= this.data.eegshared.sps) {
						if (this.settings.analysis.eegfft){
							window.workers.postToWorker({foo:'multifftbandpass', input:[buf, 1, 0, 128, 1], origin:this.name}, this.workerId);
							this.workerWaiting = true;
						}
                    }
                }
			}
		}
		
		let coherenceFunc = () => {
			if(this.workerWaiting === false){
				let buf = this.bufferEEGSignals(1);
                if(buf.length > 0) {
                    if(buf[0].length >= this.data.eegshared.sps) {
						if (this.settings.analysis.eegcoherence){
							this.workerWaiting = true;
							window.workers.postToWorker({foo:'coherence', input:[buf, 1, 0, 128, 1], origin:this.name}, this.workerId);
							//window.workers.postToWorker({foo:'gpucoh', input:[buf, 1, 0, this.data.eegshared.sps*0.5, 1], origin:this.name},this.workerId);
						}
                    }
                }
			}
		}	

		this.analyzerFuncs.push(fftFunc,coherenceFunc);
		//'bcijs_bandpowers','bcijs_pca','heg_pulse'
	}

	addAnalyzerFunc(name='',foo=()=>{}) {
		let n = this.analyzerOpts.find((name,i) => {
			if(name === name) {
				this.analyzerFuncs[i] = foo;
				return true;
			}
		});
		if(n === undefined) {
			this.analyzerOpts.push(name);
			this.analyzerFuncs.push(foo);
		}
	}

	//Threadsafe way to call eegcoherence and stuff
	runAnalyzerFunc = (run) => {
		this.analyzerOpts.find((opt,j) => {
			if(opt === run) {
				this.analyzerFuncs[j]();
				return true;
			}
		});
	}

	checkRollover(dataArr=null) { //'eeg','heg', etc
		if(dataArr === null) {
			for(const prop in this.data) {
				if(Array.isArray(this.data[prop])) {
					this.data[prop].forEach((row,i) => {
						for(const p in row) {
							if((!Array.isArray(row[p])) && typeof row[p] === 'object') { //e.g. {slices:{alpha1:[...]}}
								for(const pz in row[p]) {
									if(Array.isArray(row[p][pz])) {
										if(row[p][pz].length > this.rolloverLimit) {row[p][pz].splice(0,(row[p][pz].length-this.rolloverLimit)-2000);}
									}
								}
							}
							else if(Array.isArray(row[p])) { // e.g. {ffts:[...] fftCount:x}
								if(row[p].length > this.rolloverLimit) {
									row[p].splice(0,(row[p].length-this.rolloverLimit)-2000);
									if(p === 'ffts') { //adjust counters
										row.fftCount = row[p].length;
										if(row.lastReadFFT > row[p].length) {
											row.lastReadFFT = row[p].length;
										}
									}
									else if (p === 'times') {
										row.count = row[p].length;
										if(row.lastRead > row[p].length) {
											row.lastRead = row[p].length;
										}
									}
								}
							}
							
						}
					});
				}
			}
		}
		else { //spaghetti
			if(Array.isArray(this.data[dataArr])) {
				this.data[dataArr].forEach((row,i) => {
					for(const p in row) {
						if((!Array.isArray(row[p])) && typeof row[p] === 'object') { //nested object with arrays
							for(const pz in row[p]) {
								if(Array.isArray(row[p][pz])) {
									if(row[p][pz].length > this.rolloverLimit) {row[p][pz].splice(0,(row[p][pz].length-this.rolloverLimit)-2000);}
								}
							}
						}
						else if(Array.isArray(row[p])) { //arrays
							if(row[p].length > this.rolloverLimit) {
								row[p].splice(0,(row[p].length-this.rolloverLimit)-2000);
								if(p === 'ffts') { //adjust counters
									row.fftCount = row[p].length;
									row.lastReadFFT = row[p].length;
								}
								else if (p === 'times') {
									row.count = row[p].length;
									row.lastRead = row[p].length;
								}
							}
						}
					}
				});
			}
		}
	}

	analyzer = () => { //Make this stop when streaming stops
		//eegfft,eegcoherence,bcijs_bandpowers,bcijs_pca,heg_pulse
		if(this.settings.runAnalysisLoop === true) {

			// Run Required Analysis Functions
			let keys = Object.keys(this.settings.analysis)

			// remove false keys

			// remove eegfft if coherence is running
			if (this.settings.analysis['eegcoherence'] == true) keys.find((k,i) => {
				if (k == 'eegfft') {
					keys.splice(i,1); 
					return true;
				}
			})
			keys.forEach((run,i) => {
				if (this.settings.analysis[run] === true){
					this.analyzerOpts.forEach((opt,j) => {
						if(opt === run) {
							this.analyzerFuncs[j]();
						}
					});
				}
			});
			if (typeof window === 'undefined') {
				setTimeout(()=>{this.analyzer()}, 60)
			} else {
				setTimeout(()=>{requestAnimationFrame(this.analyzer)},50);
			}
		}	
	}


	// Default Options Generation

	/**
     * @method DataAtlas.makeFeedbackOptions
     * @description Generate DOM fragment with a selector for available feedback options.
	 * @param {HTMLElement} parentNode Parent node to insert DOM fragment into.
	 */

	makeFeedbackOptions = (applet,parentNode=document.getElementById(applet.props.id).querySelector('.brainsatplay-neurofeedback-container')) => {
		let id = applet.props.id
		let html = '';
		let feedbackOptions;
		if (this.settings.deviceConnected){
			parentNode.style.pointerEvents = 'auto'
			// if (parentNode.style.position === 'absolute')
			// Custom Feedback Functions
			let getFrontalAlphaCoherence = () => {return this.getCoherenceScore(this.getFrontalCoherenceData(),'alpha1')}
			let getFocus = () => {
				let frontalData = this.getFrontalData()
				let thetaBetaArray = []
				frontalData.forEach(data => {
					thetaBetaArray.push(this.getThetaBetaRatio(data))
				})
				let output = Math.min(1/(thetaBetaArray.reduce((tot,curr) => tot + curr)/thetaBetaArray.length),1) // clamp focus at 1
				return output
			}

			let getHEGRatio = () => {
				let ct = this.data.heg[0].count;
				if(ct > 1) {
					let ratio = this.data.heg[0].ratio[ct-1];
					return ratio;
				}
				else return 0;
			}

			let getHEGScore = () => {
				let ct = this.data.heg[0].count;
				if(ct > 1) {
					let avg = 40; if(ct < avg) { avg = ct; }
					let slice = this.data.heg[0].ratio.slice(ct-avg);
					let score = this.data.heg[0].ratio[ct-1] - this.mean(slice);
					return score
				} 
				else return 0;
			}

			// A custom function to animate heartbeats
			let animateBeats = (type) => {
				let beats = this.data.heg[0].beat_detect[type]
				let prevBeatLength = this.data.heg[0].beat_detect.prevBeatLength
				this.data.heg[0].beat_detect.prevBeatLength = beats.length
				if (prevBeatLength < beats.length) {console.log('beat'); beats[beats.length - 1].tRead = Date.now()}
					if (0 < beats.length){
					let secondsElapsed = (Date.now() - beats[beats.length - 1].tRead) / 1000
					// let beatProgression = secondsElapsed // 1 s animation
					let beatProgression = secondsElapsed * beats[beats.length - 1].bpm/30 // animate based on estimated bpm
					if (beatProgression < 1) {
						let animation = 1 - (0.5 + 0.5*Math.cos(2*Math.PI*beatProgression))
						return animation
					} else {
						return 0
					}
				}
				else {
					return 0
				}
			}

			let animateHeartbeats = () => {
				return animateBeats('beats')
			}

			let animateBreaths = () => {
				return animateBeats('breaths')
			}


			// Option Declaration
			feedbackOptions = [
				{label: 'Select your neurofeedback', function: applet.defaultNeurofeedback},
			]
			if(this.settings.heg) {
				feedbackOptions.push(
					{label: 'HEG Ratio', function: getHEGRatio},
					{label: 'HEG Score', function: getHEGScore},
					{label: 'Heartbeat', function: animateHeartbeats},
					{label: 'Breath', function: animateBreaths},
				)
			} 
			if (this.settings.eeg){
				feedbackOptions.push(
					{label: 'Frontal Alpha Coherence', function: getFrontalAlphaCoherence},
					{label: 'Focus (Theta/Beta Ratio)', function: getFocus},
				)
			}

			let neurofeedbackSelector = document.getElementById(`${id}-neurofeedbackselector`)
			if (neurofeedbackSelector == null) {
				html = `<div><select id="${id}-neurofeedbackselector">`;
				feedbackOptions.forEach((o,i) => {
					if (i === 0) html += `<option value=${o.function.name} disabled>${o.label}</option>`
					else if (i === 1) html += `<option value=${o.function.name} selected>${o.label}</option>`
					else html += `<option value=${o.function.name}>${o.label}</option>`;
					if (i === feedbackOptions.length - 1) html += `</select></div>`
				});
				parentNode.innerHTML += html;
				neurofeedbackSelector = document.getElementById(`${id}-neurofeedbackselector`) 
			}
			applet.getNeurofeedback = feedbackOptions.find((o) => o.function.name == neurofeedbackSelector.value).function;
			neurofeedbackSelector.onchange = (e) => {applet.getNeurofeedback = feedbackOptions.find((o) => o.function.name == e.target.value).function}
		}
	}
}

