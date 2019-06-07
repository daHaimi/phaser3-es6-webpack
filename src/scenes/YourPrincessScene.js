class YourPrincessScene extends Phaser.Scene {
    constructor(test) {
        super({
            key: 'YourPrincessScene'
        });
    }
    preload() {

    }
    create() {
        this.timer = 0;
        this.state = 0;
        this.prevState = -1;
        this.besenOn = false;

        this.anims.create({
            key: 'noise',
            frames: this.anims.generateFrameNumbers('noise'),
            frameRate: 9,
            yoyo: false,
            repeat: -1
        });
        this.noise = this.add.sprite(this.game.config.width / 2, this.game.config.height / 2);
        this.noise.setSize(800, 240);
        this.noise.play('noise');

        this.anims.create({
            key: 'toad',
            frames: this.anims.generateFrameNumbers('toad'),
            frameRate: 2,
            yoyo: false,
            repeat: -1
        });
        this.anims.create({
            key: 'gollum',
            frames: this.anims.generateFrameNumbers('gollum'),
            frameRate: 1,
            repeat: -1
        });
        this.anims.create({
            key: 'peach',
            frames: this.anims.generateFrameNumbers('peach'),
            frameRate: 1,
            repeat: -1
        });
        this.anims.create({
            key: 'besen',
            frames: this.anims.generateFrameNumbers('besen'),
            frameRate: 1,
            repeat: -1
        });
    }

    atFloor(key) {
    }

    stateDef(num, duration, cb) {
        if (this.state === num && this.prevState !== num) {
            cb();
            this.timer = duration;
            this.prevState = num;
        }
    }

    rotateBesen(delta) {
        this.scale += .0003 * delta;
        this.besen.setScale(this.scale, this.scale);
        this.besen.rotation += .003 * delta;
    }

    update(time, delta) {
        if (!this.scene.isActive('TextBox')) {
            this.timer -= delta;
        }

        this.stateDef(0, 2000, () => {
            this.scene.get('GameScene').resume();
            this.noise.setVisible(false);
            this.toad = this.add.sprite(this.game.config.width / 2, this.game.config.height - 44);
            this.toad.play('toad');
        });
        this.stateDef(1, 1000, () => this.displayTextBox('Sorry,\nbut your princess\nis in another castle!'));
        this.stateDef(2, 1000, () => {
            this.toad.setVisible(false);
            this.noise.setVisible(true);
        });
        this.stateDef(3, 1000, () => {
            this.noise.setVisible(false);
            this.gollum = this.add.sprite(this.game.config.width / 2, this.game.config.height - 51);
            this.gollum.setScale(.6, .6);
            this.gollum.play('gollum');
        });
        this.stateDef(4, 500, () => this.displayTextBox('Ein Ring sie zu knechten\n...'));
        this.stateDef(5, 500, () => this.displayTextBox('Mein Schatz!\n...'));
        this.stateDef(6, 1000, () => {
            this.gollum.setVisible(false);
            this.noise.setVisible(true);
        });
        this.stateDef(7, 1000, () => {
            this.noise.setVisible(false);
            this.peach = this.add.sprite(this.game.config.width / 2, this.game.config.height - 44);
            this.peach.play('peach');
        });
        this.stateDef(8, 500, () => this.displayTextBox('Saschario!\n... Mein ...'));
        this.stateDef(9, 500, () => this.displayTextBox('Besen!?!'));
        this.stateDef(10, 3100, () => {
            this.besen = this.add.sprite(this.game.config.width / 2, this.game.config.height / 2);
            this.besen.play('besen');
            this.besen.setVisible(true);
            this.scale = 0.01;
            this.besenOn = true;
        });
        this.stateDef(11, 1000, () => {
            this.besenOn = false;
            this.peach.setVisible(false);
            this.besen.setVisible(false);
            this.noise.setVisible(true);
        });
        this.stateDef(12, 500, () => {
            this.noise.setVisible(false);
            this.peach.setVisible(true);
            this.peach.x += 50;
            this.toad.setVisible(true);
            this.besen.setVisible(true);
            this.besen.setAngle(270);
            this.besen.setScale(.07, .07);
            this.besen.setPosition(this.toad.x - 30, this.toad.y);
        });
        this.stateDef(13, 500, () => this.displayTextBox('Now...\nDon\'t lose her again!'));

        if (this.besenOn === true) {
            this.rotateBesen(delta);
        }

        if (this.timer <= 0 && this.state <= this.prevState) {
            this.state++;
        }
    }

    displayTextBox(text) {
        this.physics.world.pause();

        this.scene.launch('TextBox', {
            text: text
        });
        const textBox = this.scene.get('TextBox');
    }
}

export default YourPrincessScene;
