import Mario from '../sprites/Mario';
import Goomba from '../sprites/Goomba';
import Turtle from '../sprites/Turtle';
import PowerUp from '../sprites/PowerUp';
import SMBTileSprite from '../sprites/SMBTileSprite';
import AnimatedTiles from 'phaser-animated-tiles/dist/AnimatedTiles.min.js';
import Fire from '../sprites/Fire';
import reduceArrays from '../helpers/reduceArrays';
import Water from '../sprites/Water';

class GameScene extends Phaser.Scene {
    constructor(test) {
        super({
            key: 'GameScene'
        });
    }

    preload() {
        this.load.scenePlugin('animatedTiles', AnimatedTiles, 'animatedTiles', 'animatedTiles');
    }

    create() {
        console.log("creating gamescene");
        // This scene is either called to run in attract mode in the background of the title screen
        // or for actual gameplay. Attract mode is based on a JSON-recording.
        if (this.registry.get('attractMode')) {
            this.attractMode = {
                recording: this.sys.cache.json.entries.entries.attractMode,
                current: 0,
                time: 0
            };
        } else {
            this.attractMode = null;
        }
        this.music = this.sound.add('albundy');

        this.music.play({
            loop: true
        });

        this.messsages = [
            {
                x: 800,
                message: 'What a horrible night\nto have a wedding!'
            },
            {
                x: 1100,
                message: 'Schlechtester Zeitpunkt\nfuer eine Unterbrechung?\n\n- Mitten ueberm Loch!'
            },
            {
                x: 2216,
                message: 'Du bist safe!\nOder bist du safe?'
            }
        ];
        this.nextMsg = 0;

        // Places to warp to (from pipes). These coordinates is used also to define current room (see below)
        this.destinations = {};

        // Array of rooms to keep bounds within to avoid the need of multiple tilemaps per level.
        // It might be a singe screen room like when going down a pipe or a sidescrolling level.
        // It's defined as objects in Tiled.
        this.rooms = [];

        // Nummern fürs Codeschloss
        this.numbers = [0, 0, 0];
        this.numbersTarget = [8, 0, 6];
        this.pipeElements = [[57, 3], [58, 3]];
        this.pipeRaised = true;

        // Running in 8-bit mode (16-bit mode is avaliable for the tiles, but I haven't done any work on sprites etc)
        this.eightBit = true;

        this.sound.setVolume(0.2);

        // Add the map + bind the tileset
        this.map = this.make.tilemap({
            key: 'map'
        });
        this.tileset = this.map.addTilesetImage('SuperMarioBros-World1-1', 'tiles');

        // Dynamic layer because we want breakable and animated tiles
        this.groundLayer = this.map.createDynamicLayer('world', this.tileset, 0, 0);

        // We got the map. Tell animated tiles plugin to loop through the tileset properties and get ready.
        // We don't need to do anything beyond this point for animated tiles to work.
        this.sys.animatedTiles.init(this.map);

        // Probably not the correct way of doing this:
        this.physics.world.bounds.width = this.groundLayer.width;

        // Add the background as an tilesprite.
        this.add.tileSprite(0, 0, this.groundLayer.width, 500, 'background-clouds');

        // Set collision by property
        this.groundLayer.setCollisionByProperty({
            collide: true
        });

        // This group contains all enemies for collision and calling update-methods
        this.enemyGroup = this.add.group();

        // A group powerUps to update
        this.powerUps = this.add.group();


        this.otherGroup = this.add.group();

        // Populate enemyGroup, powerUps, pipes and destinations from object layers
        this.parseObjectLayers();

        // this.keys will contain all we need to control Mario.
        // Any key could just replace the default (like this.key.jump)
        this.keys = {
            jump: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X),
            fire: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
            left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
            right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
            down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
            safe: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.V),
            married: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            text: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T),
            lower: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L),
            grow: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G),
            end: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
            query: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q)
        };

        // An emitter for bricks when blocks are destroyed.
        this.blockEmitter = this.add.particles('mario-sprites');

        this.blockEmitter.createEmitter({
            frame: {
                frames: ['brick'],
                cycle: true
            },
            gravityY: 1000,
            lifespan: 2000,
            speed: 400,
            angle: {
                min: -90 - 25,
                max: -45 - 25
            },
            frequency: -1
        });

        // Used when hitting a tile from below that should bounce up.
        this.bounceTile = new SMBTileSprite({
            scene: this
        });

        this.createHUD();

        // Prepare the finishLine
        let worldEndAt = -1;
        for (let x = 0; x < this.groundLayer.width; x++) {
            let tile = this.groundLayer.getTileAt(x, 2);
            if (tile && tile.properties.worldsEnd) {
                worldEndAt = tile.pixelX;
                break;
            }
        }
        this.finishLine = {
            x: worldEndAt,
            flag: this.add.sprite(worldEndAt + 8, 4 * 16),
            active: true
        };
        this.finishLine.flag.play('flag');

        // Touch controls is really just a quick hack to try out performance on mobiles,
        // It's not itended as a suggestion on how to do it in a real game.
        let jumpButton = this.add.sprite(350, 180);
        jumpButton.play('button');
        let dpad = this.add.sprite(20, 170);
        dpad.play('dpad');
        this.touchControls = {
            dpad: dpad,
            abutton: jumpButton,
            left: false,
            right: false,
            down: false,
            jump: false,
            visible: false
        };
        jumpButton.setScrollFactor(0, 0);
        jumpButton.alpha = 0;
        jumpButton.setInteractive();
        jumpButton.on('pointerdown', (pointer) => {
            this.touchControls.jump = true;
        });
        jumpButton.on('pointerup', (pointer) => {
            this.touchControls.jump = false;
        });
        dpad.setScrollFactor(0, 0);
        dpad.alpha = 0;
        dpad.setInteractive();
        dpad.on('pointerdown', (pointer) => {
            let x = dpad.x + dpad.width - pointer.x;
            let y = dpad.y + dpad.height - pointer.y;
            if (y > 0 || Math.abs(x) > -y) {
                if (x > 0) {
                    console.log('going left');
                    this.touchControls.left = true;
                } else {
                    console.log('going right');
                    this.touchControls.right = true;
                }
            } else {
                this.touchControls.down = true;
            }
        });
        dpad.on('pointerup', (pointer) => {
            this.touchControls.left = false;
            this.touchControls.right = false;
            this.touchControls.down = false;
        });
        window.toggleTouch = this.toggleTouch.bind(this);

        // Mute music while in attract mode
        if (this.attractMode) {
            this.music.volume = 0;
        }

        // If the game ended while physics was disabled
        this.physics.world.resume();

        // CREATE MARIO!!!
        this.mario = new Mario({
            scene: this,
            key: 'mario',
            x: 16 * 6,
            y: this.sys.game.config.height - 48 - 48
        });

        // Set bounds for current room
        this.mario.setRoomBounds(this.rooms);

        // The camera should follow Mario
        this.cameras.main.setBounds(0, 0, this.physics.world.bounds.width, this.sys.game.config.height);
        this.cameras.main.startFollow(this.mario);
        this.cameras.main.roundPixels = true;
        this.cameras.main.setBackgroundColor(0x6888FF);

        this.fireballs = this.add.group({
            classType: Fire,
            maxSize: 10,
            runChildUpdate: false // Due to https://github.com/photonstorm/phaser/issues/3724
        });
    }

    update(time, delta) {
        if (!this.attractMode) {
            this.record(delta);
        }

        // this.fireballs.children.forEach((fire)=>{
        //    fire.update(time, delta);
        // })

        Array.from(this.fireballs.children.entries).forEach(
            (fireball) => {
                fireball.update(time, delta);
            });

        /* console.log(time); */
        if (this.attractMode) {
            this.attractMode.time += delta;

            // console.log(this.attractMode.current);
            // console.log(this.attractMode.current, this.attractMode.recording.length);

            if (this.mario.y > 240 || (this.attractMode.recording.length <= this.attractMode.current + 2) || this.attractMode.current === 14000) {
                this.attractMode.current = 0;
                this.attractMode.time = 0;
                this.mario.x = 16 * 6; // 3500,
                this.tick = 0;
                this.registry.set('restartScene', true);

                // this.scene.stop();
                // this.scene.switch('GameScene');
                // this.create();
                console.log('RESET');

                // this.mario.y = this.sys.game.config.height - 48 -48
                // return;
            }

            if (this.attractMode.time >= this.attractMode.recording[this.attractMode.current + 1].time) {
                this.attractMode.current++;
                this.mario.x = this.attractMode.recording[this.attractMode.current].x;
                this.mario.y = this.attractMode.recording[this.attractMode.current].y;
                this.mario.body.setVelocity(this.attractMode.recording[this.attractMode.current].vx, this.attractMode.recording[this.attractMode.current].vy);
            }
            this.keys = {
                jump: {
                    isDown: this.attractMode.recording[this.attractMode.current].keys.jump
                },
                jump2: {
                    isDown: false
                },
                left: {
                    isDown: this.attractMode.recording[this.attractMode.current].keys.left
                },
                right: {
                    isDown: this.attractMode.recording[this.attractMode.current].keys.right
                },
                down: {
                    isDown: this.attractMode.recording[this.attractMode.current].keys.down
                },
                fire: {
                    isDown: this.attractMode.recording[this.attractMode.current].keys.fire
                },
                safe: {
                    isDown: this.attractMode.recording[this.attractMode.current].keys.safe
                },
                married: {
                    isDown: this.attractMode.recording[this.attractMode.current].keys.married
                },
                text: {
                    isDown: this.attractMode.recording[this.attractMode.current].keys.text
                },
                lower: {
                    isDown: this.attractMode.recording[this.attractMode.current].keys.lower
                },
                grow: {
                    isDown: this.attractMode.recording[this.attractMode.current].keys.grow
                },
                end: {
                    isDown: this.attractMode.recording[this.attractMode.current].keys.end
                },
                query: {
                    isDown: this.attractMode.recording[this.attractMode.current].keys.query
                }
            };
        }

        if (this.physics.world.isPaused) {
            return;
        }

        if (this.mario.x > this.finishLine.x && this.finishLine.active) {
            this.removeFlag();
            this.physics.world.pause();
            return;
        }


        if (! this.attractMode && this.finishLine.active && this.messsages.length > this.nextMsg && this.mario.x > this.messsages[this.nextMsg].x) {
            this.displayTextBox(this.messsages[this.nextMsg++].message);
        }

        this.levelTimer.time -= delta * 2;
        if (this.levelTimer.time - this.levelTimer.displayedTime * 1000 < 1000) {
            this.levelTimer.displayedTime = Math.round(this.levelTimer.time / 1000);
            this.levelTimer.textObject.setText(('' + this.levelTimer.displayedTime).padStart(3, '0'));
            if (this.levelTimer.displayedTime < 50 && !this.levelTimer.hurry) {
                this.levelTimer.hurry = true;
                this.music.pause();
                let sound = this.sound.addAudioSprite('sfx');
                sound.on('ended', (sound) => {
                    this.music.seek = 0;
                    this.music.rate = 1.5;
                    this.music.resume();
                    sound.destroy();
                });
                sound.play('smb_warning');
            }
            if (this.levelTimer.displayedTime < 1) {
                this.mario.die();
                this.levelTimer.hurry = false;
                this.music.rate = 1;
                this.levelTimer.time = 150 * 1000;
                this.levelTimer.displayedTime = 255;
            }
        }

        // Run the update method of Mario
        this.mario.update(this.keys, time, delta);

        // Run the update method of all enemies
        this.enemyGroup.children.entries.forEach(
            (sprite) => {
                sprite.update(time, delta);
            }
        );

        // Run the update method of all enemies
        this.otherGroup.children.entries.forEach(
            (sprite) => {
                sprite.update(time, delta);
            }
        );
        // Run the update method of non-enemy sprites
        this.powerUps.children.entries.forEach(
            (sprite) => {
                sprite.update(time, delta);
            }
        );

        if (this.keys.query.isDown) {
            console.log(this.mario);
        }

        if (this.keys.married.isDown) {
            this.playMarriedWithChildrenVideo();
		}
        if (this.keys.text.isDown) {
            this.displayTextBox('this is text\nthis is also text\n\nwe can write shit here\nthat\'s nice ...');
        }
        if (this.keys.grow.isDown) {
            this.mario.resize(true);
        }
        if (this.keys.lower.isDown && this.pipeRaised) {
            this.lowerPipe(this);
        }
        if (this.keys.end.isDown) {
            this.endGame(this);
        }
    }

    simpleCollision(sprite, tile) {
        if (tile.properties.coin) {
            sprite.scene.map.removeTileAt(tile.x, tile.y, true, true, this.groundLayer);
            (() => new PowerUp({
                scene: sprite.scene,
                key: 'sprites16',
                x: tile.x * 16 + 8,
                y: tile.y * 16 - 8,
                type: 'coin'
            }))();
        }
        return true;
    }

    tileCollision(sprite, tile) {
        if (sprite.type === 'turtle') {
            if (tile.y > Math.round(sprite.y / 16)) {
                // Turtles ignore the ground
                return;
            }
        } else if (sprite.type === 'mario') {
            // Mario is bending on a pipe that leads somewhere:
            console.log(sprite.bending, tile.properties.pipe, tile.properties.dest);
            if (sprite.bending && tile.properties.pipe && tile.properties.dest) {
                sprite.scene.nextMsg = 3;
                sprite.enterPipe(parseInt(tile.properties.dest), tile.rotation);
            }
        }

        // If it's Mario and the body isn't blocked up it can't hit question marks or break bricks
        // Otherwise Mario will break bricks he touch from the side while moving up.
        if (sprite.type === 'mario' && !sprite.body.blocked.up) {
            return;
        }

        // If the tile has a callback, lets fire it
        if (tile.properties.callback) {
            switch (tile.properties.callback) {
                case 'questionMark':
                    // Shift to a metallic block
                    tile.index = 44;

                    // Bounce it a bit
                    sprite.scene.bounceTile.restart(tile);

                    // The questionmark is no more
                    tile.properties.callback = null;

                    // Invincible blocks are only collidable from above, but everywhere once revealed
                    tile.setCollision(true);

                    // Check powerUp for what to do, make a coin if not defined
                    let powerUp = tile.powerUp ? tile.powerUp : 'coin';

                    // Make powerUp (including a coin)
                    (() => new PowerUp({
                        scene: sprite.scene,
                        key: 'sprites16',
                        x: tile.x * 16 + 8,
                        y: tile.y * 16 - 8,
                        type: powerUp
                    }))();

                    break;
                case 'breakable':
                    if (sprite.type === 'mario' && sprite.animSuffix === '') {
                        // Can't break it anyway. Bounce it a bit.
                        sprite.scene.bounceTile.restart(tile);
                        sprite.scene.sound.playAudioSprite('sfx', 'smb_bump');
                    } else {
                        // get points
                        sprite.scene.updateScore(50);
                        sprite.scene.map.removeTileAt(tile.x, tile.y, true, true, this.groundLayer);
                        sprite.scene.sound.playAudioSprite('sfx', 'smb_breakblock');
                        sprite.scene.blockEmitter.emitParticle(6, tile.x * 16, tile.y * 16);
                    }
                    break;
                case 'toggle16bit':
                    sprite.scene.eightBit = !sprite.scene.eightBit;
                    if (sprite.scene.eightBit) {
                        sprite.scene.tileset.setImage(sprite.scene.sys.textures.get('tiles'));
                    } else {
                        sprite.scene.tileset.setImage(sprite.scene.sys.textures.get('tiles-16bit'));
                    }
                    break;
                case 'moveNum':
                    const codeIdx = tile.x - 51;
                    sprite.scene.numbers[codeIdx] = (sprite.scene.numbers[codeIdx] + 1) % 10;
                    tile.index += 1;
                    if (tile.index > 57) {
                        tile.index = 48;
                    }
                    sprite.scene.bounceTile.restart(tile);
                    if (sprite.scene.numbers[0] === sprite.scene.numbersTarget[0] &&
                        sprite.scene.numbers[1] === sprite.scene.numbersTarget[1] &&
                        sprite.scene.numbers[2] === sprite.scene.numbersTarget[2] &&
                        sprite.scene.pipeRaised) {
                        sprite.scene.lowerPipe(sprite.scene);
                        sprite.scene.pipeRaised = false;
                    }
                    else if(!sprite.scene.pipeRaised) {
                        sprite.scene.raisePipe(sprite.scene);
                        sprite.scene.pipeRaised = true;
                    }
                    break;
                default:
                    sprite.scene.sound.playAudioSprite('sfx', 'smb_bump');
                    break;
            }
        } else {
            sprite.scene.sound.playAudioSprite('sfx', 'smb_bump');
        }
    }

    /* * To be removed, supported natively now:
     * setCollisionByProperty(map) {
      Object.keys(map.tilesets[0].tileProperties).forEach(
        (id) => {

          if (map.tilesets[0].tileProperties[id].collide) {
            map.setCollision(parseInt(id) + 1);
          }
        }
      )
    } */



    lowerPipe(scene) {
        //const pipeElements = [[57, 3], [58, 3]];
        scene.pipeElements.forEach(tile => {
            const orig = scene.map.getTileAt(tile[0], tile[1], true, this.groundLayer);
            scene.map.removeTileAt(tile[0], tile[1], true, true, this.groundLayer);
            scene.map.removeTileAt(tile[0], tile[1] + 1, true, true, this.groundLayer);
            scene.map.putTileAt(orig, tile[0], tile[1] + 2, true, this.groundLayer);
        });
    }

    raisePipe(scene) {
        scene.pipeElements.forEach(tile => {
            const origPipeTop = scene.map.getTileAt(tile[0], tile[1] + 2, true, this.groundLayer);
            const origPipe = scene.map.getTileAt(tile[0], tile[1] + 3, true, this.groundLayer);
            scene.map.putTileAt(origPipeTop, tile[0], tile[1], true, this.groundLayer);
            scene.map.putTileAt(origPipe, tile[0], tile[1] + 1, true, this.groundLayer);
            scene.map.putTileAt(origPipe, tile[0], tile[1] + 2, true, this.groundLayer);
        });
    }

    updateScore(score) {
        this.score.pts += score;
        this.score.textObject.setText(('' + this.score.pts).padStart(6, '0'));
    }

    removeFlag(step = 0) {
        switch (step) {
            case 0:
                console.log(window.recording);
                this.music.pause();
                this.sound.playAudioSprite('sfx', 'smb_flagpole');
                this.mario.play('mario/climb' + this.mario.animSuffix);
                this.mario.x = this.finishLine.x - 1;
                this.tweens.add({
                    targets: this.finishLine.flag,
                    y: 240 - 6 * 8,
                    duration: 1500,
                    onComplete: () => this.removeFlag(1)
                });
                this.tweens.add({
                    targets: this.mario,
                    y: 240 - 3 * 16,
                    duration: 1000,
                    onComplete: () => {
                        this.mario.flipX = true;
                        this.mario.x += 11;
                    }
                });
                break;
            case 1:
                let sound = this.sound.addAudioSprite('sfx');
                sound.on('ended', (sound) => {
                    /* this.mario.x = 48;
                    this.mario.y = -32;
                    this.mario.body.setVelocity(0);
                    this.mario.alpha = 1;
                    this.music.rate = 1;
                    this.music.seek = 0;
                    this.music.resume();
                    this.levelTimer.hurry = false;
                    this.levelTimer.time = 150 * 1000;
                    this.levelTimer.displayedTime = 255;
                    this.physics.world.resume(); */
                    sound.destroy();
                    this.scene.start('TitleScene');
                });
                sound.play('smb_stage_clear');

                this.mario.play('run' + this.mario.animSuffix);

                this.mario.flipX = false;
                this.tweens.add({
                    targets: this.mario,
                    x: this.finishLine.x + 6 * 16,
                    duration: 1000,
                    onComplete: () => this.removeFlag(2)
                });
                break;
            case 2:
                this.tweens.add({
                    targets: this.mario,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => this.removeFlag(3)
                });
                break;
            case 3:
                this.tweens.add({
                    targets: this.mario,
                    alpha: 1,
                    duration: 1,
                    onComplete: () => this.endGame()
                });
                break;
        }
    }

    toggleTouch() {
        this.touchControls.visible = !this.touchControls.visible;
        if (this.touchControls.visible) {
            this.touchControls.dpad.alpha = 0;
            this.touchControls.abutton.alpha = 0;
        } else {
            this.touchControls.dpad.alpha = 0.5;
            this.touchControls.abutton.alpha = 0.5;
        }
    }

    record(delta) {
        let update = false;
        let keys = {
            jump: this.keys.jump.isDown, // || this.keys.jump2.isDown,
            left: this.keys.left.isDown,
            right: this.keys.right.isDown,
            down: this.keys.down.isDown,
            fire: this.keys.fire.isDown,
            safe: this.keys.safe.isDown,
            married: this.keys.married.isDown
        };
        if (typeof (recording) === 'undefined') {
            console.log('DEFINE');
            window.recording = [];
            window.time = 0;
            this.recordedKeys = {};
            update = true;
        } else {
            update = (window.time - recording[recording.length - 1].time) > 200; // update at least 5 times per second
        }
        window.time += delta;
        if (!update) {
            // update if keys changed
            ['jump', 'left', 'right', 'down', 'fire', 'safe', 'married' ].forEach((dir) => {
                if (keys[dir] !== this.recordedKeys[dir]) {
                    update = true;
                }
            });
        }
        if (update) {
            window.recording.push({
                time: window.time,
                keys,
                x: this.mario.x,
                y: this.mario.y,
                vx: this.mario.body.velocity.x,
                vy: this.mario.body.velocity.y
            });
        }
        this.recordedKeys = keys;
    }

    parseObjectLayers() {
        // The map has one object layer with enemies as stamped tiles,
        // each tile has properties containing info on what enemy it represents.
        this.map.getObjectLayer('enemies').objects.forEach(
            (enemy) => {
                let enemyObject;
                switch (this.tileset.tileProperties[enemy.gid - 1].name) {
                    case 'goomba':
                        enemyObject = new Goomba({
                            scene: this,
                            key: 'sprites16',
                            x: enemy.x,
                            y: enemy.y
                        });
                        break;
                    case 'turtle':
                        enemyObject = new Turtle({
                            scene: this,
                            key: 'mario-sprites',
                            x: enemy.x,
                            y: enemy.y
                        });
                        break;
                    default:
                        console.error('Unknown:', this.tileset.tileProperties[enemy.gid - 1]); // eslint-disable-line no-console
                        break;
                }
                this.enemyGroup.add(enemyObject);
            }
        );

        // The map has an object layer with 'modifiers' that do 'stuff', see below
        this.map.getObjectLayer('modifiers').objects.forEach((modifier) => {
            let tile, properties, type;

            modifier.properties = reduceArrays(modifier.properties, 'name', 'value');

            // Get property stuff from the tile if present or just from the object layer directly
            if (typeof modifier.gid !== 'undefined') {
                properties = this.tileset.tileProperties[modifier.gid - 1];
                type = properties.type;
                if (properties.hasOwnProperty('powerUp')) {
                    type = 'powerUp';
                }
                if (typeof type === 'undefined' && modifier.properties.type) {
                    type = modifier.properties.type;
                }
            } else {
                type = modifier.properties.type;
            }

            switch (type) {
                case 'powerUp':
                    // Modifies a questionmark below the modifier to contain something else than the default (coin)
                    tile = this.groundLayer.getTileAt(modifier.x / 16, modifier.y / 16 - 1);
                    tile.powerUp = properties.powerUp;
                    tile.properties.callback = 'questionMark';
                    if (!tile.collides) {
                        // Hidden block without a question mark
                        tile.setCollision(false, false, false, true);
                    }
                    break;
                case 'pipe':
                    // Adds info on where to go from a pipe under the modifier
                    tile = this.groundLayer.getTileAt(modifier.x / 16, modifier.y / 16);
                    tile.properties.dest = parseInt(modifier.properties.goto);
                    break;
                case 'water':
                    //tile = this.groundLayer.getTileAt(modifier.x / 16, modifier.y / 16, true);
                    //console.log(tile);
                    //tile.setCollision(true, true, true, true);
                    //tile.setCollisionCallback((a, b) => console.log(a, b), this);
                    this.otherGroup.add(new Water({
                        key: 'puddle',
                        scene: this,
                        x: modifier.x,
                        y: modifier.y
                    }));
                    break;
                case 'dest':
                    // Adds a destination so that a pipe can find it
                    this.destinations[modifier.properties.id] = {
                        x: modifier.x + modifier.width / 2,
                        top: (modifier.y < 16)
                    };
                    break;
                case 'room':
                    // Adds a 'room' that is just info on bounds so that we can add sections below pipes
                    // in an level just using one tilemap.
                    this.rooms.push({
                        x: modifier.x,
                        width: modifier.width,
                        sky: modifier.properties.sky
                    });
                    break;
            }
        });
    }

    createHUD() {
        const hud = this.add.bitmapText(5 * 8, 8, 'font', 'MARIO                      TIME', 8);
        hud.setScrollFactor(0, 0);
        this.levelTimer = {
            textObject: this.add.bitmapText(36 * 8, 16, 'font', '255', 8),
            time: 150 * 10000,
            displayedTime: 255,
            hurry: false
        };
        this.levelTimer.textObject.setScrollFactor(0, 0);
        this.score = {
            pts: 0,
            textObject: this.add.bitmapText(5 * 8, 16, 'font', '000000', 8)
        };
        this.score.textObject.setScrollFactor(0, 0);

        if (this.attractMode) {
            hud.alpha = 0;

            this.levelTimer.textObject.alpha = 0;
            this.score.textObject.alpha = 0;
        }
    }

    cleanUp() {
        // Never called since 3.10 update (I called it from create before). If Everything is fine, I'll remove this method.
        // Scenes isn't properly destroyed yet.
        let ignore = ['sys', 'anims', 'cache', 'registry', 'sound', 'textures', 'events', 'cameras', 'make', 'add', 'scene', 'children', 'cameras3d', 'time', 'data', 'input', 'load', 'tweens', 'lights', 'physics'];
        let whatThisHad = ['sys', 'anims', 'cache', 'registry', 'sound', 'textures', 'events', 'cameras', 'make', 'add', 'scene', 'children', 'cameras3d', 'time', 'data', 'input', 'load', 'tweens', 'lights', 'physics', 'attractMode', 'destinations', 'rooms', 'eightBit', 'music', 'map', 'tileset', 'groundLayer', 'mario', 'enemyGroup', 'powerUps', 'keys', 'blockEmitter', 'bounceTile', 'levelTimer', 'score', 'finishLine', 'touchControls'];
        whatThisHad.forEach(key => {
            if (ignore.indexOf(key) === -1 && this[key]) {
                switch (key) {
                    case 'enemyGroup':
                    case 'music':
                    case 'map':
                        this[key].destroy();
                        break;
                }
                this[key] = null;
            }
        });
    }

    playSafeVideo() {
        this.physics.world.pause();

        this.scene.launch('YouAreSafe');
        var youAreSafeScene = this.scene.get('YouAreSafe');

    }

    playMarriedWithChildrenVideo() {
        this.physics.world.pause();

        this.scene.launch('MarriedWithChildren');
        var youAreSafeScene = this.scene.get('MarriedWithChildren');

    }

    displayTextBox(text) {
        this.physics.world.pause();

        this.scene.launch('TextBox', {'text': text});
        var textBox = this.scene.get('TextBox');
    }

    endGame() {
        this.mario.enterPipe(4, 0, false);
        this.physics.world.pause();
        this.scene.launch('YourPrincessScene');
    }

    resume() {
        this.physics.world.resume();
    }

}

export default GameScene;
