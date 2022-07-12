import * as brainsatplay from '../../src/core/src/index'
import appInfo from '../../../brainsatplay-starter-kit/app/index.js'
import test from './.brainsatplay/test.json' assert {type: 'json'};
import seconds from '../../../brainsatplay-starter-kit/app/nodes/seconds/index.js'
import sine from '../../../brainsatplay-starter-kit/app/nodes/sine/index.js'
import filter from '../../../brainsatplay-starter-kit/app/nodes/filter/index.js'
import fft from '../../../brainsatplay-starter-kit/app/nodes/fft/index.js'
import bandpower from '../../../brainsatplay-starter-kit/app/nodes/bandpower/index.js'
import ratio from '../../../brainsatplay-starter-kit/app/nodes/ratio/index.js'
import webrtc from '../../../brainsatplay-starter-kit/app/nodes/webrtc/index.js'
import circles from '../../../brainsatplay-starter-kit/app/nodes/webrtc/index.js'

const method = 2

// ------------------- Method #1: Dynamic Import -------------------
// NOTE: Only works when all files are served to the browser

if (method === 0){
    const src = 'app'
    const app = new brainsatplay.App(src)
    app.start().then(() => console.log(app))
} 

// ------------------- Method #2: Direct Import -------------------
else if (method === 1){
console.log('test', test)

const src = {
    graph: appInfo.graph,
    plugins: {
        seconds,
        sine,
        filter,
        fft,
        bandpower,
        ratio,
        webrtc,
        circles
    }
}

const app = new brainsatplay.App(src)
app.start().then(res => {
    console.log('Started!', app, res)
})
} 

// ------------------- Method #3: Remote URL -------------------
else if (method === 2){
    const remoteURL = 'https://raw.githubusercontent.com/brainsatplay/brainsatplay-starter-kit/nightly'
    const remote = new brainsatplay.App(remoteURL)
    remote.start().then(() => console.log(remote))
}