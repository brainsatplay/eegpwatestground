class UI {

    static id = String(Math.floor(Math.random() * 1000000))

    constructor(label, session, params = {}) {

        // Generic Plugin Attributes
        this.label = label
        this.session = session

        // UI Identifier
        this.props = {
            id: String(Math.floor(Math.random() * 1000000)),
            paddles: [
                {username: 'me', x: 0, y: 0, score: 0, color: 'rgb(255, 255, 255)'},
                {username: 'opponent', x: 0, y: 0, score: 0, color: 'rgb(255, 255, 255)'},
            ],
            ball: {x: 0, y: 0, angle: 0, direction: 1, radius: 8},
            paddleOptions: {
                height: 85,
                width: 10
            },
            gameOptions: {
                margin: 50,
            },
            canvas: null
        }

        // Port Definition
        this.ports = {
            difficulty: {data: 0.5, min: 0, max: 1, step: 0.01},
            paddlespeed: {data: 5, min: 0, max: 25, step: 0.01},
            ballspeed: {data: 5, min: 0, max: 10, step: 0.01},
            dy: {
                data: 0,
                input: {type: undefined},
                output: {type: null},
                onUpdate: (user) => {
                    let mean = Number(user.data)
            
                    let paddle = this.props.paddles.find(o => {if (o.username == 'me') return true})
            
                    // Update Paddle Position
                    this._movePaddle(paddle,mean*this.ports.paddlespeed.data)
                    this.session.graph.runSafe(this,'error', {forceRun: true, forceUpdate: true})
            
                    // Replace User Data with Mean
                    user.data = mean
                    return user
                }
            },
            error: {
                input: {type: null},
                output: {type: 'boolean'},
                onUpdate: () => {
                    let change = this.props.currentDistanceFromDestination - this.props.previousDistanceFromDestination
                    let error = change > 0

                    // nullify if not in your direction
                    if (this.props.ball.direction === -1) return {data: error, forceUpdate: true}
                }
            }
        }
    }

    init = () => {

        let HTMLtemplate = () => {

            let h1Style = `
                padding: 0px 10px;
            `
            return `
            <div id='${this.props.id}' style='display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;'>
                <canvas id="${this.props.id}gameCanvas" ></canvas>
                <div id="${this.props.id}scoreboard" style="position: absolute; top: 0; left; 0; display: flex;">
                    <h1 class="me" style="${h1Style}">0</h1>
                    <h1>|</h1>
                    <h1 class="opponent" style="${h1Style}">0</h1>
                <div>
            </div>`
        }


        let setupHTML = (app) => {

            const scoreboard =  document.getElementById(`${this.props.id}scoreboard`)
            const container = document.getElementById(`${this.props.id}`);
            this.props.canvas = document.getElementById(`${this.props.id}gameCanvas`);
            const context = this.props.canvas.getContext("2d");
            this.props.canvas.width = container.offsetWidth
            this.props.canvas.height = container.offsetHeight

            this.props.paddles.forEach((o) => {
                if (o.username === 'me') o.x = this.props.gameOptions.margin
                else o.x = this.props.canvas.width - this.props.gameOptions.margin
                o.y = this.props.canvas.height/2
            })
            

            const drawPaddle = (paddle) => {
                context.fillStyle = paddle.color

                // Update Color
                var regExp = /\(([^)]+)\)/;
                var paddleRGB = regExp.exec(paddle.color)[1].split(',');
                paddleRGB = paddleRGB.map(c => {
                    c = Number.parseFloat(c)
                    c += 2.5 * Math.sign(255 - c)
                    return c
                })
                paddle.color = `rgb(${paddleRGB.join(',')})`


                // context.strokeStyle = 'white'
                let shiftedY = paddle.y - this.props.paddleOptions.height/2
                context.fillRect(paddle.x, shiftedY, this.props.paddleOptions.width, this.props.paddleOptions.height)
                context.strokeRect(paddle.x, shiftedY, this.props.paddleOptions.width, this.props.paddleOptions.height)
            }

            const drawBall = (ball) => {
                context.beginPath();
                context.arc(ball.x, ball.y, this.props.ball.radius, 0, Math.PI*2);
                context.fillStyle = "white";
                context.fill();
                context.closePath();
            }

            const reset = () => {
                this.props.paddles.forEach(o => {
                    let score = scoreboard.querySelector(`.${o.username}`)
                    if (score) score.innerHTML = o.score
                })

                this.props.ball.y = this.props.canvas.height/2
                this.props.ball.x = this.props.canvas.width/2
                let aspect = this.props.canvas.width / this.props.canvas.height
                let random = Math.random() - 0.5
                this.props.ball.angle = (Math.PI/(2*aspect))*random
            }

            const clearCanvas = () => {
                context.fillStyle = 'black';
                context.stokeStyle = 'white';
                context.fillRect(0, 0, this.props.canvas.width, this.props.canvas.height)
                context.strokeRect(0, 0, this.props.canvas.width, this.props.canvas.height)
            }

            const main = () => {
                setTimeout(() => {

                    clearCanvas()

                    // Move Ball
                    let dx = this.ports.ballspeed.data * this.props.ball.direction
                    this.props.ball.x += dx

                    this.props.ball.y += Math.tan(this.props.ball.angle)*dx

                    // Check Bounce Off Walls
                    if (this.props.ball.y <= this.props.ball.radius || this.props.ball.y >= (this.props.canvas.height - this.props.ball.radius)) this.props.ball.angle *= -1

                    drawBall(this.props.ball)

                    // Control Opponent AI
                    let opponent = this.props.paddles.find(o => {if (o.username == 'opponent') return true})
                    this._movePaddle(opponent, (this.ports.difficulty.data) * this.ports.ballspeed.data * Math.sign(this.props.ball.y - opponent.y))

                    // Draw All Paddles
                    this.props.paddles.forEach(drawPaddle);

                    // Check Collision
                    this.props.paddles.forEach(o => {

                        // Check X
                        let extra = 0
                        if (o.username === 'me') {
                            extra = this.props.paddleOptions.width
                            let targetY = this.props.ball.y + (Math.tan(this.props.ball.angle) * Math.abs(this.props.ball.x - o.x))
                            // console.log(this.props.ball.y, targetY, this.props.ball.direction)
                        }
                        if (Math.abs(this.props.ball.x - o.x) <= this.props.paddleOptions.width + extra){

                            let yDist = this.props.ball.y-o.y
                            // Check Y
                            if (Math.abs(yDist) <= this.props.paddleOptions.height/2 ) {
                                this.props.ball.direction *= -1
                                this.props.ball.angle = this.props.ball.direction*yDist/(this.props.paddleOptions.height/2)
                                o.color = `rgb(129, 218, 250)`
                            }
                        }
                        
                    })

                    // Check if Reset is Needed
                    if (this.props.ball.x < 0 || this.props.ball.x > this.props.canvas.width){
                        let sign = Math.sign(this.props.ball.direction)
                        let winningPaddle;
                        if (sign === 1){
                            winningPaddle = this.props.paddles.find(o => {if (o.username === 'me') return true})
                        } else {
                            winningPaddle = this.props.paddles.find(o => {if (o.username !== 'me') return true})
                        }
                        winningPaddle.score++

                        this.props.ball.direction *= -1
                        reset()
                    }

                    main()
                }, 1000/60)
            }

            reset()
            main()
        }

        return { HTMLtemplate, setupHTML }
    }

    _movePaddle = (paddle, dy) => {

        let upper = paddle.y + this.props.paddleOptions.height/2 + dy
        let lower = paddle.y - this.props.paddleOptions.height/2 + dy

        let targetY = this.props.ball.y + (Math.tan(this.props.ball.angle) * Math.abs(paddle.x - this.props.ball.x))

        if (paddle.username === 'me') this.props.previousDistanceFromDestination = Math.abs(Math.min(0, (upper - dy) - targetY, targetY - (lower - dy)))
        if (upper < this.props.canvas.height &&  lower > 0) paddle.y += dy
        if (paddle.username === 'me') this.props.currentDistanceFromDestination =  Math.abs(Math.min(0, upper - targetY, targetY - lower))
    }

    responsive = () => {
        const container = document.getElementById(`${this.props.id}`);
        if (container) {

            // Map to New Positions
            this.props.paddles.forEach(o => {
                if (o.username === 'opponent') o.x = this.props.canvas.width - this.props.paddleOptions.width - this.props.gameOptions.margin
                o.y = container.offsetHeight*(o.y/this.props.canvas.height)
            })

            this.props.canvas.width = container.offsetWidth
            this.props.canvas.height = container.offsetHeight

        }
    }

    deinit = () => {

    }
}

export { UI }