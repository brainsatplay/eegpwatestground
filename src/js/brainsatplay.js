/*

Data Streams
- Local hardware
  -- Serial
  -- BLE
  -- Sockets/SSEs
- Server
  -- Hardware and Game state data via Websockets

Data Processing 
- eegworker.js, eegmath, bcijs, etc.

Data State
- Sort raw/filtered data
- Sort processed data
- Handle streaming data from other users

UI Templating
- StateManager.js
- UIManager.js
- ObjectListener.js
- DOMFragment.js

Local Storage
- BrowserFS for IndexedDB
- CSV saving/parsing

Frontend Execution
- UI State
- Server State
- Game/App State(s)

*/
import 'regenerator-runtime/runtime' //fixes async calls in this bundler

import {StateManager} from './frontend/utils/StateManager'
import {dataAtlas} from './bciutils/dataAtlas'

import { eeg32Plugin } from './bciutils/devicePlugins/freeeeg32Plugin';
import { musePlugin } from './bciutils/devicePlugins/musePlugin';
import { hegduinoPlugin } from './bciutils/devicePlugins/hegduinoPlugin';
import { cytonPlugin } from './bciutils/devicePlugins/cytonPlugin';
import { webgazerPlugin } from './bciutils/devicePlugins/webgazerPlugin'

/** @module brainsatplay */

/**
 * @class module:brainsatplay.brainsatplay
 * @description Class for server/socket connecting and macro controls for device streaming and data accessibilty.
 */

export class brainsatplay {
	constructor(
		username='',
		password='',
		appname='',
		access='public',
		remoteHostURL='http://localhost:8000',//https://brainsatplay.azurewebsites.net/',
		localHostURL='http://127.0.0.1:8000'
	) {
		this.devices = [];
		this.state = new StateManager({
			commandResult:{},
		});

		this.atlas = new dataAtlas('atlas',undefined,undefined,true,false);

		this.info = {
			nDevices: 0,
			auth:{
				url: new URL(remoteHostURL), 
				username:username, 
				password:password, 
				access:access, 
				appname:appname.toLowerCase().split(' ').join('').replace(/^[^a-z]+|[^\w]+/gi, ""),
				authenticated:false
			},
			subscribed: false,
			connections: [],
			localHostURL: localHostURL
		}
		this.socket = null;
	}

	/**
     * @method module:brainsatplay.brainsatplay.setLoginInfo
     * @description Set user information.
     * @param username {string} Username.
     * @param password {string} Password.
	 * @param access {string} Access level ('public' or 'private').
     * @param appname {string} Name of the app.
     */

	setLoginInfo(username='',password='',access='public',appname='') {
		this.info.auth.username = username;
		this.info.auth.password = password;
		this.info.auth.access = access;
		this.info.auth.appname = appname;
	}

	//connect local device and add it, use reconnect() if disconnecting and reconnecting device in same session.
	connect(
		device="freeeeg32_2", //"freeeeg32","freeeeg32_19","muse","notion"
		analysis=['eegfft'], //'eegfft','eegcoherence',etc
		onconnect=()=>{}, //onconnect callback, subscribe to device outputs after connection completed
		ondisconnect=()=>{}, //ondisconnect callback, unsubscribe from outputs after device is disconnected
		streaming=false, //set to stream to server (must be connected)
		streamParams=[['eegch','FP1','all']], //Device properties to stream
		useFilters=true, //Filter device output if it needs filtering (some hardware already applies filters so we may skip those)
		pipeToAtlas=true
		) {
			if(streaming === true) {
				console.log(this.socket);
				if(this.socket == null || this.socket.readyState !== 1) {
					console.error('Server connection not found, please run login() first');
					return false;
				}
			}

			if(this.devices.length > 0) {
				if(device.indexOf('eeg') > -1 || device.indexOf('muse') > -1) {
					let found = this.devices.find((o,i) => { //multiple EEGs get their own atlases just to uncomplicate things. Will need to generalize more later for other multi channel devices with shared preconfigurations if we want to try to connect multiple
						if(o.deviceType === 'eeg'){
							return true;
						}
					});
					if(!found) pipeToAtlas = this.devices[0].atlas;
				}
			}

			this.devices.push(
				new deviceStream(
					device,
					analysis,
					useFilters,
					pipeToAtlas,
					streaming,
					this.socket,
					streamParams,
					this.info.auth
				)
			);

			let i = this.devices.length-1;

			this.devices[i].onconnect = () => {
				onconnect();
				this.onconnected();
			}

			this.devices[i].ondisconnect = () => {
				ondisconnect();
				this.ondisconnected();
				if(Array.isArray(this.devices[i].info.analysis) && this.devices[i].info.analysis.length > 0) {
					this.devices[i].info.analyzing = false; //cancel analysis loop
				}
				this.devices[i].info.streaming = false; //cancel stream loop
				this.devices.splice(i,1);
			}

			this.devices[i].init();

			if(this.devices.length === 1) this.atlas = this.devices[0].atlas; //change over from dummy atlas
			//Device info accessible from state
			this.state.addToState("device"+(i),this.devices[i].info);
			
			this.devices[i].connect();
			this.info.nDevices++;
	}

