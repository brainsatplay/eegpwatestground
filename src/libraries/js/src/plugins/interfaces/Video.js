export class Video {

    static id = String(Math.floor(Math.random() * 1000000))

    constructor(label, session, params = {}) {
        this.label = label
        this.session = session
        


        this.props = {
            id: String(Math.floor(Math.random() * 1000000)),
            focusVideo: 0,
            videos: [],
            done: false
        };

        // Create Video Player
        this.container = document.createElement('div');
        this.container.id = this.props.id
        this.container.style = `
        position: relative;
        width: 100%;
        height: 100%;
        `

        this.container.onload = this.setup
        this.container.onresize = this.responsive

        let defaultVideoURLs = ['https://vjs.zencdn.net/v/oceans.mp4']

        this.ports = {
            url: {
                data: defaultVideoURLs[0],
                input: { type: 'string' },
                output: { type: null },
                onUpdate: (user) => {
                    this.ports.url.data = user.data
                    this.session.graph.runSafe(this, 'files', { data: [this.ports.url.data] })
                }
            },
            files: {
                input: { type: 'file', accept: "video/*", multiple: true },
                output: { type: null },
                data: defaultVideoURLs,
                onUpdate: (user) => {
                    if (user.data){
                        this.props.focusVideo = 0
                        this.ports.files.data = this.shuffle(Array.from(user.data))

                        // Create Videos
                        let prevTimes = []
                        this.props.videos.forEach(el => {
                            // if (user.meta.replace === true) 
                            prevTimes.push(el.currentTime)
                            el.remove()
                        })
                        this.props.videos = []
                        this.props.filePool = []
                        this.ports.files.data.forEach((file, i) => {
                            this.props.filePool.push(file)
                        })

                        let maxVideos = this.props.filePool.length

                        for (let i = 0; i < maxVideos; i++) {
                            let video = document.createElement('video')
                            video.type = 'video/mp4'
                            video.width = '100%'
                            video.height = '100%'
                            video.style = `
                                position: absolute;
                                top: 0;
                                left: 0;
                            `
                            video.muted = true
                            video.loop = true
                            video.autoplay = true
                            video.style.transition = 'opacity 0.1s'
                            video.addEventListener('timeupdate', () => {
                                if (video.currentTime > video.duration - 0.1) this.props.done = true // Done 100ms before completion
                            })
                            this.props.videos.push(video)
                            this.container.insertAdjacentElement('beforeend', video)
                            this.startVideoFile(video, this.props.filePool[i])
                            if (i != this.props.focusVideo) video.style.opacity = 0
                            video.addEventListener('loadedmetadata', function() {
                                video.currentTime = prevTimes[i] ?? 0
                            }, false);
                        }

                        this.responsive()
                    }
                }
            },
            element: {
                input: { type: null },
                output: { type: Element },
                data: this.container,
                onUpdate: () => {
                    this.ports.element.data = this.container
                    return {data: this.container}
                }
            },
            change: {
                input: { type: 'boolean' },
                output: { type: null },
                onUpdate: (user) => {
                    if (user.data && this.ports.cut.data) {

                        // Increment Counters
                        this.props.focusVideo++
                        this.props.focusVideo = this.props.focusVideo % this.props.videos.length

                        // Switch Displayed Video
                        this.changeFocus()
                    }
                }
            }
        }

        let portInfo = [
            // Update Fade Parameters and Button
            {
                name: 'ui', onUpdate: () => {
                    if (!this.ports.ui.data) {
                        document.getElementById(this.props.id + "useui").innerHTML = "Show UI";
                        document.getElementById(this.props.id + "useui").style.opacity = 0.3
                        document.getElementById(this.props.id + "vidbuttons").style.display = "none";
                        document.getElementById(this.props.id + "timeDiv").style.display = "none";
                        document.getElementById(this.props.id + "fs").style.display = "none";
                    }
                    else {
                        document.getElementById(this.props.id + "useui").innerHTML = "Hide UI";
                        document.getElementById(this.props.id + "useui").style.opacity = 1.0
                        document.getElementById(this.props.id + "vidbuttons").style.display = "";
                        document.getElementById(this.props.id + "timeDiv").style.display = "";
                        document.getElementById(this.props.id + "fs").style.display = "";
                    }
                }
            },
            {
                name: 'fade', data: false, onUpdate: () => {
                    if (this.ports.fade.data == false) {
                        this.alpha = 0;
                        document.getElementById(this.props.id + "usefade").style.opacity = "0.3";
                    }
                    else { document.getElementById(this.props.id + "usefade").style.opacity = "1.0"; }
                }
            },

            // Update Speed Parameters and Button
            {
                name: 'speed', data: false, onUpdate: () => {
                    if (this.ports.speed.data == false) {
                        this.playRate = 1;
                        document.getElementById(this.props.id + "usespeed").style.opacity = "0.3";
                    }
                    else {
                        this.ports.time.data = false;
                        this.playRate = 1;
                        document.getElementById(this.props.id + "usespeed").style.opacity = "1.0";
                        document.getElementById(this.props.id + "usetime").style.opacity = "0.3";
                    }
                    this.props.videos.forEach(el => el.playbackRate = this.playRate)
                }
            },

            // Update Volume Parameters and Button
            {
                name: 'volume', data: false, onUpdate: () => {
                    if (this.ports.volume.data == false) {
                        this.ports.volume.data = false;
                        this.volume = 0;
                        document.getElementById(this.props.id + "usevolume").style.opacity = "0.3";
                    }
                    else {
                        this.ports.volume.data = true;
                        this.volume = 0.5;
                        document.getElementById(this.props.id + "usevolume").style.opacity = "1.0";
                    }

                    this.props.videos.forEach(el => el.muted = !this.ports.volume.data)
                    this.props.videos.forEach(el => el.volume = this.volume)

                }
            },

            // Update Time Parameters and Button
            {
                name: 'time', data: false, onUpdate: () => {
                    if (this.ports.time.data == false) {
                        this.playRate = 1;
                        document.getElementById(this.props.id + "usetime").style.opacity = "0.3";
                    }
                    else {
                        this.ports.speed.data = false;
                        this.playRate = 0;
                        document.getElementById(this.props.id + "usespeed").style.opacity = "0.3";
                        document.getElementById(this.props.id + "usetime").style.opacity = "1.0";
                    }
                    this.props.videos.forEach(el => el.playbackRate = this.playRate)
                }
            },

            {
                name: 'cut', data: false, onUpdate: () => {
                    if (this.ports.cut.data == false) {
                        document.getElementById(this.props.id + "usecut").style.opacity = "0.3";
                    }
                    else {
                        document.getElementById(this.props.id + "usecut").style.opacity = "1.0";
                    }
                }
            },
        
        
        ]
        portInfo.forEach(o => {
            this.ports[o.name] = {
                edit: true, // false
                data: o.data,
                input: { type: 'boolean' },
                output: { type: null },
                onUpdate: (user) => {
                    this.ports[o.name].data = user.data
                    o.onUpdate()
                }
            }
        })

        this.looping = false;

        this.playRate = 1;
        this.alpha = 0;
        this.volume = 0.5;

        this.ampScore = 0;
        this.ampThreshold = 0;
        this.diff = 0;

        this.enableControls = false;
        this.animationId = null;
        this.c;
        this.gl;

        this.sliderfocus = false;

        this.cohScore = undefined; //for getting coherence
    }

    init = () => {

        //HTML render function, can also just be a plain template string, add the random ID to named divs so they don't cause conflicts with other UI elements
        this.container.insertAdjacentHTML('beforeend', `
                <div id="`+ this.props.id + `menu" style='position:absolute; z-index:4; top: 0; left: 0;'>
                    <button id="`+ this.props.id + `useui" style="opacity: 0.3;" >Show UI</button>
                    <input id="`+ this.props.id + `fs" style="display: none;" type="file" accept="video/*" multiple/>
                    <div id="${this.props.id}message"></div>
                    <div id="`+ this.props.id + `timeDiv" style="display: none;"><input id="` + this.props.id + `timeSlider" type="range" min="0" max="1000" value="0"><br><br> 
                    <div id="`+ this.props.id + `vidbar"><button id="` + this.props.id + `minus1min">--</button><button id="` + this.props.id + `minus10sec">-</button><button id="` + this.props.id + `play">||</button><button id="` + this.props.id + `plus10sec">+</button><button id="` + this.props.id + `plus1min">++</button></div></div> 
                    <div id="`+ this.props.id + `vidbuttons" style="display: none;">
                        <table> 
                          <tr><td>Feedback:</td></tr> 
                          <tr><td><button id="`+ this.props.id + `usefade">Fade</button></td></tr> 
                          <tr><td><button id="`+ this.props.id + `usespeed">Speed</button></td></tr> 
                          <tr><td><button id="`+ this.props.id + `usevolume">Volume</button></td></tr> 
                          <tr><td><button id="`+ this.props.id + `usetime">Time</button></td></tr> 
                          <tr><td><button id="`+ this.props.id + `usecut">Cut</button></td></tr> 
                        </table>
                    </div>
                </div> 
                <canvas id="`+ this.props.id + `canvas" height=100% width=100% style='position:absolute; z-index:2; top: 0; left: 0'></canvas>
            </div> 
          `
        )

    }

    deinit = () => {
        this.looping = false;
        this.stopVideo();
        cancelAnimationFrame(this.animationId);
    }

    setup = () => {
        if (this.ports.ui.data === false) document.getElementById(this.props.id + "useui").style.display = 'none'

        this.c = document.getElementById(this.props.id + 'canvas');
        this.gl = this.c.getContext("webgl");
        this.timeSlider = document.getElementById(this.props.id + "timeSlider");

        this.localFileVideoPlayer();

        document.getElementById(this.props.id + "play").onclick = () => {
            if (this.playRate == 0) {
                if (this.ports.speed.data != true) this.playRate = 1;
                document.getElementById(this.props.id + "play").innerHTML = "||";
            }
            else {
                document.getElementById(this.props.id + "play").innerHTML = ">";
            }
            this.props.videos.forEach(el => el.playbackRate = this.playRate)

        }

        let effects = ['fade', 'speed','volume', 'time', 'cut', 'ui']
        effects.forEach(str => {
            let el = document.getElementById(this.props.id + `use${str}`)
            el.onclick = () => {
                this.session.graph.runSafe(this, str, { data: !this.ports[str].data })
                el.blur()
            }
            this.session.graph.runSafe(this, str, { data: this.ports[str].data }) // Pass default values
        })

        this.timeSlider.addEventListener("change", () => {
            let duration
            this.props.videos.forEach(el => {
                if (duration) duration = Math.min(duration, el.duration)
                else duration = el.duration
            })

            // Calculate the new time
            let time = duration * (this.timeSlider.value / 1000);

            // Update video times
            this.props.videos.forEach(el => el.currentTime = time)
        });

        this.timeSlider.onmousedown = () => {
            this.sliderfocus = true;
        }

        this.timeSlider.ontouchstart = () => {
            this.sliderfocus = true;
        }

        this.timeSlider.onchange = () => {
            this.sliderfocus = false;
        }

        document.getElementById(this.props.id + "minus1min").onclick = () => {
            this.props.videos.forEach(el => el.currentTime -= 60)
        }
        document.getElementById(this.props.id + "plus1min").onclick = () => {
            this.props.videos.forEach(el => el.currentTime += 60)
        }
        document.getElementById(this.props.id + "minus10sec").onclick = () => {
            this.props.videos.forEach(el => el.currentTime -= 10)
        }
        document.getElementById(this.props.id + "plus10sec").onclick = () => {
            this.props.videos.forEach(el => el.currentTime += 10)
        }

        this.looping = true;
        this.session.graph.runSafe(this, 'files', { data: this.ports.files.data }) // Initialize default files
        this.initVideos();
    }

    responsive = () => {
        this.props.videos.forEach(el => {
            el.width = el.parentNode.clientWidth;
            el.height = el.parentNode.clientHeight;
        })
        // this.c.width = this.app.AppletHTML.node.clientWidth;
        // this.c.height = this.app.AppletHTML.node.clientHeight;
    }




    startVideo = () => {
        this.props.videos.forEach(el => {
            if (this.playRate < 0.1) { el.playbackRate = 0; }
            else { el.playbackRate = this.playRate; }
        })
    }

    stopVideo = () => {
        this.props.videos.forEach(el => el.playbackRate = 0)
    }

    startVideoFile = (element, file) => {
        'use strict'
        var URL = window.URL || window.webkitURL;
        if (file) {
            var fileURL
            if (typeof file === 'string') fileURL = file
            else {
                var type = file.type;
                var canPlay = element.canPlayType(type);
                if (canPlay === '') { canPlay = 'no'; }
                var message = 'Can play type "' + type + '": ' + canPlay;
                var isError = canPlay === 'no';
                if (isError) {
                    return;
                }

                fileURL = URL.createObjectURL(file);
            }

            this.props.videos.find((el, i) => {
                if (el === element) {
                    return true
                }
            })

            element.src = fileURL;
            element.setAttribute('data-file', this.stringifyFile(file))
        }
    }

    stringifyFile = (file) => {
        let newObject = {
            'lastModified': file.lastModified,
            'lastModifiedDate': file.lastModifiedDate,
            'name': file.name,
            'size': file.size,
            'type': file.type
        };
        return JSON.stringify(newObject)
    }


    localFileVideoPlayer = () => {
        var playSelectedFiles = (event) => {
            this.session.graph.runSafe(this, 'files', { data: event.target.files })
            inputNode.blur()
        }
        var inputNode = document.getElementById(this.props.id + 'fs');
        inputNode.addEventListener('change', playSelectedFiles, false);
    }

    onData(score) {
        if (this.ports.fade.data == true) {
            if (((this.alpha < 0.8) || (score > 0)) && ((this.alpha > 0) || (score < 0))) {
                if (this.alpha - score < 0) {
                    this.alpha = 0;
                }
                else if (this.alpha - score > 0.8) {
                    this.alpha = 0.8;
                }
                else {
                    this.alpha -= score;
                }
            }
        }

        this.props.videos.forEach(el => {
            if (this.ports.speed.data == true) {
                if (((el.playbackRate < 3) || (score < 0)) && ((el.playbackRate > 0) || (score > 0))) {
                    this.playRate = el.playbackRate + score * 0.5;
                    if ((this.playRate < 0.05) && (this.playRate > 0)) {
                        el.playbackRate = 0;
                    }
                    else if (this.playRate < 0) {
                        el.currentTime += score;
                    }
                    else if ((this.playRate > 0.05) && (this.playRate < 0.1)) {
                        el.playbackRate = 0.1;
                    }
                    else {
                        el.playbackRate = this.playRate;
                    }
                }
            }
            if (this.ports.volume.data == true) {
                if (((el.volume < 1) || (score < 0)) && ((el.volume > 0) || (score > 0))) {
                    this.volume = el.volume + score * 0.5;
                    if (this.volume < 0) {
                        el.volume = 0;
                    }
                    else if (this.volume > 1) {
                        el.volume = 1;
                    }
                    else {
                        el.volume = this.volume;
                    }
                }
            }
            if (this.ports.time.data == true) {
                el.currentTime += score * 10;
            }
        })
    }

    animate = () => {
        if (this.looping === true) {

            if ((this.sliderfocus == false)) {

                // Get Min of All Videos
                let currentTime, duration
                this.props.videos.forEach(el => {
                    if (currentTime) currentTime = Math.min(currentTime, el.currentTime)
                    else currentTime = el.currentTime

                    if (duration) duration = Math.min(duration, el.duration)
                    else duration = el.duration
                })
                // Move Slider
                this.timeSlider.value = Math.floor(1000 * currentTime / duration);
            }

            if (this.session.atlas.settings.heg) {
                let ct = this.session.atlas.data.heg[0].count;
                if (ct > 1) {
                    let avg = 40; if (ct < avg) { avg = ct; }
                    let slice = this.session.atlas.data.heg[0].ratio.slice(ct - avg);
                    let score = this.session.atlas.data.heg[0].ratio[ct - 1] - this.session.atlas.mean(slice);
                    this.onData(score);
                }
            }
            else if (this.session.atlas.settings.eeg && this.session.atlas.settings.analysis.eegcoherence) {
                this.cohScore = this.session.atlas.getCoherenceScore(this.session.atlas.getFrontalCoherenceData(), 'alpha1')
                this.onData(this.cohScore);
            }

            this.gl.clearColor(0, 0, 0.01, this.alpha);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            setTimeout(() => { this.animationId = requestAnimationFrame(this.animate); }, 15);
        }
    }


    initVideos() {
        this.props.videos.forEach((el, i) => {

            if (this.ports.volume.data == true) {
                el.muted = false;
                el.volume = 0.5;
                this.volume = 0.5;
            }

            // this.c.width = el.width;
            // this.c.height = el.height;
            // var rect = el.getBoundingClientRect();
            // this.gl.clearColor(0,0,0.1,0);
            // this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.startVideoFile(el, this.ports.files.data[i])
        })
        this.animate();
    }

    changeFocus = (focus = this.props.focusVideo) => {
        this.props.focusVideo = focus
        let frameArr = []
        this.props.videos.forEach((el, i) => {
            if (i === this.props.focusVideo) el.style.opacity = 1
            else el.style.opacity = 0

            frameArr.push(el.getVideoPlaybackQuality().totalVideoFrames)
        })
    }

    shuffle(array) {
        var currentIndex = array.length, randomIndex;

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {

            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            // And swap it with the current element.
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]];
        }

        return array;
    }
}