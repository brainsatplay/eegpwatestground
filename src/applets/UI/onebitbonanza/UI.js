import logo from '../../../platform/assets/logo_and_sub(v3).png'
import nasa from '../../../platform/assets/nasa.jpg'
import {appletManifest} from '../../../platform/appletManifest'
import {Application} from '../../../libraries/js/src/Application'

import { getApplet, getAppletSettings} from "../../../platform/js/general/importUtils"

let bonanzaApps = Object.assign({},appletManifest)
Object.keys(bonanzaApps).forEach(k => {
    if(!bonanzaApps[k].folderUrl.includes('/Bonanza/')) delete bonanzaApps[k]
})


class UI{

    static id = String(Math.floor(Math.random()*1000000))

    constructor(label, session, params={}) {

        // Generic Plugin Attributes
        this.label = label
        this.session = session

        // UI Identifier
        this.props = {
            id: String(Math.floor(Math.random()*1000000)),
            currentApplet: null,
            animation: null,
            mode: 'timer', // or button
            ui: null,
            countdown: null,
        }

        // Port Definition
        this.ports = {
            default: {},
            timeLimit: {
                data: 60, // 60 Seconds
                options: null,
                min: 0,
                max: 60*10, // 10 Minutes
                step: 0.5
            }
        }
    }

    init = () => {

        let HTMLtemplate = () => {
            return `
            <div id='${this.props.id}' style='height:100%; width:100%; position: relative;'>
                <div id='${this.props.id}-ui' style='position: absolute; top: 0; left: 0; height:100%; width:100%; z-index: 1; pointer-events:none;'>
                    <div id='${this.props.id}-mask' style="position:absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${nasa}); background-position: center; background-repeat: no-repeat; background-size: cover; pointer-events: none;opacity: 0; pointer-events: none; display: flex; align-items: center; justify-content: center;">
                        <img src='${logo}' style="width: 50%;">
                    </div>
                </div>
                <div id='${this.props.id}-applet' style='position: absolute; top: 0; left: 0; height:100%; width:100%; z-index: 0'></div>
            </div>`
        }


        let setupHTML = (app) => {

            this.props.ui = document.getElementById(`${this.props.id}-ui`)

            if (this.props.mode == 'button'){
                this.props.ui.innerHTML +=   `<button id='${this.props.id}-randomize' style="pointer-events:auto;position:absolute; top: 25px; right: 25px;">Randomize</button>`
                document.getElementById(`${props.id}-randomize`).onclick = () => {
                    this._setNewApplet()
                };   
            } else if (this.props.mode == 'timer'){
                this.props.ui.innerHTML += `<h2 id='${this.props.id}-countdown' style="pointer-events:auto;position:absolute; top: 25px; right: 25px; margin: 0px;">0:00</h2>`
                this.props.countdown = document.getElementById(`${this.props.id}-countdown`)
            }

            this._setNewApplet()

            this._animate = () => {
                if (this.props.currentApplet != null && this.props.mode == 'timer'){

                    let actualLimit = Math.max(this.ports.timeLimit.data, this.props.currentApplet.settings.bonanza.minTime)

                    let timeLeft = actualLimit - (Date.now() - this.props.currentApplet.tInit)/1000
                    if (this.props.currentApplet.tUp == false){
                        this.props.countdown.innerHTML = Math.max(0, timeLeft).toFixed(2)
                        if (timeLeft <= 0){
                            this.props.currentApplet.tUp = true
                            this._setNewApplet()
                        } 
                    } else {
                        this.props.countdown.innerHTML = (0).toFixed(2)
                    }
                }
                this.props.animation = requestAnimationFrame(this._animate)
            }
    
            this._animate()

        }

        return {HTMLtemplate, setupHTML}
    }

    deinit = () => {

        if (this.props.urrentApplet != null) this.props.currentApplet.instance.deinit();
        cancelAnimationFrame(this.props.animation);
    }

    // Ports

    default = (user) => {
        return user
    }

    // Helper Functions

    _createInstance = (appletCls, info=undefined) => {
        let parentNode = document.getElementById(`${this.props.id}-applet`)
        if (appletCls === Application){
            delete info.intro // Never show intro
            return new Application(info, parentNode, this.session, [])
        } else {
            return new appletCls(parentNode, this.session, [])
        }
    }

    _setNewApplet = () => {

        let mask = document.getElementById(`${this.props.id}-mask`)
        // Transition
        mask.style.opacity = 1;
        mask.style.pointerEvents = 'none';
        let transitionLength = 500
        mask.style.transition = `opacity ${transitionLength/1000}s`;

        // Reset
        setTimeout(async ()=>{
            let [applet,settings] = await this._getNewApplet()
            if (this.props.currentApplet != null) this.props.currentApplet.instance.deinit()
            this.props.currentApplet = {
                tInit: Date.now(),
                instance: this._createInstance(applet, settings),
                settings,
                tUp: false
            }
            this.props.currentApplet.instance.init()
            this.props.currentApplet.instance.responsive();
        },transitionLength);

        // Display
        setTimeout(()=>{
            mask.style.opacity = 0;
            mask.style.auto = 'auto';
        },transitionLength+500);

    }

    _getNewApplet = async () => {
        let appletKeys = Object.keys(bonanzaApps)
        let settings = Object.assign({}, await getAppletSettings(bonanzaApps[appletKeys[Math.floor(Math.random() * appletKeys.length)]].folderUrl))
        // Check that the chosen applet is not prohibited, compatible with current devices, and not the same applet as last time
        let compatible = true
        let instance;
        if (this.props.currentApplet != null) instance = this.props.currentApplet.instance
        this.session.deviceStreams.forEach((device) => {
            if (!settings.devices.includes(device.info.deviceType) && !settings.devices.includes(device.info.deviceName) && instance instanceof applet) compatible = false
        })
        let applet;
        if (!compatible) applet = await this._getNewApplet()
        else applet = await getApplet(settings)

        return [applet,settings]
    }
}

export {UI}