	onconnected = () => {}

	ondisconnected = () => {}

	reconnect(deviceIdx=this.devices[this.devices.length-1],onconnect=undefined) { //Reconnect a device that has already been added
		if(onconnect !== undefined) { this.devices[deviceIdx].onconnect = onconnect; }
		this.devices[deviceIdx].connect();
	}
	
	//disconnect local device
	disconnect(deviceIdx=this.devices[this.devices.length-1],ondisconnect=()=>{}) {
		this.devices[deviceIdx].info.streaming = false;
		this.devices[deviceIdx].ondisconnect = ondisconnect;
		this.devices[deviceIdx].disconnect();
		this.devices[deviceIdx].splice(deviceIdx,1);
		this.info.nDevices--;
	}

	makeConnectOptions(parentNode=document.body,onconnect=()=>{},ondisconnect=()=>{}) {
		let id = Math.floor(Math.random()*10000)+"connect";
		let html = `<div><span style="font-size: 80%;">Device Selection</span><hr><select id='`+id+`select'></div>`;
	
		html += `<option value="" disabled selected>Choose your device</option>`
	
		let deviceOptions = [
			'muse',
			'freeeeg32_2','freeeeg32_19',
			'hegduinousb','hegduinobt', //,'hegduinowifi',
			'cyton','cyton_daisy'
		];

		deviceOptions.forEach((o,i) => {
			html+= `<option value='`+o+`'>`+o+`</option>`;
		});
		// html += `</select><button id='`+id+`connect'>Connect</button>`;

		parentNode.insertAdjacentHTML('afterbegin',html);

		document.getElementById(id+"select").onchange = () => {
			let val = document.getElementById(id+"select").value;
			if(val === 'muse') {
				this.connect('muse',['eegcoherence'],onconnect,ondisconnect);
			}
			else if (val === 'freeeeg32_2') {
				this.connect('freeeeg32_2',['eegcoherence'],onconnect,ondisconnect);
			}
			else if (val === 'freeeeg32_19') {
				this.connect('freeeeg32_19',['eegfft'],onconnect,ondisconnect);
			}
			else if (val === 'hegduinousb') {
				this.connect('hegduinousb',[],onconnect,ondisconnect);
			}
			else if (val === 'hegduinobt') {
				this.connect('hegduinobt',[],onconnect,ondisconnect);
			}
			else if (val === 'hegduinowifi') {
				this.connect('hegduinowifi',[],onconnect,ondisconnect);
			}
			else if (val === 'cyton') {
				this.connect('cyton',['eegfft'],onconnect,ondisconnect);
			}
			else if (val === 'cyton_daisy') {
				this.connect('cyton_daisy',['eegfft'],onconnect,ondisconnect);
			}
		}
	}

	beginStream(deviceIdx=0,streamParams=null) {
		if(this.devices[deviceIdx].info.streaming ) {
			this.devices[deviceIdx].info.streaming = true;
			if(streamParams !== null) {
				this.devices[deviceIdx].info.streamParams = streamParams;
			}
			this.devices[deviceIdx].streamLoop();
		}
	}

	endStream(deviceIdx=0) {
		this.devices[deviceIdx].info.streaming = false;
	}

	//get the device stream object
	getDevice(deviceNameOrType='freeeeg32_2',deviceIdx=0) {
		let found = undefined;
		this.devices.find((d,i) => {
			if(d.info.deviceName.indexOf(deviceNameOrType) > -1  && d.info.deviceNum === deviceIdx) {
				found = d;
				return true;
			}
			else if (d.info.deviceType.indexOf(deviceNameOrType) > -1 && d.info.deviceNum === deviceIdx) {
				found = d;
				return true;
			}
		});
		return found;
	}

