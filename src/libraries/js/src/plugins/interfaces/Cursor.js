import {transformCSSForBCICursor} from '../../ui/cssForBCI'

export class Cursor{

    static id = String(Math.floor(Math.random()*1000000))
    
    constructor(label, session, params={}) {
        this.label = label
        this.session = session

        this.props = {
            cursorSize: {
                width: 15,
                height: 20
            },
            prevHovered: null,
            globalStyles: [],
            transformCSS: transformCSSForBCICursor,
            px: null,
            py: null,
            x: window.innerWidth/2,
            y:window.innerHeight/2
        }

        this.ports = {
            robot: {data: false},
            click: {
                input: {type: 'boolean'},
                output: {type: null},
                onUpdate: (user) => {
                    let decision = this._getDecision(user)
                    if (decision) this._mouseClick()
                }
            },
            dx: {
                input: {type: 'number'},
                output: {type: null},
                onUpdate: (user) => {
                    let choice = Number(user.data)
                    this._moveMouse(choice,0)
                }
            },
            dy: {
                input: {type: 'number'},
                output: {type: null},
                onUpdate: (user) => {
                    let choice = Number(user.data)
                    this._moveMouse(0,choice)
                }
            }
        }
    }

    init = () => {

        this.props.py = 0
        this.props.px = 0
        
        // Image of cursor
        this.props.cursor = document.getElementById("brainsatplay-cursor"); 
        if (this.props.cursor == null){
            document.body.insertAdjacentHTML('beforeend', `<img id="brainsatplay-cursor" src="https://media.geeksforgeeks.org/wp-content/uploads/20200319212118/cursor2.png" width="${this.props.cursorSize.width}" height="${this.props.cursorSize.height}" />`)
            this.props.cursor = document.getElementById("brainsatplay-cursor"); 
        }
        this.props.cursor.style.zIndex = 10000000;
        this.props.cursor.style.pointerEvents = 'none'
        this.props.cursor.style.position = 'absolute'
        this.props.mutex = false;

        this.props.globalStyles.push(this.props.transformCSS())
        let globalStyle = document.createElement('style');
        globalStyle.innerHTML = `
        * {
            cursor: none
        }
        `;
        document.head.appendChild(globalStyle);
        this.props.globalStyles.push(globalStyle)
  
        window.addEventListener("mouseClick", this._mouseClick)
        window.addEventListener("mousemove", this._mouseMove);
  
        this.props.cursor.style.left = this.props.x + 'px'
        this.props.cursor.style.top = this.props.y + 'px'
        this.props.looping = true

        let animate = () => {

            if (this.props.looping){

                // Start Robot if Required
                // if (this.ports.robot.data && !this.session.info.connected){
                //     this._startRobot()
                // }
                setTimeout(() => {animate()}, 1000/10)
            }
        }
    
        animate()
    }

    deinit = () => {
        if (this.props.cursor != null) this.props.cursor.remove()

        document.body.style.cursor = 'default'
        this.props.looping = false

        window.removeEventListener("mouseClick", this._mouseClick)
        window.removeEventListener("mousemove", this._mouseMove);
        this.props.globalStyles.forEach(style => {
            document.head.removeChild(style);
        })
    }

    _getDecision(user, command){
        let mean = Number(user.data)
        if (command) this.props[command] = (mean >= 0.5)
        return (mean >= 0.5)
    }

    _mouseClick = () => {          
        // gets the object on image cursor position
        // if (this.ports.robot.data){
        //     this.session.sendBrainstormCommand(['mouseClick'])
        // } else {
            var tmp = document.elementFromPoint(this.props.x + this.props.px, this.props.y + this.props.py); 
            if (tmp){
                this.props.mutex = true;
                let event = new MouseEvent('click');
                tmp.dispatchEvent(event);

                this.props.cursor.style.left = (this.props.px + this.props.x) + "px";
                this.props.cursor.style.top = (this.props.py + this.props.y) + "px";
            }
        // }
    }


    _mouseMove = (e) => {
            // Gets the x,y position of the mouse cursor

            this.props.x = e.clientX;
            this.props.y = e.clientY;
            
  
            // sets the image cursor to new relative position
            this.props.cursor.style.left = (this.props.px + this.props.x) + "px";
            this.props.cursor.style.top = (this.props.py + this.props.y) + "px";

            this._mouseHover(false)
    }

    _moveMouse(dx,dy){
        if (this.ports.robot.data){
            this.session.sendBrainstormCommand(['moveMouse', {x:dx, y:dy}])
        } 
        else {
            let desiredX = this.props.x + dx
            let desiredY = this.props.y + dy
            // Bound within Window
            if (desiredX < (window.innerWidth - this.props.cursorSize.width) && desiredX > 0) this.props.x = desiredX
            if (desiredX < (window.innerHeight - this.props.cursorSize.height) && desiredX > 0) this.props.y = desiredY
        }

        // Trigger Cursor Events
        this.props.cursor.style.left = `${this.props.x}px`
        this.props.cursor.style.top = `${this.props.y}px`
        this._mouseHover(!this.ports.robot.data)
    }


    _mouseHover = (trigger=true) => {
        try{
        let currentHovered = document.elementFromPoint(this.props.x + this.props.px, this.props.y + this.props.py); 

        if (this.props.prevHovered != currentHovered){

            // Trigger Mouse Out on Previous
            if (this.props.prevHovered != null){

                let prevHovered = this.props.prevHovered
                let event = new MouseEvent('mouseout', {
                    'view': window,
                    'bubbles': true,
                    'cancelable': true
                    });
                    prevHovered.dispatchEvent(event);
                    
                while (prevHovered) {
                    prevHovered.classList.remove('hover')
                    prevHovered = prevHovered.parentNode;
                    if (prevHovered == null || prevHovered.tagName == 'BODY' || prevHovered.tagName == null) prevHovered = null
                }
            }

            this.props.prevHovered = currentHovered

            if (trigger){
                //Trigger Mouse Over on Current
                let event = new MouseEvent('mouseover', {
                'view': window,
                'bubbles': true,
                'cancelable': true
                });

                currentHovered.dispatchEvent(event);

                while (currentHovered) {
                    currentHovered.classList.add('hover')
                    currentHovered = currentHovered.parentNode;
                    if (currentHovered.tagName == 'BODY' || currentHovered.tagName == null) currentHovered = null
                }
            }
        }
    } catch{}
    }
    
    // _startRobot(){
    //     if (this.ports.robot.data && !this.session.info.connected){
    //         this.session.login(undefined, undefined, (res) => {
    //             console.log('connected')
    //         })
    //     }
    // }
}