	addAnalysisMode(name='') { //eegfft,eegcoherence,bcijs_bandpower,bcijs_pca,heg_pulse
		if(this.devices.length > 0) {
			let found = this.atlas.settings.analysis.find((str,i) => {
				if(name === str) {
					return true;
				}
			});
			if(found === undefined) {
				this.atlas.settings.analysis.push(name);
				if(this.atlas.settings.analyzing === false) {
					this.atlas.settings.analyzing = true;
					this.atlas.analyzer();
				}
			}
		} else {console.error("no devices connected")}
	}

	stopAnalysis(name='') { //eegfft,eegcoherence,bcijs_bandpower,bcijs_pca,heg_pulse
		if(this.devices.length > 0) {
			if(name !== '' && typeof name === 'string') {
				let found = this.atlas.settings.analysis.find((str,i) => {
					if(name === str) {
						this.atlas.settings.analysis.splice(i,1);
						return true;
					}
				});
			} else {
				this.atlas.settings.analyzing = false;
			}
		} else {console.error("no devices connected")}
	}

	//get data for a particular device	
	getDeviceData = (deviceType='eeg', tag='all', deviceIdx=0) => { //get device data. Just leave deviceIdx blank unless you have multiple of the same device type connected
		this.devices.forEach((d,i) => {
			console.log('get')
			if(d.info.deviceType.indexOf(deviceType) > -1 && d.info.deviceNum === deviceIdx) {
				if(tag === 'all') {
					return d.atlas.data[deviceType]; //Return all objects
				}
				return d.atlas.getDeviceDataByTag(deviceType,tag);
			}
		});
	}

	//Get locally stored data for a particular app or user subcription. Leave propname null to get all data for that sub
	getStreamData(userOrAppname='',propname=null) {
		let o = {};
		for(const prop in this.state.data) {
			if(propname === null) {
				if(prop.indexOf(userOrAppname) > -1) {
					o[prop] = this.state.data[prop];
				}
			}
			else if((prop.indexOf(userOrAppname) > -1) && (prop.indexOf(propname) > -1)) {
				o[prop] = this.state.data[prop];
			}
		}
		return o;
	}

	//listen for changes to atlas data properties
	subscribe = (deviceName='eeg',tag='FP1',prop=null,onData=(newData)=>{}) => {
		let sub = undefined;
		let atlasTag = tag;
		let atlasDataProp = null; //Atlas has an object of named properties based on device or if there is shared data
		if (deviceName.indexOf('eeg') > -1 || deviceName.indexOf('muse') > -1 || deviceName.indexOf('notion') > -1) {//etc
			atlasDataProp = 'eeg';	
			if(atlasTag === 'shared') { atlasTag = 'eeghared'; }
		}
		else if (deviceName.indexOf('heg') > -1) {
			atlasDataProp = 'heg';
			if(atlasTag === 'shared') { atlasTag = 'hegshared'; }
		}
		if(atlasDataProp !== null) { 
			let device = this.devices.find((o,i) => {
				if (o.info.deviceName.indexOf(deviceName) > -1 && o.info.useAtlas === true) {
					let coord = undefined;
					if(atlasTag.indexOf('shared') > -1 ) coord = o.atlas.getDeviceDataByTag(atlasTag,null);
					else if (atlasTag === null || atlasTag === 'all') { coord = o.atlas.data[atlasDataProp]; } //Subscribe to entire data object 
					else coord = o.atlas.getDeviceDataByTag(atlasDataProp,atlasTag);
					
					if(coord !== undefined) {
						if(prop === null || Array.isArray(coord) || typeof coord[prop] !== 'object') {
							sub=this.state.addToState(atlasTag,coord,onData);
						} else if (typeof coord[prop] === 'object') {  //only works for objects which are stored by reference only (i.e. arrays or the means/slices/etc objects, so sub to the whole tag to follow the count)
							sub=this.state.addToState(atlasTag+"_"+prop,coord[prop],onData);
						}
					}
					return true;
				}
			});
		}

		return sub;
	}

	//remove the specified onchange function via the sub index returned from subscribe()
	unsubscribe = (tag='FP1',sub) => {
		this.state.unsubscribe(tag,sub);
	}

	//this will remove the event listener if you don't have any logic associated with the tag (for performance)
	unsubscribeAll = (tag='FP1') => {
		this.state.unsubscribeAll(tag);
	}

	addAnalysisMode(mode='',deviceName=this.state.data.device0.deviceName,n=0) {
		let device = this.getDevice(deviceName,n);
		let found = device.info.analysis.find((s,i) => {
			if(s === mode) {
				return true;
			}
		});
		if(!found) device.info.analysis.push(mode);
		if(!device.atlas.settings.analyzing) {
			device.atlas.settings.analyzing = true;
			device.atlas.analyzer();
		}
	}

	//Add functions to run custom data analysis loops. You can then add functions to gather this data for streaming.
	addAnalyzerFunc(prop=null,callback=()=>{}) {
		this.devices.forEach((o,i) => {
			if(o.atlas !== null && prop !== null) {
				if(o.atlas.analyzerOpts.indexOf(prop) < 0) {
					o.atlas.analyzerOpts.push(prop)
					o.atlas.analyzerFuncs.push(callback);
				}
				else {
					console.error("property "+prop+" exists");
				}
			}
		})
	}

	//Input an object that will be updated with app data along with the device stream.
	streamAppData(name='',props={}) {
		if(this.info.nDevices > 0) {
			let key = name+Math.floor(Math.random()*10000); //Add a little randomization in case you are streaming multiple of the same appname
			let obj = Object.assign({[key+"newData"]:true},props);

			this.state.addToState(key,obj,(newData) => {
				if(!this.state.data[key][key+"newData"]) this.state.data[key][key+"newData"] = true;
			});

			let newStreamFunc = () => {
				if(this.state.data[key][key+"newData"] === true) {
					this.state.data[key][key+"newData"] = false;
					return this.state.data[key];
				}
				else {
					return undefined;
				}
			}

			this.addStreamFunc(key,newStreamFunc);
			this.addStreamParam(['key']);
		}
	}

	//Add functions for gathering data to send to the server
	addStreamFunc(name,callback,idx=0) {
		if(typeof name === 'string' && typeof callback === 'function' && this.devices[idx] !== undefined) {
			this.devices[idx].addStreamFunc(name,callback);
		} else { console.error("addStreamFunc error"); }
	}

	//add a parameter to the stream based on available callbacks [['function','arg1','arg2',etc][stream function 2...]]
	addStreamParam(params=[],idx=0) {
		params.forEach((p,i) => {
			if(Array.isArray(p)) {
				this.devices[idx].info.streamParams.push(p);
			}
		});
	}



	//Server login and socket initialization
	async login(beginStream=false, dict=this.info.auth, baseURL=this.info.auth.url.toString()) {
		//Connect to websocket
		if (this.socket == null  || this.socket.readyState !== 1){
			this.socket = this.setupWebSocket(dict);
			this.info.auth.authenticated = true;
			this.subscribed=true;
			this.info.nDevices++;
		}
		if(this.socket !== null && this.socket.readyState === 1) {
			if(beginStream === true) {
				this.devices.forEach((d,i) => {
					this.beginStream(i);
				});
			}
		}
	} 

	async signup(dict={}, baseURL=this.info.auth.url.toString()) {
		baseURL = this.checkURL(baseURL);
        let json = JSON.stringify(dict);
        let response = await fetch(baseURL.toString() + 'signup',
            {
                method: 'POST',
                mode: 'cors',
                headers: new Headers({
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }),
                body: json
            }).then((res) => {
            return res.json().then((message) => message);
        })
            .then((message) => {
                console.log(`\n`+message);
                return message;
            })
            .catch(function (err) {
                console.error(`\n`+err.message);
            });

        return response;
	}

	async request(body,method="POST",pathname='',baseURL=this.info.auth.url.toString()){
		if (pathname !== ''){
            baseURL = this.checkURL(baseURL);
            pathname = this.checkPathname(pathname);
            let dict = {
                method: method,
                mode: 'cors',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
            };
            
            if (method === 'POST'){
                dict.body = JSON.stringify(body);
            }

            return await fetch(baseURL + pathname, dict).then((res) => {
            return res.json().then((dict) => {                 
                return dict.message;
            })
        })
            .catch(function (err) {
                console.error(`\n`+err.message);
            });
        } else {
            console.error(`You must provide a valid pathname to request resources from ` + baseURL);
            return;
        }
	}

	processSocketMessage(received='') {
		let parsed = JSON.parse(received);
		if(parsed.msg === 'userData') {
			for (const prop in parsed.userData) {
				this.state.data[parsed.username+"_userData"][prop] = parsed.userData[prop]; 
			}
		}
		else if (parsed.msg === 'gameData') {

			if(this.state.data[parsed.appname+"_userData"]) {
				parsed.userData.forEach((o,i) => {
					let found = this.state.data[parsed.appname+"_userData"].find((p,j) => {
						if(p.username === o.username) {
							for(const prop in o) {
								o[prop] === p[prop];
							}
						}
					});
					if(!found) {
						this.state.data[parsed.appname+"_userData"].push(o);
					}
				});
				//Should check if usernames are still present to splice them off but should do it only on an interval
				//this.state.data[parsed.appname+"_userData"].forEach((u,i) => {
				//	let found = parsed.usernames.find((name) => { if(u.username === name) return true; });
				//  if(!found) { this.state.data[parsed.appname+"_userData"].splice(i,1); }
				//});
			}
			else { this.state.data[parsed.appname+"_userData"] = parsed.userData; }
			this.state.data[parsed.appname+"_spectators"] = parsed.spectators;
		}
		else if (parsed.msg === 'getUserDataResult') {
			this.state.data.commandResult = parsed;
		}
		else if (parsed.msg === 'getUsersResult') {		
			this.state.data.commandResult = parsed;
		}
		else if (parsed.msg === 'getGameDataResult') {
			this.state.data.commandResult = parsed;
		}
		else if (parsed.msg === 'getGameInfoResult') {
			this.state.data.commandResult = parsed;
		}
		else if (parsed.msg === 'subscribedToUser') {
			this.state.data.commandResult = parsed;
		}
		else if (parsed.msg === 'userNotFound') {
			this.state.data.commandResult = parsed;
		}
		else if (parsed.msg === 'subscribedToGame') {
			this.state.data.commandResult = parsed;
		}
		else if (parsed.msg === 'leftGame') {
			this.state.data.commandResult = parsed;
		}
		else if (parsed.msg === 'gameDeleted') {
			this.state.data.commandResult = parsed;
		}
		else if (parsed.msg === 'unsubscribed') {
			this.state.data.commandResult = parsed;
		}
		else if (parsed.msg === 'gameNotFound') {
			this.state.data.commandResult = parsed;
		}else if (parsed.msg === 'resetUsername') {
			this.info.auth.username = parsed.username;
		}
		else if (parsed.msg === 'ping') {
		}
		else {
		}
	}

	setupWebSocket(auth=this.info.auth) {

		let socket = null;
        let subprotocol = [
			'username&'+auth.username,
     	   	'password&'+auth.password,
     	   	'appname&'+auth.appname
		];
		if (auth.url.protocol === 'http:') {
            socket = new WebSocket(`ws://` + auth.url.host, subprotocol);
        } else if (auth.url.protocol === 'https:') {
            socket = new WebSocket(`wss://` + auth.url.host, subprotocol);
        } else {
            console.log('invalid protocol');
            return;
		}

        socket.onerror = () => {
            console.log('error');
        };

        socket.onopen = () => {
			console.log('socket opened')
		};

        socket.onmessage = (msg) => {
			console.log('Message recieved: ' + msg.data)
			this.processSocketMessage(msg.data);
        }

        socket.onclose = (msg) => {
            console.log('close');
        }

		return socket;
	}

	subscribeToUser(username='',userProps=[],onsuccess=(newResult)=>{}) { // if successful, props will be available in state under this.state.data['username_prop']
		//check if user is subscribable
		if(this.socket !== null && this.socket.readyState === 1) {
			this.socket.send(JSON.stringify({username:this.info.auth.username,cmd:['getUserData',username]}));
			userProps.forEach((prop) => {
				let p = prop;
				if(Array.isArray(p)) p = prop.join("_"); //if props are given like ['eegch','FP1']
				this.state.data[username+"_"+p] = null; //dummy values so you can attach listeners to expected outputs
			});
			//wait for result, if user found then add the user
			let sub = this.state.subscribe('commandResult',(newResult) => {
				if(typeof newResult === 'object') {
					if(newResult.msg === 'getUserDataResult') {
						if(newResult.username === username) {
							this.socket.send(JSON.stringify({username:this.info.auth.username,cmd:['subscribeToUser',username,userProps]})); //resulting data will be available in state
						}
						onsuccess(newResult);
						this.state.unsubscribe('commandResult',sub);
					}
					else if (newResult.msg === 'userNotFound' && newResult.username === username) {
						this.state.unsubscribe('commandResult',sub);
						console.log("User not found: ", username);
					}
				}
			});
		}
	}

	subscribeToGame(appname=this.info.auth.appname,spectating=false,onsuccess=(newResult)=>{}) {
		if(this.socket !== null && this.socket.readyState === 1) {
			this.socket.send(JSON.stringify({username:this.info.auth.username,cmd:['getGameInfo',appname]}));
			//wait for response, check result, if game is found and correct props are available, then add the stream props locally necessary for game
			let sub = this.state.subscribe('commandResult',(newResult) => {
				if(typeof newResult === 'object') {
					if(newResult.msg === 'getGameInfoResult' && newResult.appname === appname) {
						let configured = true;
						if(spectating === false) {
							//check that this user has the correct streaming configuration with the correct connected device
							let streamParams = [];
							newResult.gameInfo.propnames.forEach((prop) => {
								console.log(prop);
								streamParams.push(prop.split("_"));
							});
							configured = this.configureStreamForGame(newResult.gameInfo.devices,streamParams); //Expected propnames like ['eegch','FP1','eegfft','FP2']
						}
						if(configured === true) {
							this.socket.send(JSON.stringify({username:this.info.auth.username,cmd:['subscribeToGame',this.info.auth.username,appname,spectating]}));
							newResult.gameInfo.usernames.forEach((user) => {
								newResult.gameInfo.propnames.forEach((prop) => {
									this.state.data[appname+"_"+user+"_"+prop] = null;
								});
							});
							onsuccess(newResult);
						}
						this.state.unsubscribe('commandResult',sub);
					}
					else if (newResult.msg === 'gameNotFound' & newResult.appname === appname) {
						this.state.unsubscribe('commandResult',sub);
						console.log("Game not found: ", appname);
					}
				}
			});
		}
	}

	unsubscribeFromUser(username='',userProps=null,onsuccess=(newResult)=>{}) { //unsubscribe from user entirely or just from specific props
		//send unsubscribe command
		if(this.socket !== null && this.socket.readyState === 1) {
			this.socket.send(JSON.stringify({cmd:['unsubscribeFromUser',username,userProps],username:this.info.auth.username}))
			let sub = this.state.subscribe('commandResult',(newResult) => {
				if(newResult.msg === 'unsubscribed' && newResult.username === username) {
					for(const prop in this.state.data) {
						if(prop.indexOf(username) > -1) {
							this.state.unsubscribeAll(prop);
							this.state.data[prop] = undefined;
						}
					}
					onsuccess(newResult);
					this.state.unsubscribe('commandResult',sub);
				}
			});
		}
	}

	unsubscribeFromGame(appname='',onsuccess=(newResult)=>{}) {
		//send unsubscribe command
		if(this.socket !== null && this.socket.readyState === 1) {
			this.socket.send({cmd:['leaveGame',appname],username:this.info.auth.username})
			let sub = this.state.subscribe('commandResult',(newResult) => {
				if(newResult.msg === 'leftGame' && newResult.appname === appname) {
					for(const prop in this.state.data) {
						if(prop.indexOf(appname) > -1) {
							this.state.unsubscribeAll(prop);
							this.state.data[prop] = undefined;
						}
					}
					onsuccess(newResult);
					this.state.unsubscribe('commandResult',sub);
				}
			});
		}
	}

	configureStreamForGame(deviceNames=[],streamParams=[]) { //Set local device stream parameters based on what the game wants
		let params = [];
		streamParams.forEach((p,i) => {
			if(p[2] === undefined)
				params.push([p[0],p[1],'all']);
			else params.push([...p]);
		});
		let d = undefined;
		deviceNames.forEach((name,i) => { //configure named device
			d = this.devices.find((o,j) => {
				if(o.info.deviceName.indexOf(name) > -1) {
					if(o.socket === null) o.socket = this.socket;
					let deviceParams = [];
					params.forEach((p,k) => {
						if(p[0].indexOf(o.info.deviceType) > -1) { //stream parameters should have the device type specified (in case multiple devices are involved)
							deviceParams.push(p);
						}
					});
					o.info.streamParams = deviceParams;
					o.info.streaming = true;
					if(o.info.streamCt === 0) {
						o.streamLoop();
					}
					return true;
				}
			});
		});
		if(d === undefined) {
			console.error('Compatible device not found');
			return false;
		}
		else {
			return true;
		}
	}

	sendWSCommand(command='',dict={}){
		if(this.socket != null  && this.socket.readyState === 1){
				let o = {cmd:command,username:this.info.auth.username};
				Object.assign(o,dict);
				let json = JSON.stringify(o);
				console.log('Message sent: ', json);
				this.socket.send(json);
		}
	}

	closeSocket() {
		this.socket.close();
	}

	onconnectionLost(response){ //If a user is removed from the server
		let found = false; let idx = 0;
		let c = this.info.connections.find((o,i) => {
			if(o.username === response.username) {
				found = true;
				return true;
			}
		});
		if (found === true) {
			this.info.connections.splice(idx,1);
			this.info.nDevices--;
		}
	}

	checkURL(url) {
        if (url.slice(-1) !== '/') {
            url += '/';
        }
        return url;
    }

	checkPathname(pathname) {
        if (pathname.slice(0) === '/') {
            pathname.splice(0,1);
        }
        return pathname;
    }

}

//-------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------

//Class for handling local device streaming as well as automating data organization/analysis and streaming to server.
class deviceStream {
	constructor(
		device="freeeeg32_2",
		analysis=['eegfft'],
		useFilters=true,
		pipeToAtlas=true,
		streaming=false,
		socket=null,
		streamParams=[],
		auth={
			username:'guest'
		}
	) {

		this.info = {
			deviceName:device,
			deviceType:null,
			streaming:streaming,
			streamParams:streamParams, //[['eegch','FP1','all'],['eegfft','AF7','all']]
			analysis:analysis, //['eegcoherence','eegfft' etc]

			deviceNum:0,
			streamLoopTiming:100, //ms between update checks
			streamCt:0,

			auth:auth,
			sps: null,
			useFilters:useFilters,
			useAtlas:false,
			simulating:false
		};

		this.device = null, //Device object, can be instance of eeg32, MuseClient, etc.
		
		this.deviceConfigs = [
			{  name:'freeeeg32',   cls:eeg32Plugin        },
			{  name:'muse', 	   cls:musePlugin         },
			{  name:'hegduino',    cls:hegduinoPlugin 	  },
			{  name:'cyton', 	   cls:cytonPlugin	      },
			{  name:'webgazer',    cls:webgazerPlugin     }
		];

		this.socket = socket;
		//console.log(this.socket);
		
		this.streamTable=[]; //tags and callbacks for streaming
		this.filters = [];   //BiquadChannelFilterer instances 
		this.atlas = null;
		this.pipeToAtlas = pipeToAtlas;

		//this.init(device,useFilters,pipeToAtlas,analysis);
	}

	init = (info=this.info, pipeToAtlas=this.pipeToAtlas) => {
		this.deviceConfigs.find((o,i) => {
			if(info.deviceName.indexOf(o.name) > -1 ) {
				this.device = new o.cls(info.deviceName,this.onconnect,this.ondisconnect);
				this.device.init(info,pipeToAtlas);
				this.atlas = o.atlas;
				this.filters = o.filters;
				if(this.atlas !== null) {
					this.configureDefaultStreamTable();
					if(this.info.streaming === true) this.streamLoop();
				}

				return true;
			}
		});
	}

	connect = () => {
		this.device.connect();
	}

	disconnect = () => {
		this.device.disconnect();
	}

	//Generic handlers to be called by devices, you can stage further processing and UI/State handling here
	onconnect(msg="") {}

	ondisconnect(msg="") {}

	configureDefaultStreamTable(params=[]) {
		//Stream table default parameter callbacks to extract desired data from the data atlas
		let getEEGChData = (channel,nSamples='all') => {
			let get = nSamples;
			if(this.info.useAtlas === true) {
				let coord = false;
				if(typeof channel === 'number') {
					coord = this.atlas.getEEGDataByChannel(channel);
				}
				else {
					coord = this.atlas.getEEGDataByTag(channel);
				}
				if(coord !== undefined) { 
					if(get === 'all') {
						if(coord.count === 0) return undefined;
						get = coord.count-coord.lastRead;
						coord.lastRead = coord.count; //tracks count of last reading for keeping up to date
						if(get === 0) return undefined;
					}
					if (coord.filtered.length > 0) {
						let times = coord.times.slice(coord.times.length - get,coord.times.length);
						let samples = coord.filtered.slice(coord.filtered.length - get,coord.filtered.length);
						return {times:times, samples:samples};
					}
					else if (coord.raw.length > 0){
						let times = coord.times.slice(coord.times.length - get,coord.times.length);
						let samples = coord.raw.slice(coord.raw.length - get,coord.raw.length);
						return {times:times, samples:samples};
					}
					else {
						return undefined;
					}
				}
				else {
					return undefined;
				}
			}
		}

		let getEEGFFTData = (channel,nArrays='all') => {
			let get = nArrays;
			if(this.info.useAtlas === true) {
				let coord = false;
				if(typeof channel === 'number') {
					coord = this.atlas.getEEGFFTData(channel);
				}
				else {
					coord = this.atlas.getEEGDataByTag(channel);
				}
				if(coord !== undefined) {
					if(get === 'all') {
						if(coord.fftCount === 0) return undefined;
						get = coord.fftCount-coord.lastReadFFT;
						coord.lastReadFFT = coord.fftCount;
						if(get === 0) return undefined;
					}
					let fftTimes = coord.fftTimes.slice(coord.fftTimes.length - get, coord.fftTimes.length);
					let ffts = coord.ffts.slice(coord.ffts.length - get,coord.ffts.length);
					return {times:fftTimes, ffts:ffts};
				}
				else {
					return undefined;
				}
			}
		}

		let getCoherenceData = (tag, nArrays='all') => {
			let get = nArrays;
			if(this.info.useAtlas === true) {
				let coord = this.atlas.getCoherenceByTag(tag);
				if(get === 'all') {
					if(coord.fftCount === 0) return undefined;
					get = coord.fftCount-coord.lastRead;
					coord.lastRead = coord.fftCount;
					if(get === 0) return undefined;
				}
				if(coord !== undefined) {
					let cohTimes = coord.times.slice(coord.fftTimes.length - get, coord.fftTimes.length);
					let ffts = coord.ffts.slice(coord.ffts.length - get,coord.ffts.length);
					return {times:cohTimes, ffts:ffts};
				}
				else {
					return undefined;
				}
			}
		}

		let getHEGData = (tag=0,nArrays='all',prop=null) => {
			let get = nArrays;
			if(this.info.useAtlas === true) {
				let coord = this.atlas.getDeviceDataByTag('heg',tag);
				if(get === 'all') {
					get = coord.count-coord.lastRead;
					coord.lastRead = coord.count;
					if(get <= 0) return undefined;
				}
				if(coord !== undefined) {
					if(prop !== null) {
						let times = coord.times.slice(coord.times.length - get, coord.times.length);
						let data = coord[prop].slice(coord.ffts.length - get,coord.ffts.length);
						let obj = {times:times}; obj[prop] = data;
						return obj;
					}
					else return coord;
				}
				else {
					return undefined;
				}
			}
		}

		this.streamTable = [
			{prop:'eegch',  		callback:getEEGChData	 	},
			{prop:'eegfft', 		callback:getEEGFFTData	 	},
			{prop:'eegcoherence', 	callback:getCoherenceData	},
			{prop:'hegdata',        callback:getHEGData			}
		];

		if(params.length > 0) {
			this.streamTable.push(...params);
		}
	} 

	addStreamFunc(name = '',callback = () => {}) {
		this.streamtable.push({prop:name,callback:callback});
	}

	configureStreamParams(params=[['prop','tag']]) { //Simply defines expected data parameters from the user for server-side reference
		let propsToSend = [];
		params.forEach((param,i) => {
			propsToSend.push(param.join('_'));
		});
		this.socket.send(JSON.stringify({cmd:['addProps',propsToSend],username:this.info.auth.username}));
	}

	//pass array of arrays defining which datasets you want to pull from according to the available
	// functions and additional required arguments from the streamTable e.g.: [['EEG_Ch','FP1',10],['EEG_FFT','FP1',1]]
	sendDataToSocket = (params=[['prop','tag','arg1']],dataObj={}) => {
		let streamObj = {
			username:this.info.auth.username,
			userData:{}
		};
		Object.assign(streamObj.userData,dataObj); //Append any extra data not defined by parameters from the stream table
		params.forEach((param,i) => {
			this.streamTable.find((option,i) => {
				if(param[0].indexOf(option.prop) > -1) {
					let args = param.slice(1);
					let result = option.callback(...args);
					if(result !== undefined) {
						let prop = '';
						streamObj.userData[param.join('_')] = result;
					}
					return true;
				}
			});
		});
		if(Object.keys(streamObj.userData).length > 0) {
			this.socket.send(JSON.stringify(streamObj));
		}
	}

	streamLoop = (prev={}) => {
		if(this.info.streaming === true) {
			let params = [];
			if(this.info.streamParams.length === 0) { console.error('No stream parameters set'); return false;}
			this.info.streamParams.forEach((param,i) => {
				let c = this.streamTable.find((o,i) => {
					if(o.prop === param[0]) {
						params.push(param);
						return true;
					}
				});
			});
			//console.log(params);
			if(params.length > 0) { this.sendDataToSocket(params); }
			this.info.streamCt++;
			setTimeout(() => {this.streamLoop();}, this.info.streamLoopTiming);
		}
		else{
			this.info.streamCt = 0;
		}
	}

	simulateData() {
		let delay = 100;
		if(this.info.simulating === true) {
			let nSamplesToSim = Math.floor(this.info.sps*delay/1000);
			for(let i = 0; i<nSamplesToSim; i++) {
				//For each tagged channel generate fake data
				//let sample = Math.sin(i*Math.PI/180);
			}
			setTimeout(requestAnimationFrame(this.simulateData),delay);
		}
	}


